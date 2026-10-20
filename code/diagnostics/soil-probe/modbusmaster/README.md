# ModbusMaster probe retest

Uses Doc Walker's [ModbusMaster 2.0.1](https://github.com/4-20ma/ModbusMaster/tree/v2.0.1).
This is an isolated read-only test, not integrated farm firmware.

## Wiring

Start on **Uno R3**: MAX485 RO → D10; DI ← D11; tied DE and /RE ← D2;
MAX485 VCC ← Uno 5 V; shared grounds. Probe uses a separate regulated supply
within its own label rating. See [bench wiring](../../../../docs/arduino-soil-probe-bench-wiring.md).
Disconnect actuator loads.

The ESP32 target later uses RX16/TX17/direction4. MAX485 RO requires verified
5 V to 3.3 V translation before RX16. Do not move the Uno's RO wire directly
to ESP32.

## Build, upload, read

```sh
pio run -d code/diagnostics/soil-probe/modbusmaster -e uno
pio run -d code/diagnostics/soil-probe/modbusmaster -e uno -t upload --upload-port /dev/ttyACM0
pio device monitor --port /dev/ttyACM0 --baud 115200
```

Replace the port with the enumerated Uno port. Close monitors before upload.
No automatic requests occur: send `s` to request one register. Defaults are
9600/8N1, slave 2, function 03, register 7 (supplier's provisional pH map).
Expected request: `02 03 00 07 00 01 35 F8`.

Commands: `1`/`2` select slave; `9`/`4` select 9600/4800 baud;
`q/e/n/p/k` select pH7/EC2/N4/P5/K6; `s` reads; `?` prints help.
Settings commands change the host only: **no probe configuration writes**.

First capture three reads at default settings. If replies are valid, read
EC and each nutrient separately; unsupported registers may return an exception.
If silent, change only the address to 1 and repeat. Power off before an A/B
swap and log the change. Avoid broad scans until this controlled test is reviewed.

## Why retain independent validation?

The library handles framing, CRC, timeout and direction callbacks. Inspection
of its pinned source shows that exception responses return before its CRC check;
therefore our existing decoder independently checks CRC, address, function,
length and byte count, including exception frames. Capture logging happens after
reception to reduce SoftwareSerial timing interference. Overflow is rejected.

`LIBRARY_STATUS`: 00=success, E0=wrong slave, E1=wrong function,
E2=timeout, E3=CRC mismatch; low codes may be slave exceptions. Always inspect
RX and RESULT together. A timeout with partial bytes is different from no bytes.
Raw numbers are not accepted calibrated measurements. The supplier manual is
generic and internally inconsistent; it does not establish this exact probe's
settings, measurement accuracy or NPK selectivity.

The library's read is blocking (up to its two-second timeout). Keep this sketch
isolated; do not insert this blocking transaction in the production safety loop.

## Validation, 12 October 2026

Uno and ESP32 targets compiled. Uno static RAM: 668/2048 bytes.
Existing host decoder checks passed. Upstream library reports an unused helper
warning and an uninitialized variable warning in `requestFrom`, which this
sketch does not call. Physical communication results are pending the USB test.
