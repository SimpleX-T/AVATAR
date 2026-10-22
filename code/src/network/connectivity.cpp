#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>
#include <time.h>

#include "config.h"
#include "connectivity.h"
#include "manual_pump_test.h"
#include "pins.h"
#include "provisioning.h"
#include "secrets.h"
#include "simulation.h"
#include "state.h"
#include "timer.h"

#ifndef AVATAR_SECONDARY_WIFI_SSID
#define AVATAR_SECONDARY_WIFI_SSID ""
#endif

#ifndef AVATAR_SECONDARY_WIFI_PASSWORD
#define AVATAR_SECONDARY_WIFI_PASSWORD ""
#endif

#if __has_include("server_ca.h")
#include "server_ca.h"
#else
constexpr char AVATAR_SERVER_CA_PEM[] = "";
#endif

namespace
{
unsigned long lastWifiAttemptAt = 0;
unsigned long lastTelemetryAt = 0;
unsigned long lastAlertAttemptAt = 0;
String lastSentEvent = "BOOT";
unsigned long lastCommandPollAt = 0;
unsigned long lastSocketAttemptAt = 0;
WebSocketsClient deviceSocket;
bool socketConnected = false;
bool socketInitialized = false;
bool socketHandshakePending = false;
bool wifiAnnounced = false;
bool tlsClockStarted = false;
bool tlsConfigurationWarned = false;
uint32_t wifiAttempts = 0;
String lastHandledCommandId;
bool lastHandledCommandApplied = false;
unsigned long identifyStartedAt = 0;
bool identifying = false;

bool applyCommand(const String &payload, String &commandId, String &action);
void acknowledgeCommand(const String &commandId, const String &action, bool applied);

bool secureServer()
{
    return String(SERVER_BASE_URL).startsWith("https://");
}

bool secureTransportReady()
{
    if (!secureServer()) return true;
    if (strlen(AVATAR_SERVER_CA_PEM) == 0)
    {
        if (!tlsConfigurationWarned)
        {
            Serial.println("[TLS] Server CA certificate is missing; remote connection disabled.");
            tlsConfigurationWarned = true;
        }
        return false;
    }
    if (!tlsClockStarted)
    {
        configTime(0, 0, "pool.ntp.org", "time.google.com");
        tlsClockStarted = true;
        Serial.println("[TLS] Synchronising clock for certificate checks.");
    }
    return time(nullptr) > 1700000000;
}

struct DeviceHttpRequest
{
    HTTPClient http;
    WiFiClient clearClient;
    WiFiClientSecure secureClient;

    bool begin(const String &path)
    {
        const String url = String(SERVER_BASE_URL) + path;
        if (secureServer())
        {
            if (!secureTransportReady()) return false;
            secureClient.setCACert(AVATAR_SERVER_CA_PEM);
            return http.begin(secureClient, url);
        }
        return http.begin(clearClient, url);
    }
};

void onSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    if (type == WStype_CONNECTED)
    {
        socketConnected = true;
        socketHandshakePending = false;
        lastTelemetryAt = millis() - TELEMETRY_INTERVAL;
        Serial.println("[WS] Device stream connected.");
    }
    else if (type == WStype_DISCONNECTED)
    {
        socketConnected = false;
        socketHandshakePending = false;
        socketInitialized = false;
        if (payload && length)
            Serial.printf("[WS] Device stream disconnected: %.*s\n",
                          static_cast<int>(min(length, size_t(80))), payload);
        else
            Serial.println("[WS] Device stream disconnected.");
    }
    else if (type == WStype_TEXT)
    {
        JsonDocument message;
        if (deserializeJson(message, payload, length) || message["type"] != "command") return;
        String commandId;
        String action;
        String command;
        serializeJson(message["payload"], command);
        const bool applied = applyCommand(command, commandId, action);
        acknowledgeCommand(commandId, action, applied);
    }
}

