# Project AVATAR: Production Deployment Roadmap

## Prototype implementation plan

The production roadmap below is the longer-term direction. The immediate goal
is to complete and validate the current 2 x 3 ft prototype with wired sensors,
local control, and ThingSpeak data publishing. Do not build production cloud
infrastructure ahead of confirming the sensor, power, and control behavior.

### 1. Freeze the physical inventory and interfaces

- Record exact model numbers and datasheets for the 38-pin ESP32, both buck
  converters, five-probe RS-485 soil sensor, capacitive soil sensor, DHT11,
  MQ-6, fire/LDR sensors, servo, pumps, L298N, XY-MOS, and the kit MOS board.
- Confirm each sensor's interface, output voltage, units, warm-up needs,
  accuracy, and safe sampling interval. In particular, identify whether the
  RS-485 sensor's generic manual settings on this unit and the MAX485 voltage interface.
- Establish the black pump's rated voltage and each pump's startup/stall current.
  Confirm each candidate driver's terminals, trigger level, supply topology,
  current capacity, PWM constraints, and protection. The existing two-L298N
  firmware mapping is a blocked legacy assignment, not the final hookup.
- Produce one reviewed as-built pin/power diagram from the proposed firmware
  map. Legacy valve, chemigation, and three-flame firmware paths are removed.
- Keep analog inputs on suitable ESP32 ADC pins and verify ADC behavior with
  Wi-Fi active; protect ESP32 inputs from signals above 3.3 V.

**Exit:** every component has a verified interface, power budget, pin, and
bring-up test; no hardware is inferred from old source constants.

### 2. Build reliable sensing and a useful data model

- Add one driver and calibration record per actual sensor model.
- Store named, unit-bearing values rather than exposing only raw ADC values.
- Attach device ID, sensor ID/location, observation timestamp, firmware version,
  validity/calibration status, and operating mode to readings.
- Sample each sensor on its own appropriate cadence; aggregate into a slower
  upload batch. The local telemetry interval is now 60 seconds.
- Define a bounded persistent offline queue, retry backoff, duplicate handling,
  and behavior when storage fills. Local sensing and safety control must not
  block while uploads retry.
- Configure ThingSpeak fields and upload cadence only after deciding the
  measurements, units, and minimum useful dashboard history.

**Exit:** calibrated bench readings are plausible, timestamped, and retained
across a controlled Wi-Fi outage and restart.

### 3. Commission the two-pump demonstration safely

- Treat the one capacitive sensor as one watering zone. With no valves, the
  prototype cannot select among multiple branches/nozzles.
- Calibrate dry/wet thresholds in the intended soil and use hysteresis,
  confirmation time, maximum run time, cooldown, and manual emergency stop.
- Test each pump separately with its intended supply, hose, and nozzle. Record
  flow and coverage at a range of PWM settings; do not equate duty cycle with
  spray force or delivered volume.
- Define fire-response priority and failure behavior. Test the fire sensor,
  servo sweep limits, pump activation, and irrigation shutdown without a real
  hazardous flame.
- Do not add hot-weather air misting to the control logic until its pump/nozzle,
  available water, and safe trigger conditions are defined.

**Exit:** supervised bench tests prove independent outputs, bounded operation,
emergency stop, and safe recovery after reset or power loss.

### 4. Deliver the farmer-facing data experience

- Put current farm status, last update time, and active actions before technical
  details.
- Present confirmed soil nutrients, pH, EC, moisture, climate, light, gas,
  fire, and motion with clear units, sensor location, and freshness.
- Make offline, stale, missing, and uncalibrated readings explicit.
- Use plain labels, familiar controls, and tested icons; pair icons with words.
- Do not expose raw API/device commands as routine farmer actions.

**Exit:** a novice can tell whether data is current, what it means, and which
actions are safe without help from the developer.

### 5. Add claim, Wi-Fi provisioning, and remote nodes in stages

- Define a one-time QR claim credential bound to a pre-registered device ID;
  require account verification and record farm ownership server-side.
- Provision Wi-Fi using a temporary authenticated setup mode on the head-node;
  never ask the farmer to place home Wi-Fi credentials in a public QR code.
