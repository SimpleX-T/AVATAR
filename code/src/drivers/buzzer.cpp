#include <Arduino.h>

#include "buzzer.h"
#include "pins.h"

namespace
{
bool active = false;
}

namespace buzzer
{
void begin()
{
    pinMode(BUZZER_PIN, OUTPUT);
    off();
}

void on()
{
    digitalWrite(BUZZER_PIN, HIGH);
    active = true;
}

void off()
{
    digitalWrite(BUZZER_PIN, LOW);
    active = false;
}

bool isOn()
{
    return active;
}
}
