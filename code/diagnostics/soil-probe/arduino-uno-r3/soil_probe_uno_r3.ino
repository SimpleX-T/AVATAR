#include <Arduino.h>
#include <SoftwareSerial.h>

// Arduino Uno R3 only: D10 <- MAX485 RO, D11 -> DI, D2 -> DE and /RE tied.
// Probe power is external; MAX485 VCC is from Uno 5V; all grounds are common.
const byte RX_PIN = 10;
const byte TX_PIN = 11;
const byte DIRECTION_PIN = 2;
// Supplier's generic V2.2 manual states 9600 8N1 and default address 2.
// Its examples contain address contradictions, so this remains a test.
const unsigned long PROBE_BAUD = 9600;
const byte SLAVE_ADDRESS = 2;
const byte REGISTER_ADDRESS = 7; // pH is marked on the user's probe label.

SoftwareSerial probe(RX_PIN, TX_PIN);

uint16_t modbusCrc(const byte *data, byte length) {
  uint16_t crc = 0xFFFF;
  for (byte i = 0; i < length; ++i) {
    crc ^= data[i];
    for (byte bit = 0; bit < 8; ++bit) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
    }
  }
  return crc;
}

void printHex(const byte *data, byte length) {
  for (byte i = 0; i < length; ++i) {
    if (data[i] < 16) Serial.print('0');
    Serial.print(data[i], HEX);
    if (i + 1 < length) Serial.print(' ');
  }
  Serial.println();
}

void queryOnce() {
  // Read-only request: slave 2, function 03, pH register 0007, one register.
  byte request[8] = {SLAVE_ADDRESS, 0x03, 0x00, REGISTER_ADDRESS, 0x00, 0x01, 0, 0};
  const uint16_t requestCrc = modbusCrc(request, 6);
  request[6] = lowByte(requestCrc);
  request[7] = highByte(requestCrc);

  while (probe.available()) probe.read(); // Discard any late bytes.
  Serial.print(F("TX: "));
  printHex(request, sizeof(request));
  Serial.flush(); // Finish USB logging before timing the software UART.

  digitalWrite(DIRECTION_PIN, HIGH); // Transmit: DE high, /RE high.
  delayMicroseconds(100);
  probe.write(request, sizeof(request)); // SoftwareSerial sends synchronously.
  digitalWrite(DIRECTION_PIN, LOW); // Receive: DE low, /RE low.

  byte reply[16] = {};
  byte length = 0;
  bool overflow = false;
  const unsigned long started = millis();
  unsigned long lastByte = started;
  while (millis() - started < 1200) {
    while (probe.available()) {
      const byte next = probe.read();
      if (length < sizeof(reply)) reply[length++] = next;
      else overflow = true;
      lastByte = millis();
    }
    if (length && millis() - lastByte > 80) break;
  }

  Serial.print(F("RX: "));
  if (!length) Serial.println(F("<none>"));
  else printHex(reply, length);

  if (overflow) {
    Serial.println(F("RESULT: overflow; no value accepted"));
    return;
  }
  if (!length) {
    Serial.println(F("RESULT: NO_RESPONSE"));
    return;
  }
  if (length < 5) {
    Serial.println(F("RESULT: SHORT_FRAME"));
    return;
  }
  const uint16_t receivedCrc = reply[length - 2] |
                               (uint16_t(reply[length - 1]) << 8);
  if (modbusCrc(reply, length - 2) != receivedCrc) {
    Serial.println(F("RESULT: CRC_MISMATCH"));
    return;
  }
  if (reply[0] == SLAVE_ADDRESS && reply[1] == 0x83 && length == 5) {
    Serial.print(F("RESULT: MODBUS_EXCEPTION code "));
    Serial.println(reply[2], HEX);
    return;
  }
  if (reply[0] != SLAVE_ADDRESS || reply[1] != 3 || reply[2] != 2 || length != 7) {
    Serial.println(F("RESULT: UNEXPECTED_FRAME"));
    return;
  }
  Serial.print(F("RESULT: VALID_FRAME; raw register = "));
  Serial.println((uint16_t(reply[3]) << 8) | reply[4]);
  Serial.println(F("Meaning and units are NOT verified."));
}

void setup() {
  pinMode(DIRECTION_PIN, OUTPUT);
  digitalWrite(DIRECTION_PIN, LOW);
  Serial.begin(115200); // PC Serial Monitor, not probe bus.
  probe.begin(PROBE_BAUD);
  Serial.println(F("Uno R3 RS-485 read-only test: manual 9600/8N1, slave 2, pH reg 7"));
  Serial.println(F("No actuator outputs; manual is generic, so settings are provisional."));
}

void loop() {
  queryOnce();
  delay(3000);
}
