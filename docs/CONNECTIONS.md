# Night Garden connection guide

This guide starts with the equipment available now: one ESP32 development board,
one USB data cable, a Wi-Fi router or phone hotspot, and a computer.

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
                         ┌── Computer: Night Garden server
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
constexpr char WIFI_SSID[] = "Your Wi-Fi name";
constexpr char WIFI_PASSWORD[] = "Your Wi-Fi password";
constexpr char SERVER_BASE_URL[] = "http://192.168.1.25:8787";
constexpr char DEVICE_ID[] = "night-garden-001";
constexpr char DEVICE_TOKEN[] = "night-garden-local-development-token";
```

`secrets.h` is ignored by Git. Do not move credentials into tracked files.

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

## Complete development data path

```text
Simulated readings
       │
       ▼
ESP32 firmware
       │ HTTP POST every 5 seconds
       ▼
Node server :8787
       ├── data/latest.json
       ├── data/telemetry.jsonl
       └── realtime event stream
                       │
                       ▼
                  Web dashboard

Dashboard command
       │
       ▼
Node command queue
       │ ESP32 polls every 2 seconds
       ▼
ESP32 applies simulation command
```

## Run the complete system

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
Night Garden controller ready (simulation mode).
[WIFI] Connecting to ...
[WIFI] Connected. ESP32 IP: 192.168.x.x
```

Telemetry should appear on the dashboard within five seconds.

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
night-garden-local-development-token
```

### Dashboard loads but says “Waiting for the garden”

The browser reached the server, but the ESP32 has not delivered telemetry.
Inspect the serial monitor for `[WIFI]` or `[HTTP]` messages.

### Upload fails

Press and hold the ESP32 `BOOT` button when PlatformIO displays
`Connecting...`, then release it after uploading begins.

## Future physical wiring

Keep `SIMULATION_MODE = true` and `ENABLE_PHYSICAL_OUTPUTS = false` until the
sensor-only network path is stable.

| Function | ESP32 GPIO | Connection type |
|---|---:|---|
| Onboard connection LED | 2 | Built into most ESP32 DevKit boards |
| DHT11 data | 4 | Digital input, commonly with a 10 kΩ pull-up |
| PIR output | 14 | Digital input |
| Flame left / centre / right | 34 / 35 / 32 | Analogue input |
| LDR divider output | 36 | Analogue input |
| Capacitive soil sensor | 33 | Analogue input |
| Fire servo signal | 18 | PWM signal; external servo power |
| Fire pump / valve driver | 25 / 21 | MOSFET or relay driver input |
| Irrigation pump / valve driver | 22 / 23 | MOSFET or relay driver input |
| Chemigation pump / valve driver | 19 / 17 | MOSFET or relay driver input |
| Buzzer / external status LED | 26 / 27 | Driver input / digital output |

Never power a pump, valve, or servo from an ESP32 GPIO. Use an appropriately
rated external supply, MOSFET or relay driver, flyback protection for inductive
loads, fusing, and a shared logic ground.

Before enabling physical outputs:

1. test every sensor and record its normal range;
2. test output pins with LEDs or a multimeter instead of real loads;
3. confirm whether each driver board is active-high or active-low;
4. add a physical emergency-stop switch; and
5. change `ENABLE_PHYSICAL_OUTPUTS` only after those checks pass.