void connectSocket(unsigned long now)
{
    const unsigned long retryInterval = secureServer() ? CLOUD_WEBSOCKET_RECONNECT_INTERVAL
                                                        : WEBSOCKET_RECONNECT_INTERVAL;
    if (socketInitialized || !elapsedSince(now, lastSocketAttemptAt, retryInterval))
        return;

    lastSocketAttemptAt = now;
    if (!secureTransportReady()) return;
    String endpoint = SERVER_BASE_URL;
    const bool secure = secureServer();
    endpoint.remove(0, secure ? 8 : 7);
    const int slash = endpoint.indexOf('/');
    if (slash >= 0) endpoint = endpoint.substring(0, slash);
    const int colon = endpoint.lastIndexOf(':');
    const String host = colon >= 0 ? endpoint.substring(0, colon) : endpoint;
    const uint16_t serverPort = colon >= 0 ? endpoint.substring(colon + 1).toInt() : (secure ? 443 : 80);
    const String headers = String("Authorization: Bearer ") + DEVICE_TOKEN;
    if (secure)
        deviceSocket.beginSslWithCA(host.c_str(), serverPort, "/ws/device", AVATAR_SERVER_CA_PEM);
    else
        deviceSocket.begin(host.c_str(), serverPort, "/ws/device");
    deviceSocket.setExtraHeaders(headers.c_str());
    deviceSocket.onEvent(onSocketEvent);
    // The library applies this delay to its very first attempt too. Our own
    // retry scheduler above handles the longer cloud backoff after failures.
    deviceSocket.setReconnectInterval(WEBSOCKET_RECONNECT_INTERVAL);
    deviceSocket.enableHeartbeat(15000, 3000, 2);
    socketInitialized = true;
    socketHandshakePending = true;
}

void setConnectionLed(bool connected)
{
    digitalWrite(STATUS_LED_PIN, connected ? HIGH : LOW);
}

void updateIdentifyLed(unsigned long now)
{
    if (!identifying) return;
    if (now - identifyStartedAt >= 4000)
    {
        identifying = false;
        setConnectionLed(WiFi.status() == WL_CONNECTED);
        return;
    }
    digitalWrite(STATUS_LED_PIN, ((now - identifyStartedAt) / 250) % 2 == 0 ? LOW : HIGH);
}

void connectWifi(unsigned long now)
{
    if (!provisioning::hasCredentials() || provisioning::isConnecting()) return;
    if (!elapsedSince(now, lastWifiAttemptAt, WIFI_RETRY_INTERVAL))
        return;

    lastWifiAttemptAt = now;
#if defined(AVATAR_USE_PRECONFIGURED_WIFI) && AVATAR_USE_PRECONFIGURED_WIFI
    const bool useSecondary = AVATAR_SECONDARY_WIFI_SSID[0] != '\0' &&
                              (wifiAttempts++ % 2 == 1);
    const char *ssid = useSecondary ? AVATAR_SECONDARY_WIFI_SSID : provisioning::ssid().c_str();
    const char *password = useSecondary ? AVATAR_SECONDARY_WIFI_PASSWORD : provisioning::password().c_str();
    Serial.printf("[WIFI] Trying %s configured network...\n", useSecondary ? "secondary" : "primary");
    WiFi.begin(ssid, password);
#else
    Serial.println("[WIFI] Trying saved network...");
    WiFi.begin(provisioning::ssid().c_str(), provisioning::password().c_str());
#endif
}

void addAuthorization(HTTPClient &http)
{
    http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
}

