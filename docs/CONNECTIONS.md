# Project AVATAR connection guide

This guide distinguishes the current software network from the updated physical
prototype. The head-node uses a 38-pin ESP32 with an existing 5S battery →
12 V buck → 5 V buck power path,
soil/climate/atmospheric sensors, a servo, two pumps, and a shared motor driver.
The current prototype uses wired sensors; wireless child nodes are a later
stage. Confirm exact sensor and driver models before treating any pin map as a
wiring instruction.

## Connection A: ESP32 to computer

```text
Computer USB port ─── USB data cable ─── ESP32 USB connector
```

The cable performs two jobs:

1. powers the ESP32; and
2. uploads firmware and carries serial logs.

If no serial port appears, try another cable. Many inexpensive cables provide
power but contain no data wires.

On Linux, identify the port:

```bash
pio device list
```

The port is usually `/dev/ttyUSB0` or `/dev/ttyACM0`.

## Connection B: computer and ESP32 to the same network

```text
                         ┌── Computer: Project AVATAR server
Wi-Fi router / hotspot ──┤
                         └── ESP32: telemetry client
```

The ESP32 does **not** connect to `localhost`. On the ESP32, `localhost` means
the ESP32 itself. It must use the computer's LAN address.

Find the computer address:

```bash
hostname -I
```

Choose the address belonging to the same Wi-Fi network as the ESP32, for
example `192.168.1.25`. The server URL then becomes:

```text
http://192.168.1.25:8787
```

If using a phone hotspot, connect both the computer and ESP32 to that hotspot.
Some hotspots isolate clients; if the ESP32 cannot reach the computer, use a
normal router or enable client communication in hotspot settings.

## Connection C: firmware to server

Create the local secrets file:

```bash
cd code
cp include/secrets.example.h include/secrets.h
```

Edit `include/secrets.h`:

```cpp
constexpr char SERVER_BASE_URL[] = "http://192.168.1.25:8787";
constexpr char DEVICE_ID[] = "project-avatar-001";
constexpr char DEVICE_TOKEN[] = "project-avatar-local-development-token";
```

`secrets.h` is ignored by Git. Do not move credentials into tracked files.
Home Wi-Fi is entered on the ESP32's protected setup page and saved in its
NVS, not in `secrets.h`. The server URL must still point to the reachable
computer or hosted server; reserve its LAN IP to avoid unexpected changes.

## Connection D: browser to dashboard

Start the server on the computer:

```bash
cd server
npm start
```

Open this address on the same computer:

```text
http://localhost:8787
```

From another device on the same Wi-Fi network, use:

```text
http://COMPUTER_LAN_IP:8787
```

The browser talks to the server. It does not talk directly to the ESP32.

## Current development data path

```text
ESP32 readings (current local schema)
       │
       ▼
ESP32 firmware
       │ HTTP POST or WebSocket stream
       ▼
Node server :8787
       ├── data/latest.json
       ├── data/telemetry.jsonl
       ├── realtime event/alert stream
       └── optional HTTPS write → two private ThingSpeak channels
                       │
                       ▼
                server-authorized read
                       │
                       ▼
                  Web dashboard

Dashboard simulation command
       │
       ▼
Node command queue
       │ ESP32 polls every 2 seconds
       ▼
ESP32 applies simulation command
```

The regular telemetry interval is 60 seconds; event changes trigger an earlier
report to the server. Fire detection and pump time limits run locally at their
own faster cadence. ThingSpeak publishing and private readback are available
after [channel setup](thingspeak-setup.md). Durable offline buffering remains
unimplemented.

## Run the current software prototype

Use three terminals.

### Terminal 1 — server

```bash
cd /home/devtochukwu/Documents/C.O.D.E/final_year_project/server
npm start
```

### Terminal 2 — upload

```bash
cd /home/devtochukwu/Documents/C.O.D.E/final_year_project/code
pio run --target upload
```

### Terminal 3 — ESP32 logs

```bash
cd /home/devtochukwu/Documents/C.O.D.E/final_year_project/code
pio device monitor
```

Expected logs:

```text
Project AVATAR controller ready (hardware mode).
[WIFI] Connecting to ...
[WIFI] Connected. ESP32 IP: 192.168.x.x
```

Telemetry should appear while the device and server are connected. This local
path does not verify ThingSpeak upload, farmer ownership, or offline recovery.

## Troubleshooting

### ESP32 connects to Wi-Fi but telemetry fails

Check:

1. `SERVER_BASE_URL` contains the computer LAN IP, not `localhost`;
2. the Node server is running;
3. both devices use the same network;
4. TCP port `8787` is allowed through the computer firewall; and
5. the token in `secrets.h` matches the server token.

For local development, the server's default token is:

```text
project-avatar-local-development-token
```

### Dashboard loads but says “Waiting for data”

The browser reached the server, but the ESP32 has not delivered telemetry.
Inspect the serial monitor for `[WIFI]` or `[HTTP]` messages.

### Upload fails

Press and hold the ESP32 `BOOT` button when PlatformIO displays
`Connecting...`, then release it after uploading begins.

## Updated hardware inventory and wiring status

The intended bench/farm model includes:

