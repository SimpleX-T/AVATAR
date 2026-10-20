# Uno R3 isolated fire input + servo test

This sketch has no pump outputs and no dependency on the ESP32 project.
It sweeps a servo between **20° and 160°** while the fire module's digital
output on **D8 reads LOW (0)**. It stops sending servo pulses when D8 is
HIGH (1). The 20–160° range avoids forcing an unknown servo against its
mechanical stops; widen it only after confirming the model's travel.

**Polarity confirmed:** the connected module reads **HIGH (1) with no fire**
and **LOW (0) on detection**. The first raw-HIGH sketch therefore swept at
idle; this revision corrects the trigger to actual detection.

Connect fire-module `DO` → Uno **D8**, module `GND` → Uno `GND`, and supply
the module at its verified rating. Connect servo signal (orange/yellow) →
Uno **D7**, servo brown/black → shared `GND`, and servo red → a **regulated
5 V supply rated for its start-up current**. Keep the servo supply ground
connected to Uno GND, but do not feed that external 5 V into the Uno 5 V
pin while Uno USB is connected. Remove the servo horn/nozzle for this test.
Keep the pumps disconnected. Never bring a flame near the battery,
electronics, or MQ-6 gas sensor.

Open `uno_fire_servo_test.ino` in Arduino IDE and select **Arduino Uno**,
or upload from the repository root with
`pio run -d code/diagnostics/uno_fire_servo_test -t upload --upload-port PORT`.
The 115200-baud Serial Monitor reports `fire_D8`, `sweep`, and angle every
500 ms. It is optional: the servo's movement is the main result.
