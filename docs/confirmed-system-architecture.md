# Project AVATAR: Confirmed Prototype Architecture

**Status:** design baseline for the 2 x 3 ft wired demonstration.
**Last reviewed:** 14 October 2026. Bench wiring is proven, modular firmware
integration is built but not yet field-tested.

Project AVATAR is an off-grid-capable agriculture data collection, management,
and protection prototype. The current build is one wired ESP32 head-node. It
must make bounded local decisions even when Wi-Fi or ThingSpeak is unavailable;
the cloud records and presents farm data but is never the safety controller.

## Confirmed hardware and implications

| Item | Confirmed fact | Engineering implication |
| --- | --- | --- |
| Head-node | 38-pin ESP32 | One wired controller now; remote child nodes come later. |
| Main soil probe | Five-probe RS-485 sensor | Digital serial integration, not an ESP32 analog input. The label appears to select EC, pH, and NPK; it does not confirm temperature, moisture, or a Modbus protocol. |
| RS-485 board | MAX485, terminals `VCC B A GND`; logic `RO RE DE DI` | Needs direction control. `RO` can approach 5 V when the board is powered at 5 V and must be level-shifted before the ESP32. |
| Power | 5S battery → first buck to 12 V → second buck to 5 V | This two-stage conversion is already in place. Confirm regulator current capacity and voltage stability under pump startup load. Solar charging is deferred because the appropriate 5S BMS is unavailable. |
| Pump drivers | L298N plus XY-MOS and the small pump kit's MOS board | Both pumps spun directly at 3.3 V and 5 V, but ratings and current are unknown. The L298N's bridges share one motor supply and have a substantial voltage drop; two-pump use at 5 V `VS` is a bench hypothesis, not yet proven. |
| Hydraulics | 2 pumps, 1 capacitive sensor, 1 fire sensor, no valves | One irrigation area and one fire-spray response; not multi-zone control. |

## Power and safety topology

```text
5S battery
  └─ first buck: regulated 12 V ──┬─ second buck: regulated 5 V ──> ESP32, MAX485, sensors
                                  └─ actuator branch: OFF until pump ratings and drivers are verified

Possible later: separately fused/rated 12 V and 3–5 V actuator branches,
each with a verified compatible driver. No pump-to-branch allocation yet.

All logic grounds join at one deliberate common-ground point.
ESP32 GPIO pins never power a pump, servo, or sensor load.
```

The servo needs a regulated branch at **its model's rated voltage**, commonly
around 5 V, with enough peak current; neither the ESP32 3V3 pin nor XY-MOS
produces servo position control. GPIO14 is the proposed control signal. Add a
physical emergency-stop that removes pump power while leaving the ESP32 powered
for fault reporting. The present build does not include solar charging; add a
correctly rated 5S BMS and charger before enabling it. A BMS protects cells but
does not replace either buck converter.

The existing bucks do **not** establish that the 5S pack has over-discharge,
over-current, cell-balancing, or short-circuit protection. Confirm the pack's
protection arrangement before powered endurance tests; do not run an
unprotected lithium pack unattended. Record 12 V and 5 V rails during pump
startup, not only at idle.

## Proposed pin budget — test before wiring

This allocation removes obsolete chemigation/valve/directional-flame pins and
keeps analog sensors on ADC1 pins, usable while Wi-Fi is active. It is a
proposal, not proof that every attached module is 3.3 V-safe.

| Function | ESP32 GPIO | Notes |
| --- | ---: | --- |
| RS-485 `RO` → UART2 RX | 16 | 5 V → 3.3 V level shifter or resistor divider required. |
| UART2 TX → MAX485 `DI` | 17 | ESP32 output is appropriate for the transceiver input. |
| MAX485 `DE` and `RE` tied | 4 | LOW = receive; HIGH = transmit. |
| DHT11 data | 13 | Proper 3.3 V pull-up arrangement. |
| Fire digital output | 34 | Input-only, no internal pull-up/down; verify active level and external bias safely. |
| Capacitive moisture analog | 35 | ADC1; maximum output 3.3 V. |
| MQ-6 digital output | 36 | Input-only; 5 V output needs a divider. |
| MQ-6 analog output | 39 | ADC1; 5 V output needs a divider. |
| Fire pump L298N `IN1`, `IN2` | 25, 26 | ENA jumper fitted on the bench build. |
| Irrigation L298N `IN3`, `IN4` | 32, 33 | ENB jumper fitted on the bench build. |
| Servo | 14 | Confirm mechanical stops before any sweep. |
| External status LED | 22 | Status only, with series resistor. |

