#include <Arduino.h>

#include "config.h"
#include "pins.h"
#include "pump.h"

namespace
{
void prepareOutput(uint8_t pin)
{
    digitalWrite(pin, LOW);
    pinMode(pin, OUTPUT);
}
}

namespace pump
{

void begin()
{
    prepareOutput(FIRE_PUMP_IN1_PIN);
    prepareOutput(FIRE_PUMP_IN2_PIN);
    prepareOutput(IRRIGATION_PUMP_IN3_PIN);
    prepareOutput(IRRIGATION_PUMP_IN4_PIN);

    allOff();
}

bool fireOn()
{
    if (!ENABLE_PUMP_OUTPUTS)
        return false;
    digitalWrite(FIRE_PUMP_IN2_PIN, LOW);
    digitalWrite(FIRE_PUMP_IN1_PIN, HIGH);
    return true;
}

void fireOff()
{
    digitalWrite(FIRE_PUMP_IN1_PIN, LOW);
    digitalWrite(FIRE_PUMP_IN2_PIN, LOW);
}

bool irrigationOn()
{
    if (!ENABLE_PUMP_OUTPUTS)
        return false;
    digitalWrite(IRRIGATION_PUMP_IN4_PIN, LOW);
    digitalWrite(IRRIGATION_PUMP_IN3_PIN, HIGH);
    return true;
}

void irrigationOff()
{
    digitalWrite(IRRIGATION_PUMP_IN3_PIN, LOW);
    digitalWrite(IRRIGATION_PUMP_IN4_PIN, LOW);
}

void allOff()
{
    fireOff();
    irrigationOff();
}

}
