#include <Arduino.h>
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
        digitalWrite(LED_PIN, HIGH);
    }

    void off()
    {
        digitalWrite(LED_PIN, LOW);
    }

    void toggle()
    {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    }
}