The current L298N firmware allocation must be **verified or revised** before
enabling pump outputs. The user has spun both pumps directly at 3.3 V and 5 V,
but this does not prove either works through the driver's voltage drop or
establish a rated voltage. Its two bridges share `VS`; the `5V-EN` jumper
commonly controls the onboard logic regulator, **not the pump voltage**. If
`VS` receives 12 V, that is not a 5 V motor test. A MOS board may be a more
suitable switch for a single-direction pump, but its **actual** terminal labels,
3.3 V trigger compatibility, current capacity, and flyback handling must be
confirmed. Inspect the L298N board's exact 5 V jumper/regulator arrangement
before attaching the 5 V buck. Never infer the black pump is 12 V from its
appearance. See [pump/driver evidence](temu-pump-driver-research.md).
The [ST L298 datasheet](https://www.st.com/resource/en/datasheet/l298.pdf)
specifies a 1.8–3.2 V total bridge drop at 1 A: a regulated 12 V supply does
not imply 12 V across a running pump. PWM duty is not a calibrated spray-force
control; measure real voltage, flow, and heat at the intended nozzle. Espressif
documents that [GPIO34–39 have no software pull-up/down](https://github.com/espressif/esp-idf/blob/master/docs/en/api-reference/peripherals/gpio/esp32.inc),
so a floating fire signal must not be used for automatic actuation.

## RS-485 soil probe wiring and validation

```text
Probe red VCC      ──> regulated probe VCC
Probe black GND    ──> common ground
Probe yellow A     ──> MAX485 A
Probe green B      ──> MAX485 B

MAX485 VCC ──> 5 V             MAX485 GND ──> common ground
MAX485 DI  <── ESP32 GPIO 17   MAX485 RO ──> level shifter ──> ESP32 GPIO 16
MAX485 DE + RE tied ──> ESP32 GPIO 4
```

`A`/`B` names differ between vendors. If verified software configuration does
not communicate, power off and swap only A/B. Confirm whether the sensor uses
Modbus RTU at all, then obtain its address/register map, baud rate, parity,
scaling, and units. A controlled read-only scan is appropriate only after the
protocol is identified. Validate readings against known soil/reference
measurements. Until then every soil-probe value is `unverified`.

## Runtime design: efficient without blind spots

Deep sleep is **not** the default for this head-node. Fire detection, irrigation
limits and the MQ-6 heater require a live controller; sleeping
creates blind periods and invalidates gas readings. Use a non-blocking active
control loop with independent sensor, control, and upload schedules. The current
firmware runs blocking network requests in a separate ESP32 task and copies
controller state under a mutex before transmission; the local control loop
continues while the server is slow or unreachable.

| Work | Initial cadence | Rule |
| --- | --- | --- |
| Fire sensor | 100–250 ms | Immediate local priority with a short confirmation filter. |
| Pump/servo safety | every loop | Max run, cooldown, emergency stop, fire priority. |
| DHT11 | 60 s | Do not continuously poll this low-accuracy sensor. |
| Capacitive moisture | 60 s | Moving median and calibrated wet/dry values. |
| LDR | deferred | Removed from the current prototype; no demonstrated use case. |
| MQ-6 | 60 s after warm-up | Calibrated/relative gas state only after warm-up plan. |
| RS-485 pH/EC/NPK | 10–15 min | One complete CRC/range-validated transaction. |
| Cloud snapshot | 60 s | Latest valid values/action state; alarms may be immediate. |

A ThingSpeak free account permits updates every 15 seconds and each channel has
at most eight fields. The current server writes at most once a minute, keeps
the newest unsent snapshot in memory, and retries after failure. Durable
NVS/LittleFS replay remains future work; outage history is not guaranteed.

Deep sleep belongs later on battery child nodes that only take periodic,
non-safety readings. The always-on head-node receives those readings and retains
safety responsibility.

## ThingSpeak and dashboard boundary

Use **private** ThingSpeak channels. The dashboard reads ThingSpeak through the
Project AVATAR server. The present single-device server has sign-in but does
not yet enforce farm membership; do not host it as a multi-tenant service. Never put
channel read/write keys or another farmer's channel ID into browser code.

One channel cannot represent all values meaningfully because it has eight
fields. Create two channels per head-node:

| Channel | Fields |
| --- | --- |
| `soil` | raw pH, EC, N, P, K registers; capacitive ADC; valid-register count; dry state |
| `environment-and-protection` | air temperature, humidity, MQ-6 AO/DO raw, fire state, irrigation state, fire-pump state, controller readiness |

For this prototype, the server holds both channel read/write keys in its local
ignored `.env`; the ESP32 sends authenticated telemetry to the server. A real
`account → farm → device → channels` mapping has not yet been implemented.
The channel status field holds brief event/fault metadata.

## Farmer claim and Wi-Fi provisioning

**Activation contract:** a farmer is activated when their claimed head-node has
delivered a fresh, device-attributed reading to their farm dashboard, evidenced
by a timestamped ThingSpeak entry and recorded device heartbeat.

```text
Box QR: setup URL + public device ID
  → farmer verifies email and creates/selects a farm
  → farmer enters a concealed one-time code supplied inside the box
  → server opens a short-lived, resumable claim session
  → ESP32 temporary setup Wi-Fi access point opens provisioning page
  → farmer submits farm Wi-Fi only over that local setup link
  → ESP32 authenticates with its unique device credential
  → server binds device to farm and channel mapping
  → fresh telemetry → safe LED-only commissioning test → ready
```

The visible QR contains no Wi-Fi password, claim secret, permanent device
secret, or ThingSpeak key. A printed device ID alone is not ownership proof;
the concealed code and authenticated device handshake establish possession.
Keep account identity, farm
membership, one-time claim, device credential, and ThingSpeak credentials
separate. Setup must represent `waiting`, `wrong-network`, `offline`,
`receiving`, `ready`, and `revoked` explicitly—not one vague “online”
state.

## Demonstration control policy

1. Fire response outranks irrigation: confirmed fire stops irrigation, runs a
   bounded fire-pump routine, and sweeps only inside verified servo limits.
2. Irrigation is one zone: confirm dryness over time, run for a calibrated
   maximum, then cool down. PWM is a trial input, not water-volume proof.
3. Manual controls are bounded: server commands expire; ESP32 rejects duplicate,
   unsafe, or unsupported requests and acknowledges physical application.
4. Internet is observability, not permission to stay safe: cloud loss cannot
   disable local fire or irrigation limits.

The October integrated bench build runs irrigation in at most two 15-second
bursts, separated by a 30-second soak/recheck. Still-dry soil after both bursts
faults **only the irrigation channel**; a wet reading automatically clears it.
Fire response runs at most three 10-second bursts with 3-second rests while
the fire input remains active. A confirmed clear input stops spraying and,
after ten seconds idle, rearms an exhausted fire channel. This is not an
empty-tank or extinguished-fire diagnosis: the prototype has no flow, tank
level, motor-current, or flame coverage verification. A previous fire fault
does not disable irrigation after the fire input clears; a currently active
fire input still takes priority. The ESP32 and Wi-Fi are never rebooted just
to clear a channel fault. Add a low-level switch to each tank and flow sensing
at each outlet before autonomous field deployment. Fire alerts must be issued
as soon as detection is confirmed, including while spraying; the present
local-only page/LED cannot notify a remote farmer. Retain finite pump limits
until water availability, flow, and motor duty are directly verified.

For the main system, publish distinct events for `FIRE_CONFIRMED`,
`FIRE_RESPONSE_EXHAUSTED`, `FIRE_CLEARED`, `WATER_PATH_SUSPECTED`, and
`WATER_RECOVERED`. Persist event ID, device ID, UTC time, sensor evidence,
attempt count, and acknowledgment state locally before asynchronous upload.
The server should notify the farmer from these events and deduplicate retries;
the normal ThingSpeak snapshot interval is not an immediate alert channel.

## Delivery sequence to 20 October

1. Verify the existing 12 V → 5 V conversion under load; add fuse/emergency
   stop; establish both pump ratings and identify each MOS board's terminals.
2. Prove each sensor alone: DHT11, capacitive, fire, LDR/MQ-6 voltage
   limits, then RS-485 read-only transactions.
3. Bench-check the revised firmware pin map and single-sensor fire policy. The
   legacy chemigation, valve, and three-fire paths have been removed.
4. Revise the two-pump driver allocation; prove outputs with LEDs/multimeter,
   then individual pumps at their rated voltage with safe water handling;
   add limits and emergency stop before integrated actuation.
5. Add private ThingSpeak channels, 60-second snapshots, queue/retry, and a
   server-authorized dashboard proxy.
6. Build QR claim, temporary ESP32 setup AP, account/farm binding, and
   fresh-telemetry commissioning evidence.

## Facts still needed before real pump automation

- Pump labels/photos: voltage, current or wattage, and intended liquid/nozzle.
- L298N, XY-MOS, kit MOS board, and servo front/back photos or exact ratings.
- Supplier's generic soil-probe manual has arrived; verify that its 9600/2
  settings and register table produce a valid reply from this exact unit.
- MQ-6 and fire-module photos/labels, including output voltage/type.

Those facts do not block documentation or sensor-software structure, but they
do block responsible pump connection and automation.
