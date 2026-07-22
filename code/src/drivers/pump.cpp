#include <Arduino.h>

#include "pins.h"

namespace pump
{

void begin()
{
    pinMode(FIRE_PUMP_PIN, OUTPUT);
    pinMode(FIRE_VALVE_PIN, OUTPUT);

    fireOff();
    valveOff();
}

void fireOn()
{
    digitalWrite(FIRE_PUMP_PIN, HIGH);
}

void fireOff()
{
    digitalWrite(FIRE_PUMP_PIN, LOW);
}

void valveOn()
{
    digitalWrite(FIRE_VALVE_PIN, HIGH);
}

void valveOff()
{
    digitalWrite(FIRE_VALVE_PIN, LOW);
}

}