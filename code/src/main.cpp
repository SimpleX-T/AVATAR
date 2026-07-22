#include <Arduino.h>

#include "led.h"
#include "pump.h"

void setup()
{
    led::begin();
    pump::begin();

    led::on();
}

void loop()
{
}