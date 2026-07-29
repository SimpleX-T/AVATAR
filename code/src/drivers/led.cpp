#include <Arduino.h>
#include "led.h"
#include "config.h"
#include "pins.h"

namespace led
{
    void begin()
    {
        pinMode(LED_PIN, OUTPUT);
        off();
    }

void on()
{
    if (!ENABLE_PHYSICAL_OUTPUTS)
        return;
    digitalWrite(LED_PIN, HIGH);
    }

    void off()
    {
        digitalWrite(LED_PIN, LOW);
    }

void toggle()
{
    if (!ENABLE_PHYSICAL_OUTPUTS)
        return;
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    }
}
