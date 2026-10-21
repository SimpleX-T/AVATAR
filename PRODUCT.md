# Product

<!-- impeccable:product-schema 1 -->

## Platform

ESP32 head-node, connected sensors and actuators, cloud telemetry service, and
web dashboard. The current software prototype uses a local Node.js server; the
planned remote data destination is ThingSpeak.

## Users

The primary user is a farmer who needs to understand farm conditions and take
appropriate action without needing technical expertise. The interface must
also support low-literacy use: familiar terms, clear units, meaningful icons
paired with words, large touch controls, and carefully tested language choices.
The project team and agricultural advisers configure and evaluate the
prototype.

## Product Purpose

Project AVATAR is a prototype of a smart IoT-based off-grid agriculture data
collection, management, and protection system. It gathers useful soil,
climate, and atmospheric readings, preserves and uploads them when connectivity
is available, and performs bounded local actions where those actions are
appropriate. Its broader direction is a head-node that can work with remote
child sensor nodes; the current prototype uses wired components.

The initial physical demonstration is a small 2 x 3 ft farm model. It uses one
capacitive soil sensor, one fire sensor, two pumps, a servo, and candidate driver boards
to explore local watering and fire-response behavior. It does not yet provide
independent watering zones, as it has no valves and only one soil-moisture
sensor.

## Product Outcome

A farmer should be able to identify recent soil and environmental conditions,
see whether readings are current, understand what the system is doing, and
control the farm with clear, safe actions. The system must distinguish local
operation from cloud connectivity: internet loss may delay uploads but must not
silently disable safe local behavior.

## Operating Context

- Built and demonstrated as an off-grid-capable agriculture prototype.
- Current hardware connects sensors to one 38-pin ESP32 head-node by wire.
- Future child nodes may communicate with the head-node over LoRa or Wi-Fi.
- The ESP32 currently sends its legacy telemetry to a local Node.js server.
- ThingSpeak publishing and acknowledged greenhouse-profile setup are implemented.
  QR claiming and durable offline upload buffering remain planned. The direct
  Wi-Fi fallback is currently used because phone provisioning remains unresolved.
- Data may be viewed on phones and computers, including in outdoor conditions.

## Current Components

- A 5S battery stepped down by one buck to 12 V and a second buck to 5 V,
  plus a 38-pin ESP32 development board.
- Five-probe RS-485 soil sensor (label indicates EC, pH, and NPK options), capacitive soil-moisture sensor, and DHT11.
- MQ-6 gas sensor, fire sensor, and LDR. PIR sensing was removed from this prototype.
- Servo motor, two pumps (irrigation and fire), an L298N, an XY-MOS, and the
  small pump kit's MOS controller. The operator confirmed bench wiring and functioning hardware on 21 October 2026.
  Automated physical retesting remains separate from that confirmation. Earlier bring-up notes:
  both pumps spun directly at 3.3 V and 5 V, but rated voltage/current and
  performance through the L298N remain unknown.

The two buck converters already provide the intended 12 V and 5 V rails.
Solar charging is deferred until an appropriate 5S BMS is available. A generic
supplier soil-probe manual has arrived, but its settings and measurements are
not yet validated against this unit. The integrated firmware now uses the confirmed bench pin map. Sensor health and
physical pump delivery still require live checks during standalone testing. See [the
confirmed prototype architecture](docs/confirmed-system-architecture.md).

## Product Principles

1. Treat Project AVATAR as an agricultural system prototype, not merely a
   dashboard or a sensor-to-actuator demo.
2. Collect useful data with clear units, timestamps, sensor identity, location,
   and calibration status.
3. Keep local safety and bounded control working without internet.
4. Show whether a reading is current, stale, missing, estimated, or simulated.
5. Keep farmer controls understandable, direct, and difficult to trigger by
   accident.
6. Be honest about what is wired, measured, calibrated, simulated, or planned.

## Device Setup Direction

The intended setup starts from a visible QR code containing a setup URL and
known device ID. After account verification, the farmer proves possession with
a concealed one-time code supplied inside the box, identifies the farm, then
provisions local Wi-Fi on the ESP32. The server associates the authenticated
device with that farm. The visible QR carries no ownership proof or secret.

## Evidence and Constraints

- Existing local firmware/server/dashboard path is available for development.
- The current firmware telemetry fields and pin map do not yet represent the
  complete updated component list.
- ThingSpeak integration is implemented. Wireless child nodes and a durable
  offline upload queue remain planned.
- No farm-trial, crop-yield, or validated agronomic evidence is available; do
  not present unmeasured benefits as proven results.
- The one-sensor/two-pump/no-valve prototype cannot represent multi-zone
  watering or independently controlled spray stations.

## Accessibility and Inclusion

Use plain language, consistent terms, readable text, large touch targets,
strong contrast, visible focus, and status that never depends on color alone.
Pair icons with short labels; test wording and symbols with intended users.
Support reduced motion and clear offline/stale-data states. Avoid relying on
technical abbreviations or raw sensor codes as the primary explanation.
