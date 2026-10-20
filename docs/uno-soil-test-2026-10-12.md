# Uno probe in soil — 12 October 2026

User reports coating removed, probe inserted in soil and Uno connected.
Soil moisture, insertion depth, soil provenance, probe supply voltage and
elapsed stabilization time were not independently measured/confirmed.

Read existing ModbusMaster diagnostic over `/dev/ttyUSB0` at 115200 USB baud.
Probe: 9600/8N1, address 2, function 03. No reflash or configuration writes.
All ten transactions returned valid frames with successful library status
and independent CRC/address/function/length validation, two per register.

| Supplier's provisional meaning | Register | Earlier coated-tip air raw | Soil raw (both reads) | Manual interpretation, uncalibrated |
| --- | --- | --- | --- | --- |
| pH | 7 | 70 | 65 | 6.5 pH |
| EC | 2 | 0 | 11 | 11 µS/cm |
| Nitrogen | 4 | 0 | 0 | 0 mg/kg |
| Phosphorus | 5 | 0 | 0 | 0 mg/kg |
| Potassium | 6 | 0 | 1 | 1 mg/kg |

[Raw serial log](uno-soil-test-2026-10-12.log).

The pH, EC and K register changes show responses differ between these two
conditions. Both coating removal and placement changed, so this is not an
isolated air-versus-soil experiment. Communication is repeatable in this short
capture; accuracy, calibration, nutrient selectivity and suitability for
fertilizer decisions remain unverified. N/P zeros do not establish nutrient-free
soil. Allow at least the supplier's initial pH stabilization period (>5 min),
confirm damp soil/full tip contact and compare with reference measurements.
Do not add fertilizer solely to force nonzero readings.
