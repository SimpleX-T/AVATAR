# Standalone test handoff — 21 October 2026

## Flashed build

- Automatic Wi-Fi via ignored preconfigured credentials; no phone portal required.
- Pump and servo outputs enabled after the operator confirmed complete bench wiring.
- Existing sensor confirmation, burst limits, fire priority and channel-local recovery retained.
- WebSocket handshake corrected by removing an extra CRLF from the custom header.
- The server subsequently reported `deviceStreamConnected: true` and recent telemetry.

## Setup and dashboard evidence

- Installed Anatomy into the user's Codex skills and generated the 108-part greenhouse schematic.
- Replaced dashboard and sign-in visual system; implemented overview, sensor readings,
  activity, reports, and a three-step resumable setup flow.
- Corrected profile binding to the authenticated reporting device instead of a default ID.
- Preserved the existing greenhouse name/operator/crop while re-saving against the actual
  reporting device. The ESP32 acknowledged on-chip persistence. Setup completion was
  observed in the browser; the 12-hour report clock now has a confirmed start.
- Fifteen server tests, the existing isolated server smoke test, six native firmware
  policy tests, firmware compile/flash, and the auth TypeScript/build checks passed.
- Reviewed desktop and narrow mobile layouts; mobile navigation and sign-out remain reachable.

## Current physical-test limit

Live device reports still contain invalid soil input, unavailable DHT11 readings,
and an unarmed fire detector. These are displayed as explicit sensor gaps.
MQ-6 and RS-485 readings are not calibrated agronomic/safety results. No pump
flow, physical suppression, calibration or unplugged power-cycle result was inferred.

To begin the physical standalone test, check sensor supply/common ground and actual
GPIO connections against `code/include/pins.h`, then use the normal external
power arrangement. Observe each local bounded response on the assembled system.
The Node.js computer remains necessary for the browser dashboard, authentication,
and the existing ThingSpeak publishing bridge. Local control itself runs on ESP32.

The original phone-provisioning timeout remains unresolved and is bypassed for now.
