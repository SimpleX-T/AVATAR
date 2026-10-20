# Project AVATAR: manual actuator test

This standalone Arduino IDE sketch tests the **irrigation L298N channel, fire
L298N channel, and servo independently**. It does not read sensors or run an
automatic control loop. Each serial command starts just one output. There is
no separate `a` command or wet/dry calibration; nothing starts at boot.

Open [`avatar_manual_outputs.ino`](avatar_manual_outputs.ino) as the sketch.
Select **ESP32 Dev Module**, install **ESP32Servo**, and set Serial Monitor
to **115200**. If the Arduino IDE is showing an older `avatar_bench_test`
copy, uploading that copy will still produce `armed=NO` and `[INTENT]` logs;
the manual sketch instead prints `Project AVATAR manual actuator test`.

| Command | Only output driven | Automatic stop |
| --- | --- | --- |
| `i` | GPIO32 HIGH / GPIO33 LOW: L298N IN3/IN4, irrigation | 3 seconds |
| `f` | GPIO25 HIGH / GPIO26 LOW: L298N IN1/IN2, fire pump | 3 seconds |
| `v` | GPIO14 servo signal: 90 → 45 → 135 → 90° | About 4 seconds; 6-second limit |
| `x` | Stops the active test | Immediately when processed |
| `s` | Prints IDLE or the active test | — |

Run `i`, `f`, and `v` separately. A new start command while another test is
active prints `[BUSY]`; it does not start a second output. `x` is a software
stop, **not** a substitute for a physical actuator-power switch.

The L298N **ENA/ENB jumpers stay fitted**: do not connect GPIO18/23 to them.
With those jumpers fitted, both direction inputs LOW brake the motor rather
than disconnect the motor supply. Connect each pump to its matching L298N
output pair only after verifying the actual board's logic/motor supply path,
pump starting current, buck capacity, fuse, and correct pump voltage. The
separate **5V-EN** regulator jumper is *not* an output-voltage selector. If
the pumps use a regulated 5 V motor rail on a common board, 5V-EN normally
must be removed and both motor `VS` and logic `5V` correctly supplied;
confirm this against the actual PCB before powering it.
[ST L298 datasheet](https://www.st.com/resource/en/datasheet/l298.pdf) ·
[example L298N board guide](https://www.gotronic.fr/pj2-35233-eng-1776.pdf)

Power the servo from its **rated external supply**, with common ground and
GPIO14 for signal. The XY-MOS is not a servo controller. Start with its
horn/nozzle detached; do not assume that the full 0–180° travel is safe.
If the ESP32 is on USB, keep the external 5 V rail off its `5VIN` header.
Keep submersible pumps in water during powered tests, and run one pump at a
time with an accessible physical power cutoff. This bench sketch does not
test the optional XY-MOS third pump, MQ-6, or RS-485 soil sensor.
