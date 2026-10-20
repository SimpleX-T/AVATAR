# ModbusMaster retest decisions — 12 October 2026

## Evidence and useful changes

[Prayatna2111's sensor suite](https://github.com/Prayatna2111/Smart-Environmental-Monitoring-with-ESP32-for-Agriculture)
points to Doc Walker's library. Its separate pH sensor, DHT22 and sensor map
are not evidence of the settings for AVATAR's five-in-one probe.

[ModbusMaster 2.0.1 source](https://github.com/4-20ma/ModbusMaster/blob/v2.0.1/src/ModbusMaster.cpp)
provides function-03 requests, transmit/receive callbacks, CRC processing and
bounded timeouts. It also returns exception codes before the CRC validation
section. The new diagnostic therefore captures raw TX/RX and independently
validates the entire reply, including exceptions, with AVATAR's existing decoder.
It keeps logging outside reception and only permits single-register reads.
It is blocking and belongs on an isolated bench board, not the fire-control loop.

## Supplier settings, not borrowed defaults

Local supplier document: `/home/devtochukwu/Downloads/Soil_Multi-Parameter_Sensor_Manual_EN_V2_2.pdf`,
sections 7.1–7.2. Stated defaults: address 2, 9600, 8N1, function 03.
Map: EC=2, N=4, P=5, K=6, pH=7. The example frames contradict the stated
address and use address zero for reads. This unit has not yet established
its settings through a valid reply. No broadcast reads/configuration writes
are included in the new diagnostic.

The manual describes pH /10, EC in µS/cm, and NPK in mg/kg, but these remain
provisional interpretations until this exact probe/model is confirmed. A valid
CRC proves communication, not accuracy or independently selective NPK sensing.
The manual specifies initial pH stabilization longer than five minutes;
communication testing need not wait for a stable pH value, but measurement
comparisons must account for stabilization and use soil/reference samples.

## Controlled test sequence

1. Uno R3 first, previous D10/D11/D2 mapping; independent probe power and common ground.
2. Identify USB port, upload `code/diagnostics/soil-probe/modbusmaster`, capture firmware banner.
3. Three requested pH-register transactions at 9600/address2; preserve raw logs.
4. If valid, request EC/N/P/K individually. If silent, try address1 at the same baud.
5. Review wiring and supply measurements before any other hypotheses; power off to swap A/B.
6. Move to ESP32 only after reviewing Uno results and verifying RO voltage translation.

## Validation status

Both Uno and ESP32 diagnostic targets compiled successfully with pinned
ModbusMaster 2.0.1. Host decoder tests passed, including the supplier request
CRC (`35 F8`) and a corrupted exception CRC. Physical upload and probe replies
remain pending the Uno USB connection. No sensor measurements have been obtained
or accepted by this software verification.

## Physical outcome

12 October follow-up: Uno communication succeeded, followed by ESP32 success
with **10/10 valid replies** after breadboard corrections. Confirmed transport
profile:9600/8N1/address2/function03, single-register reads at2/4/5/6/7.
See [successful ESP32 capture](esp32-soil-repeat-2026-10-12.md).
Measurement accuracy remains unverified; preserve earlier failures for comparison.

### User-confirmed final wiring fault

After moving the receive-divider connection from GPIO5 to GPIO16, a MAX485
connection had slipped out. The user reconnected it before the successful
10/10 ESP32 capture. Exact MAX485 terminal unspecified. Thus the no-response
retest did not demonstrate failure with all intended connections intact.
The earlier malformed-byte tests had the receive connection on the wrong pin;
MAX485 was also initially supplied at about3.3V. Keep these changes distinct:
the experiments do not isolate a supply-voltage effect by itself.
