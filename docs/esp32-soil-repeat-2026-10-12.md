# ESP32 successful probe test — 12 October 2026

At user's request repeated existing diagnostic without reflash/configuration
writes. User later confirmed that, when correcting the receive pin from GPIO5 to GPIO16, a MAX485 connection slipped out. Reconnecting it preceded this successful run; the exact terminal was not specified. Prior
reported configuration: MAX4855V, RO through10k/20k divider to GPIO16,
DI GPIO17, tied DE/RE GPIO4, common grounds; sandy soil sample.

**10/10 valid replies**, independently checked CRC/address/function/length
and library success. Probe9600/8N1/slave2/function03, one register per read.

| Provisional meaning | Register | Raw reads | Manual interpretation, uncalibrated |
| --- | --- | --- | --- |
| pH | 7 | 64,65 | 6.4,6.5 |
| EC | 2 | 11,11 | 11µS/cm |
| N | 4 | 0,0 | 0mg/kg |
| P | 5 | 0,0 | 0mg/kg |
| K | 6 | 1,1 | 1mg/kg |

[Raw capture](esp32-soil-repeat-2026-10-12.log).

Communication now established on ESP32, comparable with Uno soil results
(pH65/EC11/N0/P0/K1). This does not establish calibrated accuracy or NPK
selectivity. The user identified a slipped MAX485 connection as the remaining wiring fault.
Do not attribute success solely to the supply change or RX correction: the
immediately preceding test after those reported changes still failed while
that connection was loose. Its exact terminal was not specified.
