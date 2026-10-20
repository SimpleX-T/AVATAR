# ESP32 sensor–actuator bench bring-up

> Earlier staged bring-up record. For the **current single-sketch integrated
> test** (capacitive moisture, fire, DHT11, MQ-6 AO/DO, two L298N pumps,
> servo), follow [the integrated bench guide](../code/diagnostics/avatar_bench_test/README.md).
> The older flag and wiring steps below are historical, not the upload
> instructions for this run. PIR has been removed from the current bench build.

This is the next wiring sequence for the 2 × 3 ft Project AVATAR prototype.
The **two current control pairs** are capacitive soil moisture → irrigation
pump, and digital fire sensor → fire pump plus servo. The RS-485 soil probe,
DHT11, LDR, and MQ-6 are data/alert inputs; there is no third pump for
hot-weather misting. This document does not certify the prototype as a real
fire-suppression system.

## 1. Start with sensor inputs only

Keep the 12 V motor rail **off**. Disconnect both pumps, the L298N, and the
servo. Power the ESP32 from its USB connector for this step. Use the GPIO
numbers printed on the exact 38-pin board, not a generic physical pin count.

| Input | ESP32 connection | Condition before attaching |
| --- | --- | --- |
| Capacitive moisture `AO` | GPIO35 (ADC1) | Power its module from ESP32 `3V3` **only if its own markings/datasheet permit 3.3 V**; connect its `GND` to ESP32 `GND`. Leave `DO` disconnected. Measure `AO` to GND and ensure it never exceeds the ESP32 3.3 V domain. |
| Fire module digital `DO` | GPIO34 | Power from `3V3` only if the particular module supports it, and connect common GND. Confirm `DO` never exceeds 3.3 V and has a stable idle level. GPIO34 cannot provide an internal pull-up/down; add an external 3.3 V-domain bias if the module output needs one. Do not guess whether HIGH or LOW means fire. |

