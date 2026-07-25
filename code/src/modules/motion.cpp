#include <Arduino.h>

#include "buzzer.h"
#include "config.h"
#include "motion.h"
#include "pins.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long alarmStartedAt = 0;
unsigned long lastToggleAt = 0;
unsigned long lastAlarmEndedAt = 0;
}

namespace motion
{
void begin()
{
    pinMode(PIR_PIN, INPUT);
}

void update(unsigned long now)
{
    systemState.sensors.motionDetected = digitalRead(PIR_PIN) == HIGH;

    if (!systemState.deterrentActive &&
        systemState.sensors.motionDetected &&
        elapsedSince(now, lastAlarmEndedAt, MOTION_RETRIGGER_GUARD))
    {
        systemState.deterrentActive = true;
        alarmStartedAt = now;
        lastToggleAt = now;
        buzzer::on();
        Serial.println("[MOTION] Movement detected; deterrent started.");
    }

    if (!systemState.deterrentActive)
        return;

    if (elapsedSince(now, alarmStartedAt, MOTION_ALARM_TIME))
    {
        stop();
        lastAlarmEndedAt = now;
        Serial.println("[MOTION] Deterrent cycle complete.");
        return;
    }

    if (elapsedSince(now, lastToggleAt, BUZZER_TOGGLE_INTERVAL))
    {
        lastToggleAt = now;
        buzzer::isOn() ? buzzer::off() : buzzer::on();
    }
}

void stop()
{
    buzzer::off();
    systemState.deterrentActive = false;
}
}
