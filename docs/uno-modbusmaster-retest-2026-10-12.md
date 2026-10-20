# Uno soil-probe retest — 12 October 2026

Uploaded ModbusMaster diagnostic directly to `/dev/ttyUSB0`; avrdude verified
6694 bytes of flash on an ATmega328P. The firmware banner was captured.

**Communication established:** 9600 baud, 8N1, slave address 2, function 03,
single-register reads. All 11 requested transactions passed both library and
independent frame/CRC checks. No sensor configuration writes were sent.

| Provisional supplier register meaning | Register | Raw result | Repeats |
| --- | --- | --- | --- |
| pH | 7 | 70 | 3/3 |
| EC | 2 | 0 | 2/2 |
| Nitrogen | 4 | 0 | 2/2 |
| Phosphorus | 5 | 0 | 2/2 |
| Potassium | 6 | 0 | 2/2 |

pH request: `02 03 00 07 00 01 35 F8`.
Response: `02 03 02 00 46 7D B6`.
The supplier manual's /10 conversion would interpret 70 as pH 7.0, but neither
measurement accuracy nor a responsive pH electrode is established by repetition.
EC/NPK zero values are valid register responses, not proof that soil contains
no nutrients. Probe placement, soil moisture, stabilization time and supply
measurements were not independently observed during this session.

[Raw serial log](uno-modbusmaster-retest-2026-10-12.log).

Next: establish the current probe medium and compare readings after suitable
soil insertion/stabilization. Only then move to ESP32 with verified MAX485 RO
level translation. Keep power off during rewiring. A library change and correct
settings were tested together; this experiment does not isolate which change
resolved previous communication failures.
