# Publication and cloud lessons for AVATAR

Reviewed 12 October 2026. This document records research and proposed architecture, not a cloud implementation. No credentials, Firebase project, database, deployed service or new cloud dependency was created.

## What the comparison paper actually supports

[Smart Farming with Automation, pp. 47–52](https://www.ijeeejournal.org/wp-content/uploads/2026/04/SMART-FARMING-WITH-AUTOMATION.pdf) presents abstract, introduction, literature survey, research gap, contributions, methodology, experimental setup, circuit discussion, results, thresholds, conclusion/future work and references. Its ESP32 combines moisture-based irrigation, environmental sensing, gas/flame alerts, OLED and a servo rain shed. Motion sensing is described only as movement/security monitoring (p. 50), without a specified model or validated decision logic. The servo is not a directed fire nozzle.

Evidence limits: setup text says DHT22 and “possibly pH”; circuit/results text says DHT11. Gas threshold “60%” lacks a concentration calibration. Results are qualitative, without replicates, uncertainty or measured water savings. Cooling/humidifying actions appear in threshold descriptions without a complete corresponding implementation account. Basic camera/color monitoring is claimed, while advanced image processing remains future work. Firebase/AWS references do not establish integration: cloud, solar and fertigation appear in future scope. No demonstrated RS485 nutrient measurements are supplied. All six pages' extracted text was reviewed; diagram screenshot retrieval failed, so pin-level diagram interpretation remains unverified.

## Apply the useful structure, strengthen the evidence

The following are recommendations for AVATAR, rather than claims derived from the comparison paper:

1. Write the problem and contribution around the implemented paired loops: moisture to irrigation, and flame to separate pump/servo response. Document auxiliary sensors separately from decision inputs.
2. Include the actual power tree, BOM/model identifiers, GPIO/interface table, circuit, water paths, firmware state machine and readable photographs. Mark substitutions and untested channels.
3. Report methods before results: calibration points, reference instrument, sample count, soil conditions, supply measurements and timestamps. Keep raw measurements and failed trials.
4. Measure response latency, false triggers, repeatability, pump startup supply sag, maximum runtime, sensor disconnection behavior and network-loss behavior. Do not turn a successful bench trigger into a validated field-performance claim.
5. Treat motion sensing as optional security scope. It is not evidence of fire, moisture deficit or crop health, and should not trigger either pump without a separately justified requirement.
6. Keep camera monitoring as resource-limited future work. A photograph or leaf-color change does not establish disease classification. A later camera module needs its own power/memory/bandwidth budget, dataset and validation; it should not obstruct critical local control.

## Relay switching does not explain L298N pump behavior

A relay contact switches a separate load supply; its 5 V coil/module supply is not necessarily the pump voltage. The L298 is a transistor full bridge with a current-dependent output drop. ST specifies source and sink saturation drops separately; at 1 A their typical values sum to about 1.8 V, with maximum total drop 3.2 V. Those values are test-condition data, not a guaranteed drop for these unidentified pumps. [ST L298 datasheet, electrical characteristics](https://www.st.com/resource/en/datasheet/l298.pdf)

Therefore, a pump spinning directly at 5 V does not prove it will start through an L298N supplied at 5 V. Measure supply and pump-terminal voltage during startup and steady flow, plus current, before choosing the driver or raising supply voltage. Preserve the actual ratings and evidence boundaries in [the confirmed architecture](confirmed-system-architecture.md) and [L298 bring-up research](l298-5v-servo-bringup-research.md). Do not infer the user's pump rating from the comparison paper's relay.

## Firebase alongside ThingSpeak: proposed roles

Firebase Realtime Database stores JSON and synchronizes connected clients. It integrates with Firebase Authentication and database Security Rules; official clients have platform-specific offline behavior. REST access is available, but the general SDK offline description does not demonstrate persistent offline queues on an ESP32 or across browser restarts. [Firebase official database overview](https://firebase.google.com/docs/database)

ThingSpeak aggregates, visualizes and analyzes cloud telemetry, supports REST/MQTT ingestion and MATLAB processing, and can generate event-based alerts. These make it useful for experimental history and analysis. [MathWorks official ThingSpeak documentation](https://www.mathworks.com/help/thingspeak/)

Recommended division, if cloud work is later authorized and implemented:

| Responsibility | Proposed owner |
|---|---|
| Sensor sampling, freshness checks, pump limits, fire response and arbitration | ESP32 local firmware |
| Local access during internet loss | Existing local dashboard/controller |
| Remote latest state, device status, user access and command acknowledgments | Firebase application layer |
| Downsampled measurement history, charts and MATLAB experimental analysis | ThingSpeak |

This split is an architectural recommendation, not a requirement of either provider. Initially use Firebase for read-only latest state. Avoid duplicating every historical record across both services unless a concrete use case needs it. Select export cadence and retention against the actual account quotas when implementing.

If remote actuation is introduced later, use authenticated commands carrying device ID, command ID, requested action, expiry and sequence/version. The ESP32 must validate local constraints, reject expired/replayed requests and publish acceptance/rejection plus actual state. A cloud write is not proof that a pump ran. Hazard response must remain local and should not depend on either service being reachable. Bound retry queues and identify stale data explicitly. Validate rules in an emulator before deployment; never place administrative credentials in browser code or firmware.

## Immediate priority

Verify the RS485 soil probe independently before publishing nutrient values or enabling nutrient-driven decisions. Transport success, plausible register values and calibrated agronomic validity are separate milestones. An Uno/ESP32 diagnostic comparison should retain baud/address/function/register settings, raw frames/errors and probe power measurements. This research pass changed documentation only; the coordinating agent owns firmware diagnostics and any hardware test.
