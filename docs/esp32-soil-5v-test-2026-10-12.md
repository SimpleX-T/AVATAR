# ESP32 MAX485 supply-change retest — 12 October 2026

User clarifies that the earlier Uno and ESP32 tests both supplied MAX485 at
about 3.3 V, contrary to the intended 5 V wiring in the guide. Probe supply
was unchanged. Earlier RO~3.3 V and divider junction~2.4 V; after switching
MAX485 to 5 V, RO~5 V and junction~3.1 V. These are user DMM reports, not
captured signal waveforms.

Repeated existing ESP32 diagnostic at9600/8N1/address2/function03, GPIO16 RX,
GPIO17 TX, GPIO4 tied DE/RE. Two reads each at registers7/2/4/5/6; no writes.
**0/10 valid replies:** initial zero-byte overflow, subsequent CRC failures
and wrong-slave/function library statuses. No readings accepted.

[Raw log](esp32-soil-5v-test-2026-10-12.log).

The supply change alone did not resolve communication. Next isolate actual
pin continuity, shared grounds, tied DE/RE control, and divider/UART receive
path. Static high-level voltages do not establish correct serial timing or
low levels. Keep the Uno-proven baud/address rather than random parameter
changes. No conclusion of defective probe or sole supply-voltage cause.
