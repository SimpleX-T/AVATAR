# ESP32 soil-probe comparison — 12 October 2026

Direct upload verified by esptool on ESP32-D0WD-V3. Diagnostic uses RX16,
TX17 and direction4, probe9600/8N1/address2/function03. User moved the probe
and MAX485 to an isolated breadboard; the level-shifter wiring and actual
voltages have not been independently inspected.

Ten read-only transactions, two each for registers7/2/4/5/6. **Zero valid
frames**. First capture overflowed with zero bytes; subsequent captures
contained malformed bytes, CRC failures and library E0/E1 statuses. These
are not sensor measurements. No probe configuration writes occurred.

[Raw capture](esp32-soil-test-2026-10-12.log).

Uno previously produced valid frames with identical probe settings. This
narrows investigation toward changed wiring, common reference, supply,
receive translation, or ESP32 UART/interface behavior; it does not isolate
one cause. Verify actual pin labels (GPIO16/17), RO-to-HV/LV-to-RX orientation,
shifter HV5V/LV3V3/common ground, MAX4855V and DE/RE GPIO4 connection.
Check idle RX voltage and probe supply. Do not change the proven slave/baud
or accept malformed bytes as nutrient values. Firmware remains installed
and idle until an explicit serial read command is sent.
