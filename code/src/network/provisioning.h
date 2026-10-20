#pragma once
#include <Arduino.h>

namespace provisioning
{
bool begin();
void update(unsigned long now);
bool hasCredentials();
bool isConnecting();
const String &ssid();
const String &password();
void requestSetup(); // Physical Serial recovery; never exposed as a remote command.
bool saveProfile(const String &name, const String &farmerName,
                 const String &crop, const String &setupAt, const String &revision);
}