bool sendTelemetry()
{
    SystemState snapshot;
    lockSystemState();
    snapshot = systemState;
    unlockSystemState();

    JsonDocument document;
    document["deviceId"] = DEVICE_ID;
    document["mode"] = SIMULATION_MODE ? "simulation" : "hardware";
    document["hardwareProfile"] = HARDWARE_PROFILE;
    document["uptimeMs"] = millis();
    document["wifiRssi"] = WiFi.RSSI();

    JsonObject readings = document["readings"].to<JsonObject>();
    readings["temperatureC"] = snapshot.sensors.temperatureC;
    readings["humidityPercent"] = snapshot.sensors.humidityPercent;
    readings["soilValid"] = snapshot.sensors.soilValid;
    readings["soilSensorEnabled"] = snapshot.sensors.soilSensorEnabled;
    if (snapshot.sensors.soilSensorEnabled && snapshot.sensors.soilValid)
    {
        readings["soilRaw"] = snapshot.sensors.soilRaw;
        readings["soilDry"] = snapshot.sensors.soilDry;
    }
    if (snapshot.sensors.fireSensorEnabled)
    {
        readings["fireDetected"] = snapshot.sensors.fireDetected;
        readings["fireRawLow"] = snapshot.sensors.fireRawLow;
    }
    readings["fireSensorReady"] = snapshot.sensors.fireSensorReady;
    readings["fireSensorEnabled"] = snapshot.sensors.fireSensorEnabled;
    if (snapshot.sensors.mq6Raw >= 0) readings["mq6Raw"] = snapshot.sensors.mq6Raw;
    if (snapshot.sensors.mq6Digital >= 0) readings["mq6Digital"] = snapshot.sensors.mq6Digital;
    JsonObject probe = readings["probe"].to<JsonObject>();
    JsonObject raw = probe["raw"].to<JsonObject>();
    constexpr const char *names[5] = {"ph", "ec", "nitrogen", "phosphorus", "potassium"};
    uint8_t validCount = 0;
    for (uint8_t index = 0; index < 5; ++index)
    {
        if (snapshot.sensors.probeValid[index] &&
            millis() - snapshot.sensors.probeLastGoodAt[index] <= 180000)
        {
            raw[names[index]] = snapshot.sensors.probeRaw[index];
            ++validCount;
        }
    }
    probe["validCount"] = validCount;
    probe["validated"] = false; // Register scaling and calibration unverified.

    JsonObject outputs = document["outputs"].to<JsonObject>();
    outputs["irrigation"] = snapshot.irrigationActive;
    outputs["irrigationLockout"] = snapshot.irrigationSafetyLockout;
    outputs["fireResponse"] = snapshot.fireActive;
    outputs["fireLockout"] = snapshot.fireSafetyLockout;
    outputs["waterFault"] = snapshot.irrigationSafetyLockout;
    outputs["controllerReady"] = snapshot.controllerReady;
    outputs["manualPumpTest"] = snapshot.manualPump == ManualPump::Fire
        ? "fire" : snapshot.manualPump == ManualPump::Hydration
            ? "hydration" : "none";
    const unsigned long reportedAt = millis();
    outputs["manualPumpRemainingMs"] = manualPumpRunRemaining(
        snapshot.manualPump, reportedAt, snapshot.manualPumpStartedAt);
    outputs["manualPumpCooldownMs"] = manualPumpCooldownRemaining(
        snapshot.manualPumpHasStopped, reportedAt,
        snapshot.manualPumpLastStoppedAt);
    outputs["fireBursts"] = snapshot.fireBursts;
    outputs["waterBursts"] = snapshot.irrigationBursts;
    outputs["fireResting"] = snapshot.fireResting;
    outputs["waterSoaking"] = snapshot.irrigationSoaking;
    outputs["lastEvent"] = snapshot.lastEvent;

    String body;
    if (socketConnected)
    {
        JsonDocument envelope;
        envelope["type"] = "telemetry";
        envelope["payload"].set(document);
        serializeJson(envelope, body);
        if (deviceSocket.sendTXT(body)) return true;
        socketConnected = false;
    }

    serializeJson(document, body);
    DeviceHttpRequest request;
    HTTPClient &http = request.http;
    http.setTimeout(HTTP_TIMEOUT);
    if (!request.begin("/api/device/telemetry"))
        return false;
    addAuthorization(http);
    http.addHeader("Content-Type", "application/json");
    const int status = http.POST(body);

    if (status < 200 || status >= 300)
        Serial.printf("[HTTP] Telemetry failed: %d\n", status);

    http.end();
    return status >= 200 && status < 300;
}

