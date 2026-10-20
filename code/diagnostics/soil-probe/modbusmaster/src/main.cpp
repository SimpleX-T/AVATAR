#include <Arduino.h>
#include <ModbusMaster.h>
#include "../../include/rtu_frame.h"
#if defined(ARDUINO_ARCH_AVR)
#include <SoftwareSerial.h>
SoftwareSerial probe(10, 11);
constexpr uint8_t directionPin = 2;
#else
HardwareSerial &probe = Serial2;
constexpr uint8_t directionPin = 4;
#endif

// Record bytes without Serial logging during timing-sensitive software UART RX.
// Only single-register reads are exposed; this bounded capture rejects overflow.
class CapturedStream : public Stream {
 public:
  explicit CapturedStream(Stream &port) : port_(port) {}
  using Print::write;
  int available() override { return port_.available(); }
  int peek() override { return port_.peek(); }
  int read() override {
    const int value = port_.read();
    if (value >= 0) {
      if (rxLength < sizeof(rx)) rx[rxLength++] = uint8_t(value);
      else overflow = true;
    }
    return value;
  }
  size_t write(uint8_t value) override {
    if (txLength < sizeof(tx)) tx[txLength++] = value;
    else overflow = true;
    return port_.write(value);
  }
  void flush() override { port_.flush(); }
  void reset() { rxLength = txLength = 0; overflow = false; }
  uint8_t tx[8] = {}, rx[32] = {};
  uint8_t txLength = 0, rxLength = 0;
  bool overflow = false;
 private:
  Stream &port_;
};
CapturedStream captured(probe);
ModbusMaster node;
uint32_t baud = 9600;
uint8_t address = 2;
uint16_t reg = 7;

void receiveMode() { digitalWrite(directionPin, LOW); }
void transmitMode() { digitalWrite(directionPin, HIGH); delayMicroseconds(200); }
void beginBus() {
  probe.end();
#if defined(ARDUINO_ARCH_AVR)
  probe.begin(baud); // SoftwareSerial: 8N1, synchronous TX; flush clears RX.
#else
  probe.begin(baud, SERIAL_8N1, 16, 17);
#endif
  node.begin(address, captured);
  node.preTransmission(transmitMode);
  node.postTransmission(receiveMode);
  receiveMode();
}
void hexBytes(const uint8_t *bytes, uint8_t count) {
  if (!count) Serial.print(F("<none>"));
  for (uint8_t i = 0; i < count; ++i) {
    if (bytes[i] < 16) Serial.print('0');
    Serial.print(bytes[i], HEX);
    Serial.print(' ');
  }
  Serial.println();
}
void query() {
  // Drain old bytes before recording this transaction, with a bounded drain.
  const unsigned long start = millis();
  while (probe.available() && millis() - start < 20) probe.read();
  captured.reset();
  node.clearResponseBuffer();
  Serial.print(F("baud=")); Serial.print(baud);
  Serial.print(F(" address=")); Serial.print(address);
  Serial.print(F(" function=03 register=0x")); Serial.println(reg, HEX);
  Serial.flush();
  delay(5); // RTU silent interval >3.5 characters at 9600.
  const uint8_t status = node.readHoldingRegisters(reg, 1);
  // Record bytes left behind when the library exits early (e.g. exception).
  const unsigned long tailStart = millis();
  while (millis() - tailStart < 10) {
    while (probe.available() && millis() - tailStart < 10) captured.read();
  }
  Serial.print(F("TX: ")); hexBytes(captured.tx, captured.txLength);
  Serial.print(F("RX: ")); hexBytes(captured.rx, captured.rxLength);
  Serial.print(F("LIBRARY_STATUS: 0x")); Serial.println(status, HEX);
  const auto decoded = soilProbeRtu::decodeSingleRegister(
      captured.rx, captured.rxLength, address, 3);
  using soilProbeRtu::Status;
  if (captured.overflow) Serial.println(F("RESULT: CAPTURE_OVERFLOW; rejected"));
  else if (decoded.status == Status::Valid && status == node.ku8MBSuccess) {
    Serial.print(F("RESULT: VALID_FRAME; raw=")); Serial.println(decoded.value);
    Serial.println(F("Register meaning/scaling/calibration remain UNVERIFIED."));
  } else if (decoded.status == Status::Exception) {
    Serial.print(F("RESULT: CRC_VALID_EXCEPTION; code=0x"));
    Serial.println(decoded.exceptionCode, HEX);
  } else if (decoded.status == Status::NoData) Serial.println(F("RESULT: NO_RESPONSE"));
  else if (decoded.status == Status::CrcMismatch) Serial.println(F("RESULT: CRC_MISMATCH"));
  else Serial.println(F("RESULT: INVALID_OR_UNEXPECTED_FRAME; rejected"));
}
void help() {
  Serial.println(F("READ ONLY: s=query; 1/2=address; 9=9600, 4=4800 baud"));
  Serial.println(F("q=pH reg7; e=EC reg2; n=N reg4; p=P reg5; k=K reg6"));
  Serial.println(F("Settings provisional from generic supplier manual. No automatic scanning."));
}
void setup() {
  pinMode(directionPin, OUTPUT); receiveMode();
  Serial.begin(115200); beginBus();
  Serial.println(F("AVATAR isolated ModbusMaster 2.0.1 diagnostic; no actuators"));
  help();
}
void loop() {
  if (!Serial.available()) return;
  switch (Serial.read()) {
    case 's': query(); break;
    case '1': address = 1; beginBus(); help(); break;
    case '2': address = 2; beginBus(); help(); break;
    case '9': baud = 9600; beginBus(); help(); break;
    case '4': baud = 4800; beginBus(); help(); break;
    case 'q': reg = 7; break;
    case 'e': reg = 2; break;
    case 'n': reg = 4; break;
    case 'p': reg = 5; break;
    case 'k': reg = 6; break;
    case '?': help(); break;
  }
}