- a 5S battery with a first buck producing 12 V and a second buck producing
  5 V from that rail, plus a 38-pin ESP32;
- a five-probe RS-485 multi-parameter soil sensor, capacitive soil-moisture sensor, and DHT11;
- MQ-6 gas and fire sensors (LDR and PIR are deferred);
- one servo, irrigation and fire pumps, an L298N board, an XY-MOS board,
  and the small pump kit's included MOS controller.

The values below are the proposed firmware constants in `code/include/pins.h`.
They are not a validated wiring map. Verify the MQ-6 and fire-sensor output
voltage, driver terminals/current capacity, sensor power, and common ground before
attaching components.

The soil sensor is confirmed as an RS-485 unit (red VCC, black GND, yellow A,
green B) used with a MAX485 board. Its `RO` output can approach 5 V when supplied from
5 V and must be shifted to 3.3 V before an ESP32 pin. The label appears to
indicate EC, pH, and NPK. The supplier's generic V2.2 manual proposes Modbus
RTU 9600 8N1, slave 2, function 03, and a register table, but it contains
contradictory address examples and has not been validated against this unit.
The read-only diagnostics use those settings as a test hypothesis, not a
working measurement decoder. The
proposal, power topology, and bring-up sequence are in [the confirmed prototype
architecture](confirmed-system-architecture.md).

| Function | ESP32 GPIO | Connection type |
| --- | ---: | --- |
| RS-485 RX, TX, direction | 16, 17, 4 | MAX485; shift its RO output to 3.3 V |
| DHT11 data | 13 | Confirm pull-up and supply |
| Fire sensor output | 34 | Digital input; confirm active level |
| Capacitive moisture, LDR, MQ-6 | 35, 36, 39 | ADC1 inputs; maximum 3.3 V |
| Fire L298N IN1, IN2, ENA | 25, 26, 18 | Legacy mapping, disabled; pump rating unknown |
| Irrigation L298N IN3, IN4, ENB | 32, 33, 23 | Legacy mapping, disabled; electrical test pending |
| Servo, onboard LED | 14, 2 | Servo output disabled by default |

Never power a pump, valve, or servo from an ESP32 GPIO. Verify the motor
driver's compatibility with the pump type, supply voltage, stall current, PWM
frequency, and protection features. Use appropriate fusing, suppression,
separate load power, and common ground where required. Measure pump flow at the
actual nozzle and supply voltage; PWM duty is not itself a calibrated force or
water-volume measurement.
Both pumps spun directly at 3.3 V and 5 V, but their ratings, startup current,
and behavior through the L298N are not established. Both L298N channels share
one `VS` motor rail. The `5V-EN` jumper commonly enables an onboard logic
regulator; it does not select a 5 V pump output. Leave pump outputs disabled
until the actual board and both channels are tested at measured load, then
retain the allocation or revise it. The XY-MOS does not replace
the three-wire servo's position-control signal; power the servo at its model's
rated voltage from a suitably sized regulated rail. See the
[pump/driver evidence](temu-pump-driver-research.md).
Confirm the 5S pack's discharge protection before powered endurance tests;
the two buck converters do not replace battery protection. GPIO34 has no
internal pull-up/down, so the fire module must present a stable, verified
3.3 V-safe digital signal or use suitable external bias/interface hardware.

Before enabling physical outputs:

1. test every sensor and record its normal range;
2. test output pins with LEDs or a multimeter instead of real loads;
3. confirm whether each driver board is active-high or active-low;
4. add a physical emergency-stop switch;
5. verify that one pump's operation cannot unintentionally energize the other;
6. test bounded run time, cooldown, and power-loss behavior; and
7. change output enable flags only after those checks pass.

## Farmer setup status

The firmware now compiles with a protected temporary setup Wi-Fi network and
on-chip storage for home Wi-Fi credentials and the farm profile. The server
sends the profile to the ESP32 and waits for its acknowledgement. These flows
still need commissioning on the assembled board; see
[the setup and report guide](greenhouse-onboarding-and-report.md). Remote
account/device claiming is not implemented. A printed device ID alone must
never be treated as proof of ownership, and a permanent credential must not
appear in a publicly visible QR code.

## Planned data collection

The head-node should sample sensors at rates appropriate to each sensor, attach
sensor identity, location, units, calibration/version, and observation time,
then aggregate readings before uploading. A bounded persistent queue should
retain unsent records during Wi-Fi/cloud loss and retry with backoff after
reconnection. Local safety rules must not wait for ThingSpeak or the dashboard.
The proposed ThingSpeak field allocation and 60-second upload cadence are in
[the architecture plan](confirmed-system-architecture.md); implementation and
duplicate/replay handling remain open.

## Planned 2 x 3 ft actuation demonstration

The current inventory supports one irrigation pump and one fire pump, one soil
moisture measurement point, one fire detection point, and no valves. This can
demonstrate simple bounded watering and a servo-directed fire spray, but not
independent zones or multiple nozzles. Confirm whether each pump is suitable
for the liquid and duty cycle, and give each pump a driver and rail proven for
its actual voltage/current. A hot-weather air-misting action needs a
separate design decision; it is not included in the current two-pump inventory.
