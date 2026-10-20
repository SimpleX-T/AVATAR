# Arduino-only RS-485 soil-probe bench test

**Purpose:** isolate the probe and pictured MAX485 breakout from the ESP32. This is a wiring and electrical checklist for a **classic, 5 V Arduino Uno R3 or ATmega328P Nano**, not proof that the probe speaks Modbus or uses any particular baud rate/register map. Confirm the exact Arduino model before following it: not every board sold as an Arduino has 5 V GPIO. The [Uno R3 documentation](https://docs.arduino.cc/retired/boards/arduino-uno-rev3-with-long-pins/) specifies 5 V operation and USB power; the [classic Nano datasheet](https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf) identifies its ATmega328P and 5 V supply.

## Supplies and wiring

The probe label supplied by the user says **3.3–24 V DC**, red `VCC`, black `GND`, yellow `A`, green `B`, and RS-485 output. Thus **regulated 5 V is inside the *marked* probe supply range**, but its current demand and its exact communication protocol remain unverified. Power it from a **separate, current-limited regulated 5 V bench supply** for this isolation test; do not assume the Arduino's USB/5 V pin can supply an unknown probe load. Alternatively, a verified regulated 12 V source may feed **only the probe's red/black power pair** if needed; it must never touch Arduino or MAX485 logic pins. The [MAX485 product page](https://www.analog.com/en/products/max485.html) and [datasheet](https://www.analog.com/MAX481/datasheet) specify a 5 V transceiver supply (electrical-characteristic tests at 5 V ±5%), **not** a 3.3–24 V supply. Arduino's [Uno power documentation](https://docs.arduino.cc/retired/boards/arduino-uno-rev3-with-long-pins/) warns against feeding an external supply into its `5V` pin while using USB.

| From | To | Reason |
| --- | --- | --- |
| Arduino USB | Computer USB | Powers the Uno/Nano and carries the Serial Monitor output. Leave Arduino `VIN` and external `5V` input unconnected. |
| Arduino `5V` | MAX485 breakout `VCC` | The pictured MAX485 board is 5 V logic. The breakout is the only load intentionally taken from Arduino 5 V in this setup. |
| Arduino `GND` | MAX485 `GND` | Logic reference. |
| External regulated **5 V +** | Probe **red** `VCC` | Probe power only; use 12 V only if supplied as described above. |
| External supply **− / GND** | Probe **black** `GND` **and Arduino `GND`** | The probe and transceiver need a common signal reference; do **not** connect the external supply's positive wire to Arduino 5 V. The [Modbus serial-line implementation guide](https://www.modbus.org/file/secure/modbusoverserial.pdf) identifies a signal common on 2-wire RS-485 links. |
| Probe **yellow** `A` | MAX485 bus `A` | Differential data line, **not** power. |
| Probe **green** `B` | MAX485 bus `B` | Differential data line, **not** ground. |
| MAX485 `RO` | Arduino digital `D10` | Arduino receive. |
| Arduino digital `D11` | MAX485 `DI` | Arduino transmit. |
| Arduino digital `D2` | MAX485 **`DE` and `/RE` tied together** | Half-duplex direction. `LOW` = listen, `HIGH` = transmit. The module silkscreen may say `RE` without drawing the bar; the MAX485's receiver-enable input is **active-low**, per its [datasheet](https://www.analog.com/MAX481/datasheet). |

Use the labels printed **on the actual breakout**, not its physical pin order inferred from an online module photo. The user's photograph shows a four-position `VCC B A GND` header near the two-position A/B screw terminal, and a logic header marked `RO RE DE DI`; verify each pad while the board is unpowered. **Do not connect the probe's red wire to the module's `VCC` pin in this test:** the probe has its own external supply, while the module's VCC is fed from the Arduino USB-powered 5 V rail. Its `A` and `B` labels are the intended bus pair.

Arduino's [SoftwareSerial reference](https://docs.arduino.cc/learn/built-in-libraries/software-serial) defines the constructor as `SoftwareSerial(rxPin, txPin)` and shows `10`/`11` as an example. Use `SoftwareSerial probeSerial(10, 11)` for the probe while ordinary `Serial` remains available over USB for logs. SoftwareSerial cannot receive and transmit simultaneously, but a half-duplex request followed by a response is compatible with that limitation. Keep the Serial Monitor baud separate from the **probe** baud; the latter cannot be established from the RS-485 label alone. If a read-only query is sent, set `D2` HIGH just for transmission, wait until the last byte is sent, then set it LOW before waiting for a response. The [MAX485 datasheet](https://www.analog.com/MAX481/datasheet) defines `DE` high as driver enabled and `/RE` low as receiver enabled.

## Uno R3 read-only sketch

Open [soil_probe_uno_r3.ino](../code/diagnostics/soil-probe/arduino-uno-r3/soil_probe_uno_r3.ino)
in Arduino IDE and select **Arduino Uno** and the board's serial port. Do not
upload the AGREM ESP32/Wi-Fi sketch or the DHT sketch for this test. After the
wiring and voltage checks below, upload and set Serial Monitor to **115200**.
The sketch uses `SoftwareSerial` at **9600** for the probe and sends a read-only
request every three seconds to slave **2**, pH register **7**, function **03**:
`02 03 00 07 00 01 35 F8`. It prints `TX`, `RX`, and a validated `RESULT`.
These settings come from the supplier's generic V2.2 manual. Its examples
contradict its stated default address, so a `NO_RESPONSE` still cannot prove
this unit is defective. It never turns a raw register into an accepted pH or
NPK value without a valid reply. The sketch compiles for Uno R3 with the AVR
toolchain; it has **not** been tested on the user's physical hardware.

## Check before connecting and powering

1. With everything **off**, confirm the probe's red/black polarity, breakout labels, and that neither `A` nor `B` is shorted to supply or ground. Keep pumps, servo, ESP32, and all other sensors disconnected.
2. With `A`/`B` temporarily disconnected, power **only** the external supply and measure **at the probe's red/black leads under load**: approximately its intended regulated voltage (5 V in the preferred test; 12 V only in the alternative). If the supply current-limits, droops, or heats, stop and find the probe's actual current requirement. Power it back off before connecting the bus pair.
3. With the Arduino on USB and the probe supply still off, measure MAX485 `VCC` to MAX485 `GND`: approximately 5 V; measure the Arduino 5 V rail. Then switch USB off, connect the `A`/`B` pair, and verify the external supply's **negative** and Arduino `GND` are common. With the intended wiring, the external supply's **positive** must not be tied to the Arduino's 5 V rail. The MAX485's 5 V operating specification is in the [ADI datasheet](https://www.analog.com/MAX481/datasheet).
4. Before connecting `RO` to D10, check it against Arduino `GND`: it should remain within the board's 0–5 V logic domain, never 12 V. Verify `D2` is configured LOW to listen when idle. A DMM can verify supply and DC levels, **not** decode the RS-485 signal; log raw received bytes for the data test.
5. Start with the generic supplier manual's stated `9600 8N1`, address `2`, function `03`, and marked pH register `7`. The earlier AGREM sketch's `4800 8N1`, address `1` was a different hypothesis. The manual's typical brown/blue power/bus colors also differ from this unit's printed red/green label; use the actual label. If there are still no reply bytes, confirm the query reaches A/B and test one alternate setting at a time, starting with slave address `1` at 9600. Try swapping `A`/`B` **only with power removed** and only after checking the documented pin mapping. Do not treat a timeout as a nutrient value. The [Modbus serial guide](https://www.modbus.org/file/secure/modbusoverserial.pdf) describes RTU framing; the supplier manual claims this probe family uses Modbus RTU, but this unit has not answered yet.

## If the Arduino is 3.3 V

**Stop and identify its exact model before wiring `RO`.** For example, Arduino's [Nano ESP32 manual](https://docs.arduino.cc/tutorials/nano-esp32/cheat-sheet/) warns not to apply above 3.3 V to its GPIO. A 5 V MAX485 `RO` can therefore be unsafe for a 3.3 V Arduino, just as it is for the ESP32. Use a verified 3.3 V RS-485 transceiver such as ADI's [MAX3485](https://www.analog.com/en/products/MAX3485.html) or proper bidirectional logic-level interfacing; **do not** simply power the pictured MAX485 board at 3.3 V. The probe may still be powered independently at a voltage within its label range, with compatible grounds/bus wiring.

**Still needed:** exact Arduino model, measured probe/MAX485 voltages, probe model/protocol sheet, and a raw TX/RX hexadecimal log. Successful communication through this Uno/Nano setup would narrow the fault toward the ESP32-side wiring, voltage translation, pin mapping, or code; it would not on its own validate the probe's measurement calibration.