bool applyCommand(const String &payload, String &commandId, String &action)
{
    JsonDocument document;
    if (deserializeJson(document, payload))
    {
        Serial.println("[COMMAND] Invalid JSON received.");
        return false;
    }

    action = String(document["action"] | "");
    commandId = String(document["commandId"] | "");
    const unsigned long now = millis();
    if (!commandId.isEmpty() && commandId == lastHandledCommandId)
        return lastHandledCommandApplied;

    if (!SIMULATION_MODE && (action.startsWith("SIMULATE_") || action == "CLEAR_SIMULATION"))
    {
        Serial.println("[COMMAND] Simulation actions require simulation mode.");
        return false;
    }

    if (action == "PING")
    {
        lastHandledCommandId = commandId;
        lastHandledCommandApplied = true;
        Serial.printf("[COMMAND] Received cloud link test (%s)\n", commandId.c_str());
        return true;
    }

    if (action == "TEST_FIRE_PUMP" || action == "TEST_HYDRATION_PUMP" ||
        action == "STOP_PUMP_TEST")
    {
        lockSystemState();
        const bool applied = action == "STOP_PUMP_TEST" ?
            (manualPumpTest::stop(now), true) : manualPumpTest::start(
                action == "TEST_FIRE_PUMP" ? ManualPump::Fire
                                           : ManualPump::Hydration, now);
        unlockSystemState();
        lastHandledCommandId = commandId;
        lastHandledCommandApplied = applied;
        Serial.printf("[PUMP TEST] %s %s (%s)\n", action.c_str(),
                      applied ? "accepted" : "rejected", commandId.c_str());
        return applied;
    }

    lockSystemState();
    if (action == "SIMULATE_DRY_SOIL")
        simulation::makeSoilDry();
    else if (action == "CLEAR_SIMULATION")
        simulation::clearOverrides();
    else if (action == "LED_ON")
        digitalWrite(STATUS_LED_PIN, HIGH);
    else if (action == "LED_OFF")
        digitalWrite(STATUS_LED_PIN, LOW);
    else if (action == "LED_IDENTIFY")
    {
        identifyStartedAt = now;
        identifying = true;
        digitalWrite(STATUS_LED_PIN, LOW);
    }
    else if (action == "SET_PROFILE")
    {
        JsonObjectConst profile = document["profile"].as<JsonObjectConst>();
        const bool saved = provisioning::saveProfile(
            String(profile["name"] | ""), String(profile["farmerName"] | ""),
            String(profile["crop"] | ""), String(profile["setupAt"] | ""),
            String(profile["revision"] | ""));
        unlockSystemState();
        Serial.printf("[PROFILE] On-chip save %s.\n", saved ? "confirmed" : "failed");
        lastHandledCommandId = commandId;
        lastHandledCommandApplied = saved;
        return saved;
    }
    else
    {
        unlockSystemState();
        Serial.printf("[COMMAND] Rejected unknown action: %s\n", action.c_str());
        return false;
    }
    unlockSystemState();

    lastHandledCommandId = commandId;
    lastHandledCommandApplied = true;
    Serial.printf("[COMMAND] Applied %s (%s)\n", action.c_str(), commandId.c_str());
    return true;
}

void acknowledgeCommand(const String &commandId, const String &action, bool applied)
{
    if (commandId.isEmpty())
        return;

    JsonDocument document;
    document["commandId"] = commandId;
    document["deviceId"] = DEVICE_ID;
    document["action"] = action;
    document["applied"] = applied;

    String body;
    serializeJson(document, body);
    if (socketConnected)
    {
        JsonDocument envelope;
        envelope["type"] = "command-ack";
        envelope["payload"].set(document);
        String frame;
        serializeJson(envelope, frame);
        if (deviceSocket.sendTXT(frame)) return;
        socketConnected = false;
    }

    DeviceHttpRequest request;
    HTTPClient &http = request.http;
    http.setTimeout(HTTP_TIMEOUT);
    if (!request.begin("/api/device/commands/ack")) return;
    addAuthorization(http);
    http.addHeader("Content-Type", "application/json");
    const int status = http.POST(body);
    if (status < 200 || status >= 300)
        Serial.printf("[HTTP] Command acknowledgement failed: %d\n", status);

    http.end();
}

