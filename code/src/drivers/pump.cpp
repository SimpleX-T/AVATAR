#include <Arduino.h>

#include "pins.h"
#include "pump.h"
#include "config.h"

namespace pump
{

void begin()
{
    pinMode(FIRE_PUMP_PIN, OUTPUT);
    pinMode(FIRE_VALVE_PIN, OUTPUT);
    pinMode(IRRIGATION_PUMP_PIN, OUTPUT);
    pinMode(IRRIGATION_VALVE_PIN, OUTPUT);
    pinMode(CHEMIGATION_PUMP_PIN, OUTPUT);
    pinMode(CHEMIGATION_VALVE_PIN, OUTPUT);

    allOff();
}

void fireOn()
{
    if (!ENABLE_PHYSICAL_OUTPUTS)
        return;
    digitalWrite(FIRE_PUMP_PIN, HIGH);
}

void fireOff()
{
    digitalWrite(FIRE_PUMP_PIN, LOW);
}

void valveOn()
{
    if (!ENABLE_PHYSICAL_OUTPUTS)
        return;
    digitalWrite(FIRE_VALVE_PIN, HIGH);
}

void valveOff()
{
    digitalWrite(FIRE_VALVE_PIN, LOW);
}

void irrigationOn()
{
    if (!ENABLE_PHYSICAL_OUTPUTS)
        return;
    digitalWrite(IRRIGATION_VALVE_PIN, HIGH);
    digitalWrite(IRRIGATION_PUMP_PIN, HIGH);
}

void irrigationOff()
{
    digitalWrite(IRRIGATION_PUMP_PIN, LOW);
    digitalWrite(IRRIGATION_VALVE_PIN, LOW);
}

void chemigationOn()
{
    if (!ENABLE_PHYSICAL_OUTPUTS)
        return;
    digitalWrite(CHEMIGATION_VALVE_PIN, HIGH);
    digitalWrite(CHEMIGATION_PUMP_PIN, HIGH);
}

void chemigationOff()
{
    digitalWrite(CHEMIGATION_PUMP_PIN, LOW);
    digitalWrite(CHEMIGATION_VALVE_PIN, LOW);
}

void allOff()
{
    fireOff();
    valveOff();
    irrigationOff();
    chemigationOff();
}

}
