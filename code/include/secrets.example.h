#pragma once

// Copy this file to secrets.h and replace the example values.
// Never commit secrets.h.
// Use your computer's LAN address, not localhost. Example:
// http://192.168.1.25:8787
constexpr char SERVER_BASE_URL[] = "http://YOUR_COMPUTER_IP:8787";

// For a public backend, use https://YOUR-SERVICE.onrender.com above and copy
// server_ca.example.h to server_ca.h with the verified root CA certificate.
// Hosted HTTPS requests are disabled until that certificate is present.

constexpr char DEVICE_ID[] = "project-avatar-001";
constexpr char DEVICE_TOKEN[] = "replace-with-the-token-from-server-config";

// Set to 1 to bypass phone provisioning and connect automatically at boot.
// Keep your real network credentials in the ignored secrets.h only.
#define AVATAR_USE_PRECONFIGURED_WIFI 0
constexpr char WIFI_SSID[] = "YOUR_WIFI_NAME";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";

// Optional second 2.4 GHz network for the direct Wi-Fi build. The ESP32
// alternates between primary and secondary after a failed join; leave these
// empty if only one network is available.
#define AVATAR_SECONDARY_WIFI_SSID ""
#define AVATAR_SECONDARY_WIFI_PASSWORD ""
