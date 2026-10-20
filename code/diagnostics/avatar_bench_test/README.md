# Project AVATAR: standalone integrated bench firmware

This build combines the capacitive moisture sensor, fire sensor, DHT11, MQ-6,
two pump channels, fire servo, and five-register RS-485 soil probe in one ESP32
program. It remains a supervised prototype: the local page is **not** remote
farmer notification, and this build does not upload to ThingSpeak.

Upload [avatar_bench_test.ino](avatar_bench_test.ino) to the removable ESP32
with Arduino IDE. Select **ESP32 Dev Module** and install **DHT sensor library**,
**Adafruit Unified Sensor**, and **ESP32Servo**. Wi-Fi and WebServer are in the
ESP32 board package.

The sketch uses [standalone_policy.h](standalone_policy.h),
[manual_policy.h](manual_policy.h), and a local `wifi_secrets.h` in the same folder
and the shared [RS-485 frame validator](../soil-probe/include/rtu_frame.h).
Keep the repository's `code/diagnostics` structure intact; pasting only the
`.ino` into another Arduino IDE sketch will not compile. PlatformIO builds
from this directory; use `pio run -d code/diagnostics/avatar_bench_test -t
upload` from the repository root when the ESP32 is connected over USB.

Before building, copy [wifi_secrets.example.h](wifi_secrets.example.h) to
`wifi_secrets.h` and set the Wi-Fi name, password, and a separate random
control PIN. The actual secrets file is Git-ignored; do not share it.

**No internet, ThingSpeak, or command is needed.** After you
reinstall the ESP32 and power the standalone board from regulated 5 V, it
samples all connected sensors, operates the two bounded pump responses,
flashes an external status LED in Morse, and serves a local dashboard on its
configured Wi-Fi LAN. This is bench firmware, not a certified
fire/gas protection system or the final cloud firmware.

## Wiring map

| Device | ESP32 connection | Power / note |
| --- | --- | --- |
| Direct capacitive moisture sensor AO | GPIO35 | Use its verified supply; output no more than 3.3 V. |
| Fire module DO | GPIO34 | Verified active LOW; output no more than 3.3 V. |
| DHT11 data | GPIO13 | Data pull-up no higher than 3.3 V. |
| MQ-6 AO | GPIO39 | Use its own 5 V-to-~3 V divider. Raw ADC only. |
| MQ-6 DO | GPIO36 | Use a **second** 5 V-to-~3 V divider. Raw state only. |
| Fire L298N IN1 / IN2 | GPIO25 / GPIO26 | Fire pump on OUT1 / OUT2. |
| Irrigation L298N IN3 / IN4 | GPIO32 / GPIO33 | Irrigation pump on OUT3 / OUT4. |
| Servo signal | GPIO14 | Brown to common GND; red directly to rated 5 V rail, not via ESP32 5VIN. |
| MAX485 RO | GPIO16 through the already-tested level divider | RO is 5 V; never connect it directly to ESP32. |
| MAX485 DI | GPIO17 | ESP32 UART transmit. |
| MAX485 tied DE + /RE | GPIO4 | HIGH when transmitting, LOW when receiving. |
| Probe A/B | MAX485 A/B | Preserve the wiring that produced valid replies; shared ground and probe-rated supply. |
| External status LED | GPIO22 → 330 Ω → LED anode; cathode → GND | Solid ON during confirmed fire; otherwise Morse. |

All grounds join. PIR and LDR are intentionally removed from this build. The
XY-MOS third pump is not connected. Leave L298N
**ENA and ENB jumpers fitted**, and do not
connect ESP32 GPIO18/23 to them.

