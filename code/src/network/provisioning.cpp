#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_system.h>

#include "provisioning_policy.h"
#include "provisioning.h"
#include "secrets.h"

namespace
{
Preferences settings;
WebServer portal(80);
String savedSsid;
String savedPassword;
String setupSsid;
String setupPassword;
String candidateSsid;
String candidatePassword;
String setupStatus = "Choose a 2.4 GHz network to connect this greenhouse.";
unsigned long connectedAt = 0;
bool initialized = false;
bool portalActive = false;
bool routesRegistered = false;
volatile bool setupRequested = false;

constexpr uint32_t CONNECTION_TIMEOUT_MS = 60000;
constexpr unsigned long PORTAL_CLOSE_DELAY_MS = 30000;
ProvisioningJoin join(CONNECTION_TIMEOUT_MS);

const char page[] PROGMEM = R"AVATAR(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AVATAR · Connect greenhouse</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#e8efe5;color:#162b21;font:16px/1.5 system-ui,sans-serif}main{max-width:650px;margin:0 auto;padding:30px 20px 60px}h1{font:700 clamp(32px,7vw,50px)/1.05 Georgia,serif;letter-spacing:-.035em}h2{font:700 23px Georgia,serif}.card{padding:24px;border:2px solid #163c2e;background:#fffdf5;box-shadow:6px 6px 0 #163c2e}label{display:block;margin:17px 0 6px;font-weight:700}input,select,button{width:100%;min-height:48px;padding:10px 12px;border:2px solid #163c2e;font:inherit}button{margin-top:20px;background:#b9e99b;font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:wait}:focus-visible{outline:3px solid #f5b849;outline-offset:2px}#status{min-height:3em;padding:12px;background:#e7f2df}.hint{color:#4e6658;font-size:14px}
</style></head><body><main><p>PROJECT AVATAR / STEP 1 OF 2</p><h1>Connect your greenhouse</h1><p>Your sensors and local protection keep working without internet. Connect to your home Wi-Fi to save readings online.</p><section class="card"><h2>Choose your 2.4 GHz network</h2><p class="hint">Your phone may say this AVATAR network has no internet. Stay connected until the setup is complete.</p><button id="scan" type="button">Find nearby networks</button><label for="network">Network name</label><select id="network"><option value="">Choose a network</option></select><label for="manual">Or type its exact name</label><input id="manual" maxlength="32" autocomplete="off"><label for="password">Home Wi-Fi password</label><input id="password" type="password" maxlength="63" autocomplete="new-password"><button id="save" type="button">Connect and save</button><p id="status" role="status" aria-live="polite">Starting setup…</p><p id="dashboard" hidden></p></section><p class="hint">After connection, return your phone to your home Wi-Fi and open the main AVATAR dashboard to name your greenhouse. If this fails, your previous network is kept.</p></main><script>
const $=id=>document.getElementById(id);
async function poll(){try{const r=await fetch('/api/status');const s=await r.json();$('status').textContent=s.message;if(s.setupComplete){const link=document.createElement('a');link.href=s.dashboardUrl;link.textContent='Open main dashboard';$('dashboard').replaceChildren(link);$('dashboard').hidden=false}else{$('dashboard').hidden=true;$('dashboard').replaceChildren()}}catch{$('status').textContent='Setup connection was interrupted. Rejoin the AVATAR network if needed.';$('dashboard').hidden=true}}
$('scan').onclick=async()=>{const b=$('scan');b.disabled=true;$('status').textContent='Looking for 2.4 GHz networks…';try{const r=await fetch('/api/networks');const data=await r.json();if(!r.ok)throw new Error(data.error||'Scan failed. Try again.');$('network').replaceChildren(new Option('Choose a network',''));for(const item of data.networks)$('network').add(new Option(item.ssid+' · '+item.signal+' dBm',item.ssid));$('status').textContent=data.networks.length?'Choose your network, then enter its password.':'No networks found. You can type the name manually.'}catch(e){$('status').textContent=e.message||'Scan failed. Type your network name manually.'}finally{b.disabled=false}};
$('save').onclick=async()=>{const ssid=$('manual').value.trim()||$('network').value;const password=$('password').value;if(!ssid){$('status').textContent='Choose or type a network name first.';return}const b=$('save');b.disabled=true;$('status').textContent='Trying the network. This may take up to 60 seconds…';try{const r=await fetch('/api/network',{method:'POST',headers:{'Content-Type':'application/json','X-AVATAR-Setup':'1'},body:JSON.stringify({ssid,password})});const data=await r.json();$('status').textContent=data.message||data.error||'Could not start connection.'}catch{$('status').textContent='Connection to the ESP32 was interrupted. Rejoin its network and check status.'}finally{b.disabled=false}};
poll();setInterval(poll,2000);
</script></body></html>)AVATAR";

