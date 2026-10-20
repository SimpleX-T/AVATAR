#include <cassert>
#include <cstdint>

#include "rtu_frame.h"

namespace
{
void appendCrc(uint8_t *frame, size_t payloadLength)
{
    const uint16_t crc = soilProbeRtu::crc16(frame, payloadLength);
    frame[payloadLength] = static_cast<uint8_t>(crc);
    frame[payloadLength + 1] = static_cast<uint8_t>(crc >> 8);
}
}

int main()
{
    uint8_t request[8] = {1, 3, 0, 0, 0, 1, 0, 0};
    appendCrc(request, 6);
    assert(request[6] == 0x84 && request[7] == 0x0A);

    uint8_t supplierRequest[8] = {2, 3, 0, 7, 0, 1, 0, 0};
    appendCrc(supplierRequest, 6);
    assert(supplierRequest[6] == 0x35 && supplierRequest[7] == 0xF8);

    uint8_t response[7] = {1, 3, 2, 0x01, 0x2C, 0, 0};
    appendCrc(response, 5);
    const auto valid = soilProbeRtu::decodeSingleRegister(response, sizeof(response), 1, 3);
    assert(valid.status == soilProbeRtu::Status::Valid);
    assert(valid.value == 300);

    // Captured from this ESP32/probe on 12 October 2026.
    const uint8_t capturedPh[7] = {2, 3, 2, 0, 64, 0xFD, 0xB4};
    const uint8_t capturedEc[7] = {2, 3, 2, 0, 11, 0xBD, 0x83};
    const auto ph = soilProbeRtu::decodeSingleRegister(capturedPh, sizeof(capturedPh), 2, 3);
    const auto ec = soilProbeRtu::decodeSingleRegister(capturedEc, sizeof(capturedEc), 2, 3);
    assert(ph.status == soilProbeRtu::Status::Valid && ph.value == 64);
    assert(ec.status == soilProbeRtu::Status::Valid && ec.value == 11);

    assert(soilProbeRtu::decodeSingleRegister(nullptr, 0, 1, 3).status ==
           soilProbeRtu::Status::NoData);
    assert(soilProbeRtu::decodeSingleRegister(response, 4, 1, 3).status ==
           soilProbeRtu::Status::ShortFrame);

    response[4] ^= 0x01;
    assert(soilProbeRtu::decodeSingleRegister(response, sizeof(response), 1, 3).status ==
           soilProbeRtu::Status::CrcMismatch);
    response[4] ^= 0x01;

    response[0] = 2;
    appendCrc(response, 5);
    assert(soilProbeRtu::decodeSingleRegister(response, sizeof(response), 1, 3).status ==
           soilProbeRtu::Status::WrongAddress);
    response[0] = 1;

    response[2] = 4;
    appendCrc(response, 5);
    assert(soilProbeRtu::decodeSingleRegister(response, sizeof(response), 1, 3).status ==
           soilProbeRtu::Status::UnexpectedByteCount);

    uint8_t exception[5] = {1, 0x83, 2, 0, 0};
    appendCrc(exception, 3);
    const auto rejected = soilProbeRtu::decodeSingleRegister(exception, sizeof(exception), 1, 3);
    assert(rejected.status == soilProbeRtu::Status::Exception);
    assert(rejected.exceptionCode == 2);
    exception[4] ^= 1;
    assert(soilProbeRtu::decodeSingleRegister(exception, sizeof(exception), 1, 3).status ==
           soilProbeRtu::Status::CrcMismatch);
}
