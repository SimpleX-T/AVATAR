# Isolated RS-485 soil-probe diagnostic

This is a **read-only communications test**, not the Project AVATAR production
controller and not a proven pH/NPK decoder. It starts with the supplier's
generic V2.2 manual settings: Modbus RTU slave `2`, function `03`, pH register
`0007`, one register, at `9600 8N1`. The manual's examples contradict its
stated default address and use broadcast address `00` for a read; therefore
these settings are a **test hypothesis for this exact probe**, not a confirmed
response. No Wi-Fi credentials or email code are included. No write-register
commands are sent.

## ModbusMaster comparison test (12 October 2026)

The new [ModbusMaster diagnostic](modbusmaster/README.md) supports both the
Uno R3 and ESP32, preserving raw byte logs and independently validated replies.
Use **Uno first** for the current retest. It waits for an explicit `s` command,
uses the same supplier-manual defaults, and never writes probe configuration.
The original diagnostics remain available for comparing transaction behavior.
Both new board targets compile; physical replies are still pending.

## Before applying power

Disconnect the pumps, L298N, servo, DHT11, and other modules for this test.
With power removed, match the connections below to the actual board labels:

| Connection | This diagnostic expects |
| --- | --- |
| Probe red / black | A regulated supply within the range printed on *this* probe / common ground |
| Probe yellow A / green B | MAX485 A / B (power off before swapping if the maker uses opposite labels) |
| MAX485 VCC / GND | Regulated 5 V / common ground |
| MAX485 `RO` | **5 V-to-3.3 V level shifter**, then ESP32 GPIO16 |
| MAX485 `DI` | ESP32 GPIO17 |
| MAX485 `DE` and `/RE` tied | ESP32 GPIO4; LOW receives, HIGH transmits |

The pictured MAX485 is a 5 V part. Do not connect its `RO` directly to ESP32
GPIO16. Measure the output of the level shifter; it must remain within the
ESP32's input-voltage limit. Check the voltage at the probe and MAX485 while
the test is running, not just at the buck converter terminals.

This GPIO4 arrangement matches the proposed full-controller pin map. Do not
run any diagnostic with pump or servo signal wires connected.

## Build and capture

From this folder:

```sh
pio run
pio run --target upload
pio device monitor --baud 115200
```

Only upload after the power, level-shift, and pin checks above. The sketch
queries every five seconds and prints the exact `TX` and `RX` bytes. The ESP32
USB Serial Monitor speed is **115200**; the probe UART starts at **9600**. They
are separate links and need not have the same baud rate.

Serial commands (send one character): `s` queries immediately; `9` or `4`
selects 9600 or 4800 probe baud; `2` or `1` selects the slave address; `r` or
`h` selects function 03 or 04; `q`, `e`, `n`, `p`, `k`, or `0` selects pH register
7, EC 2, N 4, P 5, K 6, or temperature 0. The register positions come from
the supplier's generic manual and still need confirmation from a valid reply
from this particular unit. Change one setting at a time and keep the full log.

`NO_RESPONSE` means no bytes reached the ESP32; it does **not** prove the probe
is faulty. `CRC_MISMATCH`, `WRONG_ADDRESS`, `MODBUS_EXCEPTION`, and
`VALID_FRAME` separate different failure points. A valid frame proves only
that this transaction worked. `RAW_REGISTER` is intentionally unscaled and
unlabelled until the exact probe register manual is verified.

If the result is unclear, send the complete `TX`, `RX`, and `RESULT` lines,
along with measured supply voltages and a photo of the wiring. Do not send
Wi-Fi passwords, email app passwords, or ThingSpeak keys.

To run the host frame-validation test without hardware from the repository
root:

```sh
g++ -std=c++17 -Wall -Wextra -Werror \
  -Icode/diagnostics/soil-probe/include \
  code/diagnostics/soil-probe/test/rtu_frame_test.cpp \
  -o /tmp/avatar-rtu-frame-test
/tmp/avatar-rtu-frame-test
```