void sendJson(int status, JsonDocument &document)
{
    String body;
    serializeJson(document, body);
    portal.sendHeader("Cache-Control", "no-store");
    portal.send(status, "application/json", body);
}

bool fromSetupNetwork()
{
    // The portal must not become a password-changing page on the home LAN
    // during the short AP+STA overlap after successful provisioning.
    if (portalActive && portal.client().localIP() == WiFi.softAPIP()) return true;
    portal.send(403, "text/plain", "Connect to the protected AVATAR setup Wi-Fi.");
    return false;
}

void routes()
{
    const char *headers[] = {"X-AVATAR-Setup"};
    portal.collectHeaders(headers, 1);
    portal.on("/", HTTP_GET, []() {
        if (!fromSetupNetwork()) return;
        portal.sendHeader("Cache-Control", "no-store");
        portal.sendHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'");
        portal.sendHeader("X-Content-Type-Options", "nosniff");
        portal.send(200, "text/html; charset=utf-8", page);
    });
    portal.on("/api/status", HTTP_GET, []() {
        if (!fromSetupNetwork()) return;
        JsonDocument response;
        const bool connectedToSaved = WiFi.status() == WL_CONNECTED &&
                                      WiFi.SSID() == savedSsid;
        const bool complete = join.dashboardReady(connectedToSaved);
        response["connected"] = WiFi.status() == WL_CONNECTED;
        response["connecting"] = join.isTrying();
        response["setupComplete"] = complete;
        response["message"] = !complete && connectedAt
                                  ? "Wi-Fi details were saved, but the home connection dropped. Check the router."
                                  : setupStatus;
        response["dashboardUrl"] = SERVER_BASE_URL;
        sendJson(200, response);
    });
    portal.on("/api/networks", HTTP_GET, []() {
        if (!fromSetupNetwork()) return;
        if (join.isTrying())
        {
            JsonDocument busy;
            busy["error"] = "Connection in progress. Wait before scanning again.";
            return sendJson(409, busy);
        }
        JsonDocument response;
        JsonArray networks = response["networks"].to<JsonArray>();
        const int count = WiFi.scanNetworks();
        if (count < 0)
        {
            JsonDocument failure;
            failure["error"] = "Wi-Fi scan failed while the radio was busy. Wait a moment and try again.";
            failure["scanCode"] = count;
            return sendJson(503, failure);
        }
        for (int i = 0; i < count && i < 30; ++i)
        {
            const String name = WiFi.SSID(i);
            if (name.isEmpty()) continue;
            JsonObject item = networks.add<JsonObject>();
            item["ssid"] = name;
            item["signal"] = WiFi.RSSI(i);
        }
        WiFi.scanDelete();
        sendJson(200, response);
    });
    portal.on("/api/network", HTTP_POST, []() {
        if (!fromSetupNetwork()) return;
        JsonDocument request;
        JsonDocument response;
        if (portal.header("X-AVATAR-Setup") != "1")
        {
            response["error"] = "Open this form from the AVATAR setup page.";
            return sendJson(403, response);
        }
        if (deserializeJson(request, portal.arg("plain")))
        {
            response["error"] = "Invalid request. Please try again.";
            return sendJson(400, response);
        }
        const String ssid = request["ssid"].as<String>();
        const String password = request["password"].as<String>();
        if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 63)
        {
            response["error"] = "Network name or password length is invalid.";
            return sendJson(400, response);
        }
        if (join.isTrying())
        {
            response["error"] = "A connection attempt is already running.";
            return sendJson(409, response);
        }
        candidateSsid = ssid;
        candidatePassword = password;
        connectedAt = 0;
        join.begin(millis());
        setupStatus = "Trying the selected network. Keep your phone on AVATAR Wi-Fi.";
        WiFi.begin(candidateSsid.c_str(), candidatePassword.c_str());
        response["message"] = setupStatus;
        sendJson(202, response);
    });
    portal.onNotFound([]() { portal.send(404, "text/plain", "Not found"); });
}

bool startPortal()
{
    if (portalActive) return true;
    if (!initialized) return false;
    WiFi.mode(WIFI_AP_STA);
    setupSsid = "AVATAR-" + WiFi.macAddress().substring(9);
    setupSsid.replace(":", "");
    if (!WiFi.softAP(setupSsid.c_str(), setupPassword.c_str(), 1, 0, 1))
    {
        Serial.println("[SETUP] Could not start protected setup Wi-Fi.");
        return false;
    }
    if (!routesRegistered)
    {
        routes();
        routesRegistered = true;
    }
    portal.begin();
    portalActive = true;
    connectedAt = 0;
    Serial.printf("[SETUP] Wi-Fi name: %s | address: http://192.168.4.1\n", setupSsid.c_str());
    Serial.printf("[SETUP] WPA2 password for device label: %s\n", setupPassword.c_str());
    return true;
}
}

