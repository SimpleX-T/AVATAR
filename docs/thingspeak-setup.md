# ThingSpeak setup for AVATAR greenhouse research

The modular ESP32 sends a live telemetry snapshot to the AVATAR server about
every five seconds. The server writes the newest sample to two **private**
ThingSpeak channels over HTTPS at most once per minute. The dashboard shows
fresh server observations first and can read the slower ThingSpeak archive
through the server; keys never appear in browser code. The controller still
acts locally when either network is down.
Pump/fault events also trigger an early ESP32 report to the server, so an
already-open dashboard can display an alert sooner than the cloud history
update. Email, SMS and push notifications are **not** implemented.

## Channels created on 18 October 2026

The two channels are private and configured for this greenhouse farming research
prototype:

- [Soil research — channel 3541112](https://thingspeak.mathworks.com/channels/3541112/private_show)
- [Climate and protection — channel 3541113](https://thingspeak.mathworks.com/channels/3541113/private_show)

Their eight fields, in order, are:

| Field | Soil channel | Environment & protection channel |
| --- | --- | --- |
| 1 | pH register 7, raw | DHT11 temperature, °C |
| 2 | EC register 2, raw | DHT11 relative humidity, % |
| 3 | N register 4, raw | MQ-6 analog ADC, raw/uncalibrated |
| 4 | P register 5, raw | MQ-6 comparator digital output, raw |
| 5 | K register 6, raw | Fire confirmed, 0/1 |
| 6 | Capacitive moisture ADC, raw | Irrigation pump commanded, 0/1 |
| 7 | Probe valid-register count, 0–5 | Fire pump commanded, 0/1 |
| 8 | Soil dry, 0/1 | Controller ready, 0/1 |

The ESP32 is currently on USB without the greenhouse board. Both channels
receive only a device status record; all measurement and output fields remain
empty until their peripherals are connected and validated.

The channel status field carries brief event/fault metadata. NPK, pH and EC
numbers are deliberately labelled **raw register values**, not nutrient
concentrations or calibrated pH/EC units. Pump fields show commands, **not**
proof of motor rotation or water flow.

Both channel IDs and their API keys are already in the ignored local
`server/.env` file. Do not send keys through chat, put them in ESP32 source,
or commit `.env`. A new machine needs its own local configuration based on
`server/.env.example`.

Restart the server. A telemetry report queues the newest snapshot. The server
attempts an upload at most once per minute. A failed or rejected ThingSpeak
write is retried with the latest snapshot at the next interval; old snapshots
may be replaced rather than replayed. This avoids an unbounded queue but does
**not** guarantee complete outage history yet.

## Verify

1. Start the server with `cd server && npm start`, then send a device telemetry report.
2. Wait about one minute; confirm a new entry in **each** private channel.
3. Open the AVATAR site and confirm fresh readings come from the field unit.
   The private ThingSpeak channels are the slower research archive and fallback.
4. Disconnect internet access briefly. Local sensor and pump decisions should
   continue; the site should show a cloud-unavailable/stale state.

This is a single-device prototype configuration. Before hosting a multi-farm
service, replace the shared device token and globally configured channel pair
with per-device credentials, farm membership, TLS at the server ingress, and
tenant-scoped channel lookup. Email/SMS notifications and durable outage
replay are not implemented by this setup.

Official API references: [write data](https://www.mathworks.com/help/thingspeak/writedata.html),
[read private channel feeds](https://www.mathworks.com/help/thingspeak/readdata.html),
and [channel field limits](https://www.mathworks.com/help/thingspeak/channel-settings.html).