- Keep user credentials, device credentials, and ThingSpeak write credentials
  separate. Use a unique, revocable device credential and avoid exposing a
  channel write key in the browser.
- Add child nodes only after the wired head-node is stable. Choose LoRa versus
  Wi-Fi from range, power, terrain, data rate, and deployment tests; define
  node identity, pairing, battery/power, freshness, and loss behavior first.

**Exit:** a test account claims only its device, provisions it without developer
access, and sees fresh readings attributed to the correct farm and sensor.

## Objective

After validating the prototype plan above, evolve the current local-network
system into a secure, remotely operated agricultural platform where:

- a field unit keeps the farm safe even without internet;
- each ESP32 has a unique, revocable identity;
- authenticated farmers see only their farms and devices;
- telemetry is durable and freshness is explicit;
- remote commands are authorized, expiring, idempotent, safety-checked, and
  acknowledged by the field unit; and
- failures are diagnosable by the farmer, installer, and support team.

## Target architecture

```text
Sensors / actuators
        │
        ▼
ESP32 field controller ── farm Wi-Fi / cellular router ── internet
        │                                               │
        │ local safety + offline queue                  ▼
        │                                      Public cloud ingress
        │                                               │
        └──────── MQTT over TLS / HTTPS ────────────────┤
                                                        ▼
                                              Device + command services
                                                        │
                              ┌─────────────────────────┼─────────────────────┐
                              ▼                         ▼                     ▼
                        PostgreSQL               Telemetry store       Alert workers
                              │                         │                     │
                              └─────────────────────────┼─────────────────────┘
                                                        ▼
                                               Authenticated web app
                                                        │
                                                        ▼
                                              Farmer anywhere online
```

The cloud coordinates and records. The ESP32 remains the authority for
immediate safety and bounded local automation.

## Non-negotiable system rules

1. Never use a farmer's password as a device credential.
2. Never expose pumps, valves, servos, or alarms directly to the public web.
3. Never report `ONLINE`, `SENT`, or `APPLIED` without evidence for that exact
   state.
4. Never execute an expired, duplicate, unauthorized, or locally unsafe command.
5. Internet loss must not disable fire response, safe irrigation limits, or
   emergency stop.
6. Every tenant boundary is enforced on the server, not merely hidden in the UI.
7. Device credentials must be unique, rotatable, and revocable.
8. All timestamps use UTC in storage and the farm timezone in presentation.

## Phase 0 — Product and safety definition

**Purpose:** decide what the production system is allowed to do before scaling
the prototype.

Deliverables:

- Define roles: owner, farm manager, worker, installer, support operator.
- Define the device capability model instead of assuming every unit has every
  sensor or actuator.
- Classify actions by risk:
  - observation;
  - low-risk simulation/test;
  - bounded operation;
  - high-risk chemical/fire/safety operation.
- Write local safety invariants for every actuator.
- Define the first production activation event:
  `device claimed → fresh telemetry verified → safe test acknowledged`.
- Decide the first deployment connection: farm Wi-Fi or a managed 4G router.
- Create architecture decision records for HTTPS versus MQTT, cloud provider,
  database, identity provider, and notification channels.

Exit criteria:

- Faculty/project team can explain the threat model, offline behavior, and
  safety boundaries without referring to UI mockups.

## Phase 1 — Cloud foundation

**Purpose:** replace the laptop-bound server with a stable public environment.

Deliverables:

- Containerize the Node service.
- Create development, staging, and production environments.
- Add a public domain, DNS, TLS certificate, and HTTPS-only ingress.
- Move configuration and secrets into environment/secret management.
- Add PostgreSQL with versioned migrations.
- Add structured logs, health/readiness endpoints, request IDs, and error
  reporting.
- Add automated test, build, migration, and deployment workflows.
- Back up the database and test restoration.

Minimum schema:

```text
users
farms
farm_memberships
devices
device_credentials
device_capabilities
telemetry
commands
command_events
alerts
audit_events
onboarding_sessions
```

Exit criteria:

- Staging survives restart without losing users, device ownership, telemetry,
  or command history.

## Phase 2 — Human identity and tenant isolation

**Purpose:** ensure each farmer accesses only authorized farms.

Deliverables:

