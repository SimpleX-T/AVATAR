#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

#include "config.h"
#include "connectivity.h"
#include "pins.h"
#include "secrets.h"
#include "simulation.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long lastWifiAttemptAt = 0;
unsigned long lastTelemetryAt = 0;
unsigned long lastCommandPollAt = 0;

void setConnectionLed(bool connected)
{
    digitalWrite(ONBOARD_LED_PIN, connected ? HIGH : LOW);
}

void connectWifi(unsigned long now)
{
    if (!elapsedSince(now, lastWifiAttemptAt, WIFI_RETRY_INTERVAL))
        return;

    lastWifiAttemptAt = now;
    Serial.printf("[WIFI] Connecting to %s...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void addAuthorization(HTTPClient &http)
{
    http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
}

void sendTelemetry()
{
    HTTPClient http;
    const String url = String(SERVER_BASE_URL) + "/api/device/telemetry";
    http.setTimeout(HTTP_TIMEOUT);

    if (!http.begin(url))
        return;

    addAuthorization(http);
    http.addHeader("Content-Type", "application/json");

    JsonDocument document;
    document["deviceId"] = DEVICE_ID;
    document["mode"] = SIMULATION_MODE ? "simulation" : "hardware";
    document["uptimeMs"] = millis();
    document["wifiRssi"] = WiFi.RSSI();

    JsonObject readings = document["readings"].to<JsonObject>();
    readings["temperatureC"] = systemState.sensors.temperatureC;
    readings["humidityPercent"] = systemState.sensors.humidityPercent;
    readings["soilRaw"] = systemState.sensors.soilRaw;
    readings["lightRaw"] = systemState.sensors.lightRaw;
    readings["motionDetected"] = systemState.sensors.motionDetected;
    readings["flameLeftRaw"] = systemState.sensors.flameLeftRaw;
    readings["flameCenterRaw"] = systemState.sensors.flameCenterRaw;
    readings["flameRightRaw"] = systemState.sensors.flameRightRaw;

    JsonObject outputs = document["outputs"].to<JsonObject>();
    outputs["irrigation"] = systemState.irrigationActive;
    outputs["chemigation"] = systemState.chemigationActive;
    outputs["deterrent"] = systemState.deterrentActive;
    outputs["fireResponse"] = systemState.fireActive;
    outputs["fireLockout"] = systemState.fireSafetyLockout;

    String body;
    serializeJson(document, body);
    const int status = http.POST(body);

    if (status < 200 || status >= 300)
        Serial.printf("[HTTP] Telemetry failed: %d\n", status);

    http.end();
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

    if (action == "SIMULATE_MOTION")
        simulation::triggerMotion(now);
    else if (action == "SIMULATE_DRY_SOIL")
        simulation::makeSoilDry();
    else if (action == "CLEAR_SIMULATION")
        simulation::clearOverrides();
    else if (action == "LED_ON")
        digitalWrite(ONBOARD_LED_PIN, HIGH);
    else if (action == "LED_OFF")
        digitalWrite(ONBOARD_LED_PIN, LOW);
    else
    {
        Serial.printf("[COMMAND] Rejected unknown action: %s\n", action.c_str());
        return false;
    }

    Serial.printf("[COMMAND] Applied %s (%s)\n", action.c_str(), commandId.c_str());
    return true;
}

void acknowledgeCommand(const String &commandId, const String &action, bool applied)
{
    if (commandId.isEmpty())
        return;

    HTTPClient http;
    const String url = String(SERVER_BASE_URL) + "/api/device/commands/ack";
    http.setTimeout(HTTP_TIMEOUT);

    if (!http.begin(url))
        return;

    addAuthorization(http);
    http.addHeader("Content-Type", "application/json");

    JsonDocument document;
    document["commandId"] = commandId;
    document["deviceId"] = DEVICE_ID;
    document["action"] = action;
    document["applied"] = applied;

    String body;
    serializeJson(document, body);
    const int status = http.POST(body);
    if (status < 200 || status >= 300)
        Serial.printf("[HTTP] Command acknowledgement failed: %d\n", status);

    http.end();
}

void pollCommand()
{
    HTTPClient http;
    const String url =
        String(SERVER_BASE_URL) + "/api/device/commands/next?deviceId=" + DEVICE_ID;
    http.setTimeout(HTTP_TIMEOUT);

    if (!http.begin(url))
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
    pinMode(ONBOARD_LED_PIN, OUTPUT);
    setConnectionLed(false);
    WiFi.setAutoReconnect(true);
    lastWifiAttemptAt = millis() - WIFI_RETRY_INTERVAL;
}

void update(unsigned long now)
{
    if (WiFi.status() != WL_CONNECTED)
    {
        setConnectionLed(false);
        connectWifi(now);
        return;
    }

    static bool announcedConnection = false;
    if (!announcedConnection)
    {
        announcedConnection = true;
        setConnectionLed(true);
        Serial.printf("[WIFI] Connected. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
    }

    if (elapsedSince(now, lastTelemetryAt, TELEMETRY_INTERVAL))
    {
        lastTelemetryAt = now;
        sendTelemetry();
    }

    if (elapsedSince(now, lastCommandPollAt, COMMAND_POLL_INTERVAL))
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
