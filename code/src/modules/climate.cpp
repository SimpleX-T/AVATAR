#include <Arduino.h>
#include <DHT.h>

#include "climate.h"
#include "config.h"
#include "pins.h"
#include "state.h"
#include "timer.h"

namespace
{
DHT dht(DHT_PIN, DHT11);
unsigned long lastReadAt = 0;
}

namespace climate
{
void begin()
{
    pinMode(LDR_PIN, INPUT);
    dht.begin();
}

void update(unsigned long now)
{
    if (!elapsedSince(now, lastReadAt, CLIMATE_READ_INTERVAL))
        return;

    lastReadAt = now;
    const float humidity = dht.readHumidity();
    const float temperature = dht.readTemperature();

    if (!isnan(humidity))
        systemState.sensors.humidityPercent = humidity;
    if (!isnan(temperature))
        systemState.sensors.temperatureC = temperature;

    systemState.sensors.lightRaw = analogRead(LDR_PIN);
}
}