If either module's supply/output rating is unknown, stop at that row and send
clear front/back photos. Do **not** feed a 5 V `AO` or `DO` directly to the
ESP32. Espressif documents [input-only GPIO34–39 without internal pull
resistors](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html)
and [3.3 V-domain GPIO limits](https://documentation.espressif.com/esp32_datasheet_en.html).

Upload the read-only sketch in
[`code/diagnostics/paired-inputs-esp32`](../code/diagnostics/paired-inputs-esp32/)
with `pio run -t upload` from that directory. Open the monitor at 115200.
It reports the raw ADC value and raw fire-module level twice per second and
configures **no actuator outputs**. First confirm moisture ADC values change
between dry air and wet soil; record stable wet and dry values before choosing
a threshold. Do not immerse electronics above the sensing area. A fire input
reading is valid only with its module connected and stable;
an unconnected GPIO34 can float. Avoid open flames near the electronics.

### 10 October bench observation — not yet calibration

The user reported `moisture_adc` readings from **3327 to 4095** and
`fire_digital` normally `1`, with four consecutive `0` samples during a
deliberate fire test. This supports **active-low** fire polarity for the
connected module, matching `FIRE_SENSOR_ACTIVE_LEVEL = 0` in the current
firmware. It does **not** yet prove the module stays high during all ordinary
light/handling conditions.
GPIO34 must remain a verified 3.3 V-safe, stable input. Record at least a
no-stimulus interval and a controlled stimulus interval before enabling the
fire input in the main controller.

The moisture numbers were collected in soil; they are raw 12-bit ADC counts,
**not moisture percent**. A
reading of 4095 is at the ADC ceiling. The current firmware's provisional
`SOIL_DRY_THRESHOLD = 1800` would call **every reported sample dry**, so do
not enable irrigation from that threshold. Record repeated values in the
intended soil when thoroughly wet and when genuinely dry; confirm which
direction represents dryness, then choose a threshold between separated
ranges with hysteresis. Keep pump output disabled throughout calibration.

## 2. Output pins — reserved, not yet cleared for pump power

The full firmware currently has `ENABLE_PUMP_OUTPUTS`, `ENABLE_SERVO_OUTPUT`,
`ENABLE_FIRE_SENSOR_INPUT`, and `ENABLE_SOIL_MOISTURE_INPUT` all set to
`false` in `code/include/config.h`. Merely attaching wires will **not** turn
on the control loops. Keep those flags off during input commissioning.

| Function | ESP32 GPIO | Existing firmware assignment; **not a wiring instruction** |
| --- | ---: | --- |
| Fire pump direction/enable | 25, 26, 18 | L298N `IN1`, `IN2`, `ENA` in current code only; pump voltage/current unknown |
| Irrigation direction/enable | 32, 33, 23 | L298N `IN3`, `IN4`, `ENB` in current code only; **not yet cleared for connection** |
| Fire-nozzle servo signal | 14 | Position-control signal only; XY-MOS does not generate this signal |

The small pump kit is advertised for **3 V/5 V** and comes with a MOS control
board. The black pump's rating is not visible in its photograph; the Temu link
did not provide a usable rating. Both pumps have now spun when supplied
**directly** at 3.3 V and 5 V; that does not establish rated voltage, startup
current, or flow through an L298N. The L298N has **one shared `VS` motor
supply** for both bridges and loses substantial voltage under load. Its
`5V-EN` jumper commonly enables an onboard **logic regulator**; it does not
select 5 V pump output. The exact board wiring must be inspected. A two-pump
5 V `VS` arrangement remains a **test candidate**, not a demonstrated design:
at 1 A the [ST datasheet](https://www.st.com/resource/en/datasheet/l298.pdf)
specifies 1.8 V typical/3.2 V maximum total bridge drop, leaving roughly
3.2 V typical/1.8 V worst across a pump from a 5 V rail at that current.
Leave `ENABLE_PUMP_OUTPUTS=false` until each channel starts and flows reliably
at its measured load within the driver's thermal/current limits. The kit's
MOS board or XY-MOS might instead serve a pump **only after** its exact
terminals, trigger level, current rating, and switching
topology are verified. Neither is a servo position controller. A three-wire
servo needs its own regulated supply at its model's rated voltage (often about
5 V), adequate peak current, common ground, and the GPIO14 position signal.
Do not switch the servo's ground through XY-MOS as a substitute for that
signal. See the [pump/driver evidence](temu-pump-driver-research.md) and
[ST L298 datasheet](https://www.st.com/resource/en/datasheet/l298.pdf).

### Servo-only connection, after confirming its model permits 5 V

```text
regulated 5 V buck +  ───── servo power +  (often red)
regulated 5 V buck −  ──┬── servo ground   (often brown/black)
                         └── ESP32 GND
ESP32 GPIO14         ───── servo signal   (often orange/yellow/white)
XY-MOS              ───── not connected to servo
```

Follow the actual servo's label/pin order rather than wire color alone. The
ESP32 GPIO carries only the position signal, not motor current. If the ESP32
is powered by USB for this bench test, do not also join the buck's positive
5 V to the ESP32's 5 V/USB rail without verifying the board's power-path
design; the **grounds** must be common. Start with the horn/nozzle detached,
a center-position test, and a current-rated supply. Do not enable the main
firmware's full sweep until physical end stops are measured.

Before **any pump** power: identify both pump ratings, the L298N and MOS
board terminals/jumpers, and buck-converter current
limits. Add fusing and a physical emergency stop in the actuator supply while
keeping the ESP32 powered for fault reporting. Test one correctly supplied
pump at a time with bounded runtime, measured voltage/current, and safe water
handling. Do not dry-run a submersible pump.

After inputs and electrical limits are verified: finalize the two-pump driver
topology and firmware; prove its control pins with LEDs or a meter and **no
motor supply**; then prove each pump individually, then servo at
safe mechanical angles, then enable one bounded sensor–actuator loop at a
time. PWM duty is not a calibrated spray force or water volume. Never rely on
this prototype for actual fire protection.