namespace provisioning
{
bool begin()
{
    if (!settings.begin("avatar", false))
    {
        Serial.println("[SETUP] NVS unavailable; no setup network opened.");
        return false;
    }
    WiFi.persistent(false); // Preferences is the only source of saved credentials.
    WiFi.mode(WIFI_STA); // Enable RF entropy before generating the per-device passphrase.
    setupPassword = settings.getString("ap_pass", "");
    if (setupPassword.length() != 12)
    {
        static constexpr char alphabet[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        setupPassword = "";
        for (int i = 0; i < 12; ++i)
            setupPassword += alphabet[esp_random() % (sizeof(alphabet) - 1)];
        if (settings.putString("ap_pass", setupPassword) != setupPassword.length())
        {
            Serial.println("[SETUP] Could not persist unique AP password; setup disabled.");
            return false;
        }
    }
    const String stored = settings.getString("wifi", "");
    JsonDocument wifi;
    if (deserializeJson(wifi, stored) == DeserializationError::Ok)
    {
        savedSsid = wifi["ssid"].as<String>();
        savedPassword = wifi["password"].as<String>();
    }
#if defined(AVATAR_USE_PRECONFIGURED_WIFI) && AVATAR_USE_PRECONFIGURED_WIFI
    // Deadline/demo fallback: the ignored build configuration overrides NVS.
    // Keep Preferences open for farm-profile persistence, without starting AP.
    savedSsid = WIFI_SSID;
    savedPassword = WIFI_PASSWORD;
    if (savedSsid.isEmpty() || savedSsid == "YOUR_WIFI_NAME")
    {
        Serial.println("[SETUP] Direct Wi-Fi enabled, but network name is not configured.");
        return false;
    }
    Serial.println("[SETUP] Direct Wi-Fi configured; joining automatically without the setup portal.");
#endif
    initialized = true;
    if (savedSsid.isEmpty()) startPortal();
    return true;
}

void update(unsigned long now)
{
    if (!initialized) return;
    if (setupRequested)
    {
        setupRequested = false;
        startPortal();
    }
    if (portalActive) portal.handleClient();
    if (join.isTrying())
    {
        const bool connectedToCandidate = WiFi.status() == WL_CONNECTED &&
                                          WiFi.SSID() == candidateSsid;
        const auto event = join.observe(now, connectedToCandidate);
        if (event == ProvisioningJoin::Event::SaveCredentials)
        {
            JsonDocument wifi;
            wifi["ssid"] = candidateSsid;
            wifi["password"] = candidatePassword;
            String stored;
            serializeJson(wifi, stored);
            if (settings.putString("wifi", stored) == stored.length())
            {
                savedSsid = candidateSsid;
                savedPassword = candidatePassword;
                join.markSaved();
                setupStatus = "Connected and saved. Return your phone to home Wi-Fi, then open the AVATAR dashboard.";
                connectedAt = now;
                Serial.printf("[SETUP] Home Wi-Fi saved. ESP32 IP: %s\n", WiFi.localIP().toString().c_str());
            }
            else
            {
                join.markFailed();
                WiFi.disconnect(false, false);
                setupStatus = "Connected, but could not save Wi-Fi details. Retry before power-off.";
            }
            candidatePassword = "";
        }
        else if (event == ProvisioningJoin::Event::StopAttempt)
        {
            WiFi.disconnect(false, false);
            candidatePassword = "";
            setupStatus = "Could not connect within 60 seconds. Check the Wi-Fi password and signal, then retry.";
            if (!savedSsid.isEmpty()) WiFi.begin(savedSsid.c_str(), savedPassword.c_str());
            Serial.println("[SETUP] Candidate connection failed; prior network retained.");
        }
    }
    if (portalActive && connectedAt && now - connectedAt >= PORTAL_CLOSE_DELAY_MS)
    {
        portal.stop();
        WiFi.softAPdisconnect(true);
        WiFi.mode(WIFI_STA);
        portalActive = false;
        Serial.println("[SETUP] Temporary setup Wi-Fi closed.");
    }
}

bool hasCredentials() { return !savedSsid.isEmpty(); }
bool isConnecting() { return join.isTrying(); }
const String &ssid() { return savedSsid; }
const String &password() { return savedPassword; }
void requestSetup() { setupRequested = true; }

bool saveProfile(const String &name, const String &farmerName,
                 const String &crop, const String &setupAt, const String &revision)
{
    if (!initialized || name.length() < 2 || name.length() > 80 ||
        farmerName.length() < 2 || farmerName.length() > 80 ||
        crop.length() > 80 || setupAt.isEmpty() || revision.isEmpty()) return false;
    JsonDocument profile;
    profile["name"] = name;
    profile["farmerName"] = farmerName;
    profile["crop"] = crop;
    profile["setupAt"] = setupAt;
    profile["revision"] = revision;
    String stored;
    serializeJson(profile, stored);
    return settings.putString("profile", stored) == stored.length();
}
}
