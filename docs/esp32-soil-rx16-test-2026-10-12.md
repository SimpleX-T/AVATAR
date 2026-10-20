# ESP32 RX16 correction retest — 12 October 2026

User identified receive-divider connection on GPIO5 instead of GPIO16 and
reports correction to GPIO16. MAX485 remains at reported 5 V; divider was
reported approximately 3.1 V. Same firmware and probe settings as previous
runs; no configuration writes or reflash.

Ten read-only requests at9600/8N1/address2/function03, two each for pH7,
EC2,N4,P5,K6. **0/10 valid frames:** nine no-response/E2 outcomes and one
P-register capture containing ten zero bytes with E0/CRC failure.

[Raw serial capture](esp32-soil-rx16-test-2026-10-12.log).

Correcting the reported RX pin changed the predominant symptom from malformed
traffic to no received bytes, but communication remains unproven. Need actual
GPIO17 DI, GPIO4 tied DE/RE and GPIO16 divider-junction continuity plus grounds.
Do not attribute this to probe failure or change known-good address/baud blindly.
Local ESP32 core inspection confirms HardwareSerial::flush() waits for TX only
(uartFlush delegates to uartFlushTxOnly(...,true)); no evidence it clears replies.