- Use a proven identity provider or standards-based authentication.
- Support email verification and secure account recovery.
- Implement server-side sessions using secure, HTTP-only cookies.
- Model many users per farm and many farms per user.
- Add role-based authorization on every API operation.
- Record membership and role changes in the audit log.
- Add rate limiting and abuse protection.

Exit criteria:

- Automated authorization tests prove that a user from Farm A cannot read or
  command a device belonging to Farm B.

## Phase 3 — Device registry, claiming, and provisioning

**Purpose:** securely associate a physical ESP32 with the correct farm.

Deliverables:

- Assign an immutable device ID at manufacture/enrolment.
- Give each unit a unique credential; prefer device certificates when practical.
- Put a short-lived, single-use claim code or equivalent non-secret lookup in
  the QR flow; never treat the printed device ID as proof of ownership.
- Implement claim states:
  `unclaimed`, `claim-started`, `verified`, `provisioned`, `ready`, `revoked`.
- Prevent double claims and make ownership transfer an explicit audited flow.
- Provision tenant-scoped communication permissions.
- Support credential rotation, loss, revocation, and factory reset.

Exit criteria:

- A farmer can claim a new unit without exposing its permanent credential, and
  a revoked unit can no longer publish telemetry or collect commands.

## Phase 4 — Production device transport

**Purpose:** make communication durable, secure, and observable.

Recommended progression:

1. Keep HTTPS for the first controlled pilot.
2. Introduce MQTT over TLS when fleet size, latency, or connection efficiency
   justifies it.

HTTPS pilot:

- Telemetry `POST`.
- Command poll using bounded long-polling or the existing short polling.
- Command acknowledgement `POST`.
- Exponential backoff with jitter.

MQTT production topics:

```text
farms/{farmId}/devices/{deviceId}/telemetry
farms/{farmId}/devices/{deviceId}/commands
farms/{farmId}/devices/{deviceId}/acknowledgements
farms/{farmId}/devices/{deviceId}/status
```

Each command includes:

```json
{
  "commandId": "globally-unique-id",
  "deviceId": "field-unit-001",
  "action": "START_IRRIGATION",
  "issuedAt": "UTC timestamp",
  "expiresAt": "UTC timestamp",
  "requestedBy": "user-id",
  "parameters": { "durationSeconds": 30 }
}
```

Command lifecycle:

```text
created → queued → delivered → accepted → applied
                              └→ rejected
          └→ expired / cancelled / delivery-failed
```

Exit criteria:

- Duplicate delivery does not duplicate physical action.
- Expired commands cannot run after reconnection.
- Dashboard and audit log expose the exact lifecycle.

## Phase 5 — Offline-first field controller

**Purpose:** preserve safe farm operation during cloud or internet failure.

Deliverables:

- Implement local sensor sampling and rules independently of cloud status.
- Persist a bounded telemetry buffer in nonvolatile storage.
- Upload buffered readings with original observation timestamps after reconnect.
- Persist recently processed command IDs to prevent replay after reboot.
- Enforce actuator interlocks, maximum run times, cooldowns, and emergency stop.
- Add watchdog recovery and brownout-safe state.
- Distinguish cloud time, device uptime, and synchronized wall-clock time.
- Define behavior for sensor failure, contradictory readings, and low power.

Exit criteria:

- A controlled internet outage does not violate any safety invariant.
- Reconnection does not replay old commands or lose the meaning of old readings.

## Phase 6 — Telemetry, history, and farm model

**Purpose:** turn live readings into trustworthy operational history.

Deliverables:

- Validate payload schema, units, ranges, firmware version, and capabilities.
- Store observation time and server-receive time separately.
- Add retention and downsampling policies.
- Represent missing, stale, estimated, simulated, and physical readings
  explicitly.
- Add farm/device history views and CSV export.
- Add calibration metadata and sensor health.
- Build per-device freshness and heartbeat computation.

Exit criteria:

- Every displayed value can be traced to device, sensor, observation time, unit,
  operating mode, and ingestion result.

## Phase 7 — Alerts and notifications

**Purpose:** notify the right person without replacing local safety control.

Deliverables:

- Create alert rules for fire, critically dry soil, motion, prolonged actuator
  activity, sensor failure, and device offline.
