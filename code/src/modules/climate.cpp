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
unsigned long lastGasReadAt = 0;
}

namespace climate
{
void begin()
{
    if (ENABLE_MQ6_INPUT)
    {
        pinMode(MQ6_AO_PIN, INPUT);
        pinMode(MQ6_DO_PIN, INPUT);
        analogSetPinAttenuation(MQ6_AO_PIN, ADC_11db);
    }
    if (ENABLE_DHT11_INPUT) dht.begin();
}

void update(unsigned long now)
{
    if (ENABLE_DHT11_INPUT && elapsedSince(now, lastReadAt, CLIMATE_READ_INTERVAL))
    {
        lastReadAt = now;
        const float humidity = dht.readHumidity();
        const float temperature = dht.readTemperature();
        systemState.sensors.humidityPercent =
            isfinite(humidity) && humidity >= 0 && humidity <= 100 ? humidity : NAN;
        systemState.sensors.temperatureC = isfinite(temperature) ? temperature : NAN;
    }
    if (ENABLE_MQ6_INPUT && elapsedSince(now, lastGasReadAt, MQ6_READ_INTERVAL))
    {
        lastGasReadAt = now;
        uint32_t sum = 0;
        for (uint8_t index = 0; index < 16; ++index)
            sum += analogRead(MQ6_AO_PIN);
        systemState.sensors.mq6Raw = static_cast<int>(sum / 16);
        systemState.sensors.mq6Digital = digitalRead(MQ6_DO_PIN);
    }
}
}
