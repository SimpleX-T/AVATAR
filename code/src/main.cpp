#include <Arduino.h>

#include "buzzer.h"
#include "climate.h"
#include "config.h"
#include "fire.h"
#include "helpers.h"
#include "irrigation.h"
#include "led.h"
#include "motion.h"
#include "pump.h"
#include "servo.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long lastStatusAt = 0;

void printCommandHelp()
{
    Serial.println("Commands: s=status, c=timed chemigation, x=stop fluids/alarm, r=reset fire lockout");
}

void handleSerial(unsigned long now)
{
    while (Serial.available() > 0)
    {
        const char command = static_cast<char>(Serial.read());
        switch (command)
        {
        case 's':
        case 'S':
            printSystemStatus();
            break;
        case 'c':
        case 'C':
            if (!irrigation::startChemigation(now))
                Serial.println("[CHEMIGATION] Request rejected: another operation or safety lockout is active.");
            break;
        case 'x':
        case 'X':
            irrigation::emergencyStop();
            motion::stop();
            Serial.println("[CONTROL] Irrigation, chemigation and deterrent stopped.");
            break;
        case 'r':
        case 'R':
            fireControl::resetSafetyLockout();
            break;
        case '?':
            printCommandHelp();
            break;
        default:
            break;
        }
    }
}
}

void setup()
{
    Serial.begin(SERIAL_BAUD);

    led::begin();
    pump::begin();
    buzzer::begin();
    fireServo::begin();
    climate::begin();
    fireControl::begin();
    irrigation::begin();
    motion::begin();

    led::on();
    Serial.println("\nOff-grid smart agriculture controller ready.");
    printCommandHelp();
}

void loop()
{
    const unsigned long now = millis();

    climate::update(now);
    motion::update(now);
    irrigation::update(now);
    fireControl::update(now);
    handleSerial(now);

    if (elapsedSince(now, lastStatusAt, STATUS_PRINT_INTERVAL))
    {
        lastStatusAt = now;
        printSystemStatus();
    }
}
