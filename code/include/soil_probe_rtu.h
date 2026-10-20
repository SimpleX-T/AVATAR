#pragma once

#include <stddef.h>
#include <stdint.h>

namespace soilProbeRtu {
enum class Status : uint8_t {
    Valid, NoData, ShortFrame, CrcMismatch, WrongAddress,
    UnexpectedFunction, UnexpectedByteCount, UnexpectedLength, Exception,
};
struct Result { Status status; uint16_t value; uint8_t exceptionCode; };

inline uint16_t crc16(const uint8_t *bytes, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t index = 0; index < length; ++index) {
        crc ^= bytes[index];
        for (uint8_t bit = 0; bit < 8; ++bit)
            crc = (crc & 1U) ? static_cast<uint16_t>((crc >> 1) ^ 0xA001U)
                             : static_cast<uint16_t>(crc >> 1);
    }
    return crc;
}

inline Result decodeSingleRegister(const uint8_t *bytes, size_t length,
                                   uint8_t expectedAddress, uint8_t expectedFunction) {
    if (!bytes || length == 0) return {Status::NoData, 0, 0};
    if (length < 5) return {Status::ShortFrame, 0, 0};
    const uint16_t receivedCrc = static_cast<uint16_t>(bytes[length - 2]) |
        (static_cast<uint16_t>(bytes[length - 1]) << 8);
    if (crc16(bytes, length - 2) != receivedCrc)
        return {Status::CrcMismatch, 0, 0};
    if (bytes[0] != expectedAddress) return {Status::WrongAddress, 0, 0};
    if (bytes[1] == static_cast<uint8_t>(expectedFunction | 0x80U))
        return length == 5 ? Result{Status::Exception, 0, bytes[2]}
                           : Result{Status::UnexpectedLength, 0, 0};
    if (bytes[1] != expectedFunction) return {Status::UnexpectedFunction, 0, 0};
    if (bytes[2] != 2) return {Status::UnexpectedByteCount, 0, 0};
    if (length != 7) return {Status::UnexpectedLength, 0, 0};
    return {Status::Valid,
            static_cast<uint16_t>((static_cast<uint16_t>(bytes[3]) << 8) | bytes[4]), 0};
}
}
