#include <Arduino.h>

#include "rtu_frame.h"

// Standalone, READ-ONLY diagnostic using the supplier manual's stated defaults.
// Match these pins to the wiring before uploading. Disconnect pump/servo loads.
// MAX485 RO must be level-shifted to <= 3.3 V before ESP32 GPIO16.
namespace
{
constexpr uint8_t RX_PIN = 16;             // ESP32 RX2 <- level-shifted MAX485 RO
constexpr uint8_t TX_PIN = 17;             // ESP32 TX2 -> MAX485 DI
constexpr uint8_t DIRECTION_PIN = 4;       // ESP32 -> tied MAX485 DE and /RE
constexpr size_t MAX_REPLY_BYTES = 64;
constexpr unsigned long REPLY_TIMEOUT_MS = 1200;
constexpr unsigned long INTER_BYTE_TIMEOUT_MS = 80;
constexpr unsigned long POLL_INTERVAL_MS = 5000;

uint32_t probeBaud = 9600; // Generic supplier V2.2 manual's stated default.
uint8_t slaveAddress = 2;  // Generic manual says 2; its example frames disagree.
uint8_t functionCode = 3; // Holding registers; 'h' selects input registers (04).
uint16_t registerAddress = 7; // pH is marked on the user's probe label.
unsigned long lastPollAt = 0;

void printHex(const uint8_t *bytes, size_t length)
{
    for (size_t index = 0; index < length; ++index)
    {
        if (bytes[index] < 0x10)
            Serial.print('0');
        Serial.print(bytes[index], HEX);
        if (index + 1 < length)
            Serial.print(' ');
    }
    Serial.println();
}

const char *statusName(soilProbeRtu::Status status)
{
    using soilProbeRtu::Status;
    switch (status)
    {
    case Status::Valid: return "VALID_FRAME";
    case Status::NoData: return "NO_RESPONSE";
    case Status::ShortFrame: return "SHORT_FRAME";
    case Status::CrcMismatch: return "CRC_MISMATCH";
    case Status::WrongAddress: return "WRONG_ADDRESS";
    case Status::UnexpectedFunction: return "UNEXPECTED_FUNCTION";
    case Status::UnexpectedByteCount: return "UNEXPECTED_BYTE_COUNT";
    case Status::UnexpectedLength: return "UNEXPECTED_LENGTH";
    case Status::Exception: return "MODBUS_EXCEPTION";
    }
    return "UNKNOWN";
}

void setReceiveMode()
{
    digitalWrite(DIRECTION_PIN, LOW); // DE off, /RE active low.
}

void setTransmitMode()
{
    digitalWrite(DIRECTION_PIN, HIGH); // DE on, /RE inactive high.
}

void pollOnce()
{
    uint8_t request[8] = {
        slaveAddress, functionCode,
        static_cast<uint8_t>(registerAddress >> 8),
        static_cast<uint8_t>(registerAddress),
        0, 1, 0, 0,
    };
    const uint16_t crc = soilProbeRtu::crc16(request, 6);
    request[6] = static_cast<uint8_t>(crc);
    request[7] = static_cast<uint8_t>(crc >> 8);

    size_t staleBytes = 0;
    while (Serial2.available() > 0)
    {
        Serial2.read();
        ++staleBytes;
    }

    Serial.printf("\n[PROBE] baud=%lu slave=%u function=%u register=0x%04X\n",
                  static_cast<unsigned long>(probeBaud), slaveAddress,
                  functionCode, registerAddress);
    if (staleBytes > 0)
        Serial.printf("[PROBE] Discarded %u stale byte(s) before request.\n",
                      static_cast<unsigned>(staleBytes));
    Serial.print("TX: ");
    printHex(request, sizeof(request));

    setTransmitMode();
    delayMicroseconds(200);
    Serial2.write(request, sizeof(request));
    Serial2.flush(true); // TX only: wait for the last stop bit without clearing RX.
    setReceiveMode();

    uint8_t reply[MAX_REPLY_BYTES] = {};
    size_t length = 0;
    bool overflow = false;
    bool receivedAny = false;
    const unsigned long startedAt = millis();
    unsigned long lastByteAt = startedAt;
    while (millis() - startedAt < REPLY_TIMEOUT_MS)
    {
        while (Serial2.available() > 0)
        {
            const uint8_t next = static_cast<uint8_t>(Serial2.read());
            if (length < sizeof(reply))
                reply[length++] = next;
            else
                overflow = true;
            receivedAny = true;
            lastByteAt = millis();
        }
        if (receivedAny && millis() - lastByteAt >= INTER_BYTE_TIMEOUT_MS)
            break;
        delay(1);
    }

    Serial.print("RX: ");
    if (length == 0)
        Serial.println("<none>");
    else
        printHex(reply, length);
    if (overflow)
    {
        Serial.println("RESULT: OVERFLOW (more than 64 bytes; no value accepted)");
        return;
    }

    const auto decoded = soilProbeRtu::decodeSingleRegister(reply, length,
                                                             slaveAddress, functionCode);
    Serial.print("RESULT: ");
    Serial.println(statusName(decoded.status));
    if (decoded.status == soilProbeRtu::Status::Valid)
        Serial.printf("RAW_REGISTER: %u (0x%04X); units and meaning UNVERIFIED\n",
                      decoded.value, decoded.value);
    else if (decoded.status == soilProbeRtu::Status::Exception)
        Serial.printf("EXCEPTION_CODE: 0x%02X\n", decoded.exceptionCode);
}

void setBaud(uint32_t baud)
{
    probeBaud = baud;
    Serial2.end();
    Serial2.begin(probeBaud, SERIAL_8N1, RX_PIN, TX_PIN);
    setReceiveMode();
    Serial.printf("[PROBE] UART baud changed to %lu.\n", static_cast<unsigned long>(probeBaud));
}

void handleCommand(char command)
{
    switch (command)
    {
    case 's': pollOnce(); lastPollAt = millis(); break;
    case '4': setBaud(4800); break;
    case '9': setBaud(9600); break;
    case '1': slaveAddress = 1; Serial.println("[PROBE] Slave address 1 selected."); break;
    case '2': slaveAddress = 2; Serial.println("[PROBE] Slave address 2 selected."); break;
    case 'r': functionCode = 3; Serial.println("[PROBE] Function 03 selected."); break;
    case 'h': functionCode = 4; Serial.println("[PROBE] Function 04 selected."); break;
    case '0': registerAddress = 0; break;
    case 'e': registerAddress = 2; break;
    case 'n': registerAddress = 4; break;
    case 'p': registerAddress = 5; break;
    case 'k': registerAddress = 6; break;
    case 'q': registerAddress = 7; break;
    case '?':
        Serial.println("Commands: s=query now, 9=9600 baud, 4=4800 baud, "
                       "2=slave 2, 1=slave 1, r=function 03, h=function 04.");
        Serial.println("Registers: q=pH 7, e=EC 2, n=N 4, p=P 5, k=K 6, 0=temp 0.");
        Serial.println("Manual is generic/internally inconsistent; all queries remain read-only.");
        break;
    default: break;
    }
}
} // namespace

void setup()
{
    Serial.begin(115200);
    pinMode(DIRECTION_PIN, OUTPUT);
    setReceiveMode();
    Serial2.begin(probeBaud, SERIAL_8N1, RX_PIN, TX_PIN);
    delay(250);
    Serial.println("\nProject AVATAR | isolated soil RS-485 read-only diagnostic");
    Serial.println("No Wi-Fi, no DHT, no pumps, no ThingSpeak.");
    Serial.println("Warning: MAX485 RO must be shifted to 3.3 V for ESP32 RX16.");
    handleCommand('?');
    lastPollAt = millis() - POLL_INTERVAL_MS;
}

void loop()
{
    while (Serial.available() > 0)
        handleCommand(static_cast<char>(Serial.read()));
    if (millis() - lastPollAt >= POLL_INTERVAL_MS)
    {
        lastPollAt = millis();
        pollOnce();
    }
}
