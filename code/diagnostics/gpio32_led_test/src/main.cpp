// GPIO32/33 output diagnostic for the L298N irrigation channel.
//
// Test wiring: LED anode -> 1k ohm -> GPIO32, LED cathode -> GPIO33.
//
// Phase pattern, repeating with the polarity swapping every 60 seconds:
//   Normal pairing  (32=HIGH, 33=LOW):  3 s on, 1 s off, steady for the rest
//   Swapped pairing (33=HIGH, 32=LOW):  3 s on, 1 s off, steady for the rest
//
// So in the first 60 s the LED should light steady after the initial
// 3 s on / 1 s off if the normal assignment is good; after the swap you
// are testing the reversed assignment with the same LED and meter.
// Every phase is printed to serial at 115200 baud for cross-checking.

#include <Arduino.h>

constexpr uint8_t PIN_A = 32; // IN3 in the normal assignment
constexpr uint8_t PIN_B = 33; // IN4 in the normal assignment
constexpr unsigned long ON_MS = 3000;
constexpr unsigned long OFF_MS = 1000;
constexpr unsigned long SWAP_PERIOD_MS = 60000;

static bool normalPairing = true;
static bool steady = false;
static unsigned long phaseStart = 0;
static unsigned long pairingStart = 0;

void applyDrive(bool on)
{
    // Drop both pins LOW first so "off" is genuinely off regardless of
    // which pin is the return path, then drive the active pin HIGH.
    digitalWrite(PIN_A, LOW);
    digitalWrite(PIN_B, LOW);
    if (on)
    {
        const uint8_t drivePin = normalPairing ? PIN_A : PIN_B;
        digitalWrite(drivePin, HIGH);
    }
}

void setup()
{
    Serial.begin(115200);
    Serial.println();
    Serial.println("[GPIO32-LED TEST] boot");

    pinMode(PIN_A, OUTPUT);
    pinMode(PIN_B, OUTPUT);
    digitalWrite(PIN_A, LOW);
    digitalWrite(PIN_B, LOW);

    pairingStart = millis();
    phaseStart = millis();
    Serial.println("[PHASE] normal pairing (32=HIGH, 33=LOW): on 3s");
    applyDrive(true);
}

void loop()
{
    const unsigned long now = millis();

    if (now - pairingStart >= SWAP_PERIOD_MS)
    {
        normalPairing = !normalPairing;
        pairingStart = now;
        steady = false;
        phaseStart = now;
        Serial.printf("[PHASE] %s pairing (%d=HIGH, %d=LOW): on 3s\n",
                      normalPairing ? "normal" : "swapped",
                      normalPairing ? PIN_A : PIN_B,
                      normalPairing ? PIN_B : PIN_A);
        applyDrive(true);
        return;
    }

    if (!steady)
    {
        const unsigned long inPhase = now - phaseStart;
        if (inPhase >= ON_MS && inPhase < ON_MS + OFF_MS)
        {
            applyDrive(false);
        }
        else if (inPhase >= ON_MS + OFF_MS)
        {
            steady = true;
            Serial.println("[PHASE] steady on until the pairing swaps");
            applyDrive(true);
        }
        else
        {
            applyDrive(true);
        }
    }
}