For each MQ-6 output, connect **output → 10 kΩ → GPIO node → 15 kΩ → GND**.
At 5 V HIGH, the GPIO node is about 3 V. Keep the two GPIO wires disconnected
while you first power the MQ-6 and measure the divider nodes; attach them
only after confirming each is **at most 3.3 V**. The MQ-6 module itself needs
its rated 5 V supply and heater current. Its comparator DO polarity/threshold
has not been calibrated; LED G means **raw DO=0**, not “gas detected.” Its ADC
reading is **not ppm**. Do not test combustible gas near an open flame.
[Winsen MQ-6 specifications](https://www.winsen-sensor.com/product/mq-6.html)

## L298N 5 V supply: check before pump power

For the documented common L298N board style at a **5 V motor supply**:

1. Remove the separate **5V-EN** regulator jumper.
2. Connect regulated 5 V to motor-supply VS (often marked +12V) **and** to
   logic 5V; connect GND.
3. Leave ENA/ENB jumpers in place. Connect each pump to its assigned output
   pair. Keep submersible pumps in water and outlets aimed away from electronics.

Check the **actual board's** printed labels/jumper layout first. Feeding 5 V
only into its 5V logic terminal with 5V-EN fitted can reverse-feed the wrong
rail. Measure voltage across each pump *while it runs*, buck voltage under
load, driver heating, and current before calling a run successful. The L298N
has a substantial output-voltage drop, so a 5 V input does not promise 5 V
across a pump. Keep a physical actuator-power cutoff available.
Working on the bench does **not** establish a rated operating point: ST's
L298 electrical table specifies motor supply `VS ≥ input-HIGH voltage + 2.5 V`.
With an ESP32 HIGH near 3.3 V and `VS = 5 V`, this combination is outside
that guaranteed condition. Use a suitably rated low-voltage MOSFET switch or
motor driver for a field build, and measure the actual pump current and
driver temperature before lengthening any run. The short/long timings below
are provisional software bounds, not a motor duty rating.
With ENA/ENB jumpered, the bridge is enabled even while ESP32 pins are
high-impedance during boot. Keep motor VS separately switched OFF until
startup, or provide a verified hardware input bias/interlock on the actual
module; firmware cannot control pins before it starts.
[L298N board guide](https://www.gotronic.fr/pj2-35233-eng-1776.pdf) ·
[ST L298 datasheet](https://www.st.com/resource/en/datasheet/l298.pdf)

## Upload and standalone run

1. Turn standalone-board power **OFF**. Remove the ESP32. Upload the sketch
   using USB. Unplug USB before reinstalling the ESP32 in its socket.
2. Verify the regulated 5 V rail, shared grounds, MQ-6 GPIO voltage
   limits, L298N power jumper/terminals, and that the buck can supply the
   ESP32, Wi-Fi, MQ-6 heater, servo, and one running pump.
3. Reinstall the ESP32 with power OFF. Keep the pump-power switch OFF for
   initial boot. Switch on regulated 5 V to ESP32 5VIN, servo rail, and
   sensors. The LED sends Morse **B** during a 10-second startup. Motor
   direction pins are driven LOW at the start of setup.
4. Connect a phone or computer to the **same router Wi-Fi** as the ESP32.
   Read `AVATAR_LAN_IP` from USB serial at 115200 baud after Wi-Fi connects,
   or find `avatar-bench` in your router's device list. Open
   `http://<AVATAR_LAN_IP>/`. The page has status and PIN-gated controls;
   it is not accessible from the internet unless you expose the LAN yourself.
5. Put the capacitive sensor in wet soil and check ADC is below **2408**.
   Enable pump power only after the page shows READY, dry soil NO, and fire
   DO 1. Move the sensor to dry soil: ADC above **2928** for 3 seconds starts
   irrigation until the soil reads wet or a 15-second burst ends. Present
   the fire sensor with its
   controlled stimulus *away from electronics and MQ-6 testing*: confirmed
   DO 0 starts fire pump/servo for a 10-second burst and preempts irrigation.

The chemistry probe starts its first read about three seconds after boot, then
reads all five registers roughly once per minute in a separate task. A slow or
disconnected probe cannot hold up the fire/irrigation control loop.

Those moisture numbers came from the previously accepted capture
(dry-on=2928, wet-off=2408) with this direct capacitive sensor. They are
**bench thresholds, not percent moisture**. If installed readings no longer
separate cleanly, keep pump power OFF and recalibrate; do not simply lower
the threshold until the pump runs. Watering runs at most **15 seconds**, then
waits **30 seconds** for moisture to reach the sensor. If the soil is still
dry, one more bounded attempt is allowed. Still-dry soil after two attempts
stops only watering and raises a water-path alert. A genuinely wet reading
clears that fault automatically; a PIN-gated reset after physical inspection
also permits a new bounded cycle. An invalid capacitive reading during pumping
stops watering immediately. The alert says **check tank, pump, hose, and
sensor**: dryness alone cannot prove the tank is empty. After a completed wet
cycle, watering observes a 60-second cooldown. Confirmed fire runs in at most
**three 10-second bursts**, with **3-second rests** if fire remains detected.
The pump stops after the fire input stays clear for 500 ms. If fire persists
after three bursts, only the fire response faults; the sensor, dashboard,
chemistry probe, and other channels remain alive. Ten seconds of clear fire
input automatically rearms the fire response. The servo sweep stays at 45–135°.
DHT11, MQ-6 and the RS-485 probe do **not** start pumps. Their values are
visible on separate phone-page cards. The probe uses 9600/8N1, slave 2,
function 03, and registers pH=7, EC=2, N=4, P=5, K=6: the settings that gave
valid replies on this ESP32. Manual-based units are provisional; zero N/P is
**not** proof of nutrient-free soil. The page flags a missing or stale reply
instead of displaying it as current data. The page also shows why irrigation is waiting,
the last commanded pump event, and whether servo signal attachment succeeded.
An exhausted fire response stops only another fire cycle; it does **not** stop
irrigation once the fire input is clear. An actively LOW fire input still
preempts irrigation. “Pump commanded on” is a firmware state, **not** proof
that voltage reached the pump or that the pump turned.

The dashboard appends one timestamped diagnostic line every two seconds.
It keeps the latest 300 lines (about 10 minutes). Tap **Copy log** and paste
the result into the chat. The log exists only while that browser page stays
open; copy it before closing or reloading. The page does not measure the
5 V rail: use a multimeter to measure buck output, post-diode rail, and
servo/driver voltage while a pump is commanded on. Do **not** raise the buck
above 5 V to compensate for an unmeasured load-dependent voltage drop.

If the page says **Fire fault: INSPECT** and **Pumps off**, the
controller exhausted its three fire attempts; this does not prove the fire
pump physically ran. That fault does not suppress irrigation after the fire
input is clear. The **Irrigation state** row explains other reasons for an OFF
pump, including dry confirmation, the 30-second soak, a 60-second post-wet
cooldown, or paused automatic watering. If the page says
**Fire pump commanded on** but the motor stays still, measure voltage across
the motor's two output terminals during that command, then compare it with
motor VS and the 5 V buck output. Clip the meter probes with power OFF before
the short test window; do not move loose probes near wet electronics.

For a servo that jitters instead of sweeping, test with its horn/nozzle
removed and the pumps' motor-supply rail switched off. The page's **Servo
attach at last fire start** confirms only that the ESP32 PWM library attached
to GPIO14; it does not measure signal pulses, supply voltage, or motion.
Measure between the servo's own red and brown wires at idle and during a
held fire stimulus. Compare with the buck output and the post-diode rail.
A DC multimeter reading on the orange PWM wire is **not** a valid test of the
50 Hz pulse widths. The **Last output event** distinguishes a full 10-second
fire burst from a cycle stopped when the fire input cleared. A sweep
from 45° to 135° takes roughly 1.6 seconds in this sketch; a shorter fire
cycle may produce only a twitch. Do not force the servo shaft by hand while
it is powered.

## LED Morse key

Dots are short; dashes are three times as long. If multiple read-only
events are present, the LED alternates their letters.

| Letter | Pattern | Meaning |
| --- | --- | --- |
| B | −··· | Boot delay or fire input has not shown stable idle HIGH. |
| E | · | Healthy heartbeat; no read-only condition selected. |
| G | −−· | MQ-6 raw DO=0; **not** a calibrated gas alarm. |
| H | ···· | DHT11 reads ≥35 °C **and** ≤55% RH; demo threshold, no mist pump. |
| F | ··−· | Fire confirmed or fire pump is locked out after its cycle. |
| X | −··− | Soil/DHT input invalid or LAN disconnected. Check the dashboard when available. |

The LED communicates states, not exact analog values; the local page shows
sensor numbers. The dashboard's PIN-gated POST controls are for a trusted
local network and supervised bench only; HTTP is unencrypted. Do not forward
port 80 or use it on a shared/public Wi-Fi. A software stop is not a physical
emergency disconnect.

To use controls: enter the control PIN, pause automatic watering, then select
one test. Pump tests deliberately last two seconds; the servo-only test lasts
three seconds. These short tests are **not** the automatic/live response.
Live watering requires valid dry soil and retains the wet stop / bounded
retry policy. A manually requested fire response runs for at most ten seconds;
automatic fire detection may use three bounded bursts.
STOP ALL latches the software stop. After physical inspection, use Reset after
inspection; resume automatic watering separately. Fire detection retains
priority over irrigation and servo tests. No software counter confirms pump
rotation, flow, available tank water, or safe motor temperature.

## Next hardware improvement: water availability

Add a low-level switch to **each** tank and a flow sensor on each pump outlet.
Level answers “is there water available?”; flow answers “did water actually
move?” A pump-command GPIO and a still-dry soil sensor cannot distinguish an
empty tank from a disconnected hose, blocked nozzle, failed pump, or delayed
soil response. Once those sensors are installed and validated, stop a pump on
no-flow/low-level, record the specific fault, and send it through the future
remote notification path. Until then, retain the short fire-pump safety cutoff
and do not run this prototype unattended as fire protection.