- Add deduplication, severity, acknowledgement, escalation, and quiet hours.
- Start with email; add push/SMS/WhatsApp only after consent and delivery
  requirements are clear.
- Separate `detected`, `local response active`, `notification sent`, and
  `notification delivered`.
- Provide notification history and preferences.

Exit criteria:

- Alert drills demonstrate local response first and remote notification second,
  with no duplicate storm.

## Phase 8 — Farmer and installer onboarding

**Purpose:** reach verified first value safely.

Flow:

1. Explain the outcome and prerequisites.
2. Scan the QR for a known, unclaimed device and explain what the code does.
3. Create/verify the farmer account and create or join a farm.
4. Collect the minimum useful farm profile (such as farm type and approximate
   location); request phone number only when a defined feature needs it.
5. Verify the claim and record device-to-farm ownership on the server.
6. Guide local Wi-Fi provisioning with explicit diagnostic states.
7. Wait for fresh telemetry from that exact device and its configured sensors.
8. Explain the first farm readings and their freshness in plain language.
9. Run an optional safe commissioning check and await device acknowledgement.
10. Confirm readiness, notification choices, and next action.

Requirements:

- Server-side resumable onboarding state.
- Separate installer and owner paths.
- Back, save/exit, resume, help, manual-code, and retry routes.
- Contextual permissions rather than a launch-time bundle.
- Accessible progress, errors, asynchronous status, and recovery.
- No success screen before verified telemetry.

Exit criteria:

- Representative farmers can commission a unit without developer intervention.

## Phase 9 — Security and operations

**Purpose:** operate a real fleet responsibly.

Deliverables:

- Threat model device, network, API, tenant, support, and physical access.
- Signed firmware and over-the-air update strategy with rollback.
- Software bill of materials and dependency scanning.
- Credential inventory and rotation schedule.
- Audit trail for login, claim, unclaim, command, policy, role, and support action.
- Operational dashboards for ingestion lag, stale devices, command latency,
  rejection rate, and notification delivery.
- Incident response, support escalation, and data breach procedures.
- Data retention, deletion, export, and privacy documentation.

Exit criteria:

- A lost device credential, compromised account, failed deployment, and cloud
  outage each have a tested recovery procedure.

## Phase 10 — Controlled pilot and scale

**Purpose:** learn safely before commercial rollout.

Pilot sequence:

1. Bench test with simulated sensors and physical outputs isolated.
2. Single supervised test plot.
3. Multiple devices on one farm.
4. Two or three farms with different connectivity conditions.
5. Limited production cohort with support coverage.

Measure:

- device claim success;
- time to first fresh telemetry;
- safe command acknowledgement latency;
- offline duration and recovery;
- sensor failure and calibration rate;
- alert precision and duplicate rate;
- onboarding completion/recovery;
- support contacts;
- 7/30-day active farm retention.

Scale only after safety, reliability, and support thresholds are met.

## Suggested implementation order

### Now

- Freeze actual hardware models, wiring, power, and motor-driver capabilities.
- Verify the revised single-fire-sensor, two-pump firmware pin map on the bench.
- Define calibrated sensor fields and implement measured sampling intervals.
- Implement local safety rules and pump tests before enabling physical outputs.
- Add offline retention and a measured ThingSpeak upload cadence to the current
  60-second local telemetry schedule.
- Make the dashboard truthful about units, sensor locations, stale data, and
  which functionality is not yet available.

### Next

- Complete secure account/device claiming and Wi-Fi provisioning.
- Add staged child-node support after the wired head-node is stable.
- Move from ThingSpeak prototype publishing to a production service only when
  retention, authorization, and fleet needs justify it.
- Deploy staging over HTTPS and introduce durable multi-user storage.
- Add expiring/idempotent remote commands and commissioning onboarding.

### Later

- MQTT fleet transport.
- Certificate-based device attestation at scale.
- Notifications and escalation.
- OTA firmware management.
- Multi-farm analytics, billing, and commercial administration.

## Definition of production-ready

Project AVATAR is production-ready only when a farmer can remotely understand and
control an authorized farm while the field unit remains safe during loss,
duplication, delay, stale data, invalid input, compromised credentials, and
cloud unavailability.
