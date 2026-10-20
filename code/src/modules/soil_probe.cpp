#include <Arduino.h>

#include "config.h"
#include "pins.h"
#include "soil_probe.h"
#include "soil_probe_rtu.h"
#include "state.h"

namespace {
constexpr uint8_t ADDRESS = 2;
constexpr uint8_t REGISTERS[5] = {7, 2, 4, 5, 6};
constexpr uint32_t POLL_INTERVAL_MS = 60000;
constexpr uint32_t REPLY_TIMEOUT_MS = 1200;
constexpr uint32_t INTERBYTE_MS = 80;

soilProbeRtu::Result readRegister(uint8_t reg) {
    uint8_t request[8] = {ADDRESS, 3, 0, reg, 0, 1, 0, 0};
    const uint16_t crc = soilProbeRtu::crc16(request, 6);
    request[6] = static_cast<uint8_t>(crc);
    request[7] = static_cast<uint8_t>(crc >> 8);
    while (Serial2.available()) Serial2.read();
    digitalWrite(RS485_DIRECTION_PIN, HIGH);
    delayMicroseconds(200);
    Serial2.write(request, sizeof(request));
    Serial2.flush(true);
    digitalWrite(RS485_DIRECTION_PIN, LOW);

    uint8_t reply[16] = {};
    size_t count = 0;
    bool overflow = false;
    bool gotByte = false;
    const uint32_t started = millis();
    uint32_t lastByte = started;
    while (millis() - started < REPLY_TIMEOUT_MS) {
        while (Serial2.available()) {
            const uint8_t byte = static_cast<uint8_t>(Serial2.read());
            if (count < sizeof(reply)) reply[count++] = byte;
            else overflow = true;
            gotByte = true;
            lastByte = millis();
        }
        if (gotByte && millis() - lastByte >= INTERBYTE_MS) break;
        vTaskDelay(pdMS_TO_TICKS(1));
    }
    if (overflow) return {soilProbeRtu::Status::UnexpectedLength, 0, 0};
    return soilProbeRtu::decodeSingleRegister(reply, count, ADDRESS, 3);
}

void probeTask(void *) {
    pinMode(RS485_DIRECTION_PIN, OUTPUT);
    digitalWrite(RS485_DIRECTION_PIN, LOW);
    Serial2.begin(9600, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
    vTaskDelay(pdMS_TO_TICKS(3000));
    for (;;) {
        for (uint8_t index = 0; index < 5; ++index) {
            const auto result = readRegister(REGISTERS[index]);
            lockSystemState();
            if (result.status == soilProbeRtu::Status::Valid) {
                systemState.sensors.probeRaw[index] = result.value;
                systemState.sensors.probeValid[index] = true;
                systemState.sensors.probeLastGoodAt[index] = millis();
            } else {
                systemState.sensors.probeValid[index] = false;
            }
            unlockSystemState();
            vTaskDelay(pdMS_TO_TICKS(100));
        }
        vTaskDelay(pdMS_TO_TICKS(POLL_INTERVAL_MS));
    }
}
}

namespace soilProbe {
void begin() {
    if (!ENABLE_RS485_PROBE) return;
    if (xTaskCreatePinnedToCore(probeTask, "avatar-probe", 4096,
                                nullptr, 1, nullptr, 0) != pdPASS)
        Serial.println("[PROBE] Could not start RS-485 reader.");
}
}
