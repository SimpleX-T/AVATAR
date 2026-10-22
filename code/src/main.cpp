#include <Arduino.h>

#include "climate.h"
#include "config.h"
#include "connectivity.h"
#include "fire.h"
#include "helpers.h"
#include "irrigation.h"
#include "manual_pump_test.h"
#include "pump.h"
#include "provisioning.h"
#include "servo.h"
#include "simulation.h"
#include "soil_probe.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long lastStatusAt = 0;

void networkTask(void *)
{
    for (;;)
    {
        connectivity::update(millis());
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void printCommandHelp()
{
    Serial.println("Commands: f=fire pump 3s, i=hydration pump 3s, t=stop test, x=stop and lock, r=reset locks, s=status, p=setup Wi-Fi");
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
            lockSystemState();
            printSystemStatus();
            unlockSystemState();
            break;
        case 'x':
        case 'X':
            lockSystemState();
            if (SIMULATION_MODE)
            {
                simulation::clearOverrides();
                Serial.println("[CONTROL] Simulation overrides cleared.");
            }
            else
            {
                manualPumpTest::stop(now);
                irrigation::emergencyStop();
                fireControl::emergencyStop();
                Serial.println("[CONTROL] Pump outputs stopped and locked.");
            }
            unlockSystemState();
            break;
        case 'f':
        case 'F':
        case 'i':
        case 'I':
            lockSystemState();
            Serial.printf("[PUMP TEST] %s request %s.\n",
                          command == 'f' || command == 'F' ? "fire" : "hydration",
                          manualPumpTest::start(
                              command == 'f' || command == 'F'
                                  ? ManualPump::Fire : ManualPump::Hydration,
                              now) ? "accepted" : "rejected");
            unlockSystemState();
            break;
        case 't':
        case 'T':
            lockSystemState();
            manualPumpTest::stop(now);
            unlockSystemState();
            Serial.println("[PUMP TEST] Stopped.");
            break;
        case 'r':
        case 'R':
            lockSystemState();
            fireControl::resetSafetyLockout();
            irrigation::resetSafetyLockout();
            unlockSystemState();
            break;
        case 'p':
        case 'P':
            provisioning::requestSetup();
            Serial.println("[SETUP] Protected setup Wi-Fi requested from physical Serial console.");
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

    if (!initializeSystemStateLock())
    {
        Serial.println("[FATAL] Could not create controller state lock.");
        while (true)
            delay(1000);
    }

    connectivity::begin();

    if (SIMULATION_MODE)
    {
        simulation::begin();
    }
    else
    {
        pump::begin();
        fireServo::begin();
        climate::begin();
        fireControl::begin();
        irrigation::begin();
        soilProbe::begin();
    }

    Serial.printf("\nProject AVATAR controller ready (%s mode).\n",
                  SIMULATION_MODE ? "simulation" : "hardware");
    printCommandHelp();

    if (xTaskCreatePinnedToCore(networkTask, "avatar-network", 12288,
                                nullptr, 1, nullptr, 0) != pdPASS)
    {
        Serial.println("[FATAL] Could not start network task.");
        pump::allOff();
        while (true)
            delay(1000);
    }
}

void loop()
{
    const unsigned long now = millis();

    lockSystemState();
    if (SIMULATION_MODE)
    {
        simulation::update(now);
    }
    else
    {
        climate::update(now);
        fireControl::update(now);
        systemState.controllerReady =
            now >= 10000 && systemState.sensors.fireSensorReady;
        irrigation::update(now);
        manualPumpTest::update(now);
    }
    unlockSystemState();
    handleSerial(now);

    if (elapsedSince(now, lastStatusAt, STATUS_PRINT_INTERVAL))
    {
        lastStatusAt = now;
        lockSystemState();
        printSystemStatus();
        unlockSystemState();
    }
}