void pollCommand()
{
    DeviceHttpRequest request;
    HTTPClient &http = request.http;
    http.setTimeout(HTTP_TIMEOUT);

    if (!request.begin(String("/api/device/commands/next?deviceId=") + DEVICE_ID))
        return;

    addAuthorization(http);
    const int status = http.GET();
    if (status == HTTP_CODE_OK)
    {
        const String payload = http.getString();
        http.end();

        String commandId;
        String action;
        const bool applied = applyCommand(payload, commandId, action);
        acknowledgeCommand(commandId, action, applied);
        return;
    }
    else if (status != HTTP_CODE_NO_CONTENT)
        Serial.printf("[HTTP] Command poll failed: %d\n", status);

    http.end();
}
}

namespace connectivity
{
void begin()
{
    pinMode(STATUS_LED_PIN, OUTPUT);
    setConnectionLed(false);
    provisioning::begin();
    // Retry is scheduled below. Automatic retries can outlive a failed setup
    // attempt and keep the radio too busy for the setup page's network scan.
    WiFi.setAutoReconnect(false);
    lastWifiAttemptAt = millis() - WIFI_RETRY_INTERVAL;
    lastTelemetryAt = millis() - TELEMETRY_INTERVAL;
    lastSocketAttemptAt = millis() - (secureServer() ? CLOUD_WEBSOCKET_RECONNECT_INTERVAL
                                                    : WEBSOCKET_RECONNECT_INTERVAL);
    wifiAttempts = 0;
}

void update(unsigned long now)
{
    provisioning::update(now);
    updateIdentifyLed(now);
    if (WiFi.status() != WL_CONNECTED)
    {
        setConnectionLed(false);
        if (wifiAnnounced)
        {
            wifiAnnounced = false;
            socketConnected = false;
            socketHandshakePending = false;
            deviceSocket.disconnect();
            socketInitialized = false;
            Serial.println("[WIFI] Connection lost; local control continues.");
        }
        connectWifi(now);
        return;
    }

    if (!wifiAnnounced)
    {
        wifiAnnounced = true;
        wifiAttempts = 0;
        setConnectionLed(true);
        Serial.printf("[WIFI] Connected. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
    }

    if (!secureTransportReady()) return;
    connectSocket(now);
    if (socketInitialized)
    {
        const unsigned long socketLoopStartedAt = millis();
        deviceSocket.loop();
        const unsigned long socketLoopDuration = millis() - socketLoopStartedAt;
        if (socketLoopDuration > 1000)
            Serial.printf("[WS] Connection attempt took %lu ms; connected=%s.\n",
                          socketLoopDuration, socketConnected ? "yes" : "no");
    }
    // Let the header reply arrive before starting another blocking HTTPS
    // request. WebSocketsClient otherwise times out before it reads the reply.
    if (socketHandshakePending && !elapsedSince(millis(), lastSocketAttemptAt,
                                                WEBSOCKET_HANDSHAKE_GRACE_INTERVAL))
        return;
    if (socketHandshakePending)
    {
        deviceSocket.disconnect();
        socketHandshakePending = false;
        socketInitialized = false;
        Serial.println("[WS] Handshake timed out; using HTTPS fallback.");
    }
    String eventNow;
    lockSystemState();
    eventNow = systemState.lastEvent;
    unlockSystemState();
    const bool urgentEvent = eventNow != "BOOT" && eventNow != lastSentEvent;
    if (urgentEvent && elapsedSince(now, lastAlertAttemptAt, 2000))
    {
        lastAlertAttemptAt = now;
        if (sendTelemetry())
        {
            lastTelemetryAt = now;
            lastSentEvent = eventNow;
        }
    }
    else if (elapsedSince(now, lastTelemetryAt, TELEMETRY_INTERVAL))
    {
        lastTelemetryAt = now;
        if (sendTelemetry()) lastSentEvent = eventNow;
    }

    if (!socketConnected && elapsedSince(now, lastCommandPollAt, COMMAND_POLL_INTERVAL))
    {
        lastCommandPollAt = now;
        pollCommand();
    }
}

bool isConnected()
{
    return WiFi.status() == WL_CONNECTED;
}
}
