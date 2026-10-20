# Greenhouse setup and research report

## Current implementation

The protected server dashboard accepts a greenhouse name, farmer name, and
optional crop. The first save records a server-owned `setupAt` timestamp in
ignored `server/data/farm.json`. It sends the profile to the ESP32, which stores
it in NVS and acknowledges the save. Only that acknowledgement marks the farm
commissioned; later edits cannot restart the original 12-hour clock.
The report route is `/report/`. The server rejects report generation before
12 hours have elapsed and reads the last 12 hours of both private ThingSpeak
channels after that point. It labels missing data, raw ADC values and pump
commands honestly. Browser printing supports paper or Save as PDF. The server
does not yet bind profiles to separate authenticated owners; this is a
single-device prototype.

## ESP32 setup flow (compiled, hardware commissioning pending)

Activation: a greenhouse owner is ready when the ESP32 has saved their network
and profile across a power cycle **and** the dashboard has received a fresh
device-attributed reading. A form submission alone is not completion.

1. **Device nearby — required:** On first boot with no saved credentials, the
   ESP32 starts `AVATAR-<device suffix>` at `http://192.168.4.1`. It generates
   a unique 12-character WPA2 password, stores it in NVS, and prints it to the
   115200-baud Serial Monitor. Record that exact password on the unit's label
   before installing it. The setup page itself has no login.
2. **Join home network — required for remote access:** The phone joins the
   temporary ESP32 network, opens its setup address, sees scanned 2.4 GHz
   networks, selects one, and enters its password. The ESP32 saves SSID and
   password in NVS **only after a successful connection** and shows a
   specific success/failure state. The current join window is 60 seconds;
   the main-dashboard link appears only after that NVS save succeeds. A
   timed-out attempt is explicitly disconnected so a late radio connection
   cannot look like completed setup. A failed change retains the previous
   network. The temporary AP closes 30 seconds after success. Local sensing
   and protection continue regardless of network result.
3. **Name greenhouse — contextual:** Once connected to home Wi-Fi, the owner
   opens the main dashboard, enters their name and greenhouse name, and may add
   a crop. The server saves a copy, sends a versioned profile command to the
   ESP32, and waits for its NVS-write acknowledgement. The report clock starts
   at the first confirmed on-chip save. If the ESP32 is offline, the page says
   “waiting”; the server retries after it reconnects.
4. **Confirm — required:** Check the dashboard's separate ESP32 reading,
   profile-sync status, and ThingSpeak source. A test action is optional and
   must retain local actuator safety limits.

States: `unconfigured` → `setup AP active` → `credentials saved` →
`connecting` → `connected without telemetry` → `receiving telemetry` →
`profile synchronized` → `ready`. Wrong password, missing 2.4 GHz network,
router loss, failed server sync, and power loss each have a recoverable state;
none should stop local sensing or fire/irrigation policy.

## Security and deployment boundary

The nearby setup web page can be login-free because the unique WPA2 access
point is the physical-possession boundary. To reopen it, connect the physical
Serial console and send `p`; the existing home credentials are not erased.
The AP is not exposed as a setup page on the home LAN during AP+STA overlap.
Do not put its passphrase in Git, public photos, or screenshots. The current
NVS is not flash-encrypted; a commercial device needs flash/NVS encryption and
a documented lost-label recovery process.
The **remote** dashboard remains authenticated: device ID or possession of an
IP address is not proof of ownership. One ESP32 per farmer simplifies the
prototype's data model, but it does not remove this trust boundary.

The ESP32 cannot itself serve the internet dashboard when the farmer is away
from home. The current Node server must remain running and reachable for that
site; ThingSpeak stores history but is not the AVATAR site. Before claiming
this works remotely, verify server hosting, TLS, device-specific credentials,
profile synchronization, and a recovery path if the server or chip is replaced.
The current `SERVER_BASE_URL` is still configured in `code/include/secrets.h`;
for a LAN server, reserve that computer's IP in the router or update firmware
when it changes. This is not zero-configuration remote discovery.

## Immediate verification

1. With output power safely isolated, flash firmware and capture the AP name
   and unique password on Serial. Power-cycle: the same setup password must
   remain, and no pumps should energize from provisioning.
2. Connect a phone to the protected AP. Enter an intentionally wrong home
   password; confirm the page reports failure and allows retry. Enter the
   correct password; confirm an ESP32 LAN address and AP closure.
3. Power-cycle. Confirm the ESP32 reconnects without the setup AP. Save farm
   details on the main dashboard; confirm “waiting” changes to ESP32-confirmed.
4. Power-cycle both ESP32 and server; confirm profile and unlock time persist.
   After 12 hours, verify report print/PDF and no-data/offline states.

The firmware compiles and the server acknowledgement path passes an isolated
test. The protected AP has been observed on the USB-powered ESP32, but **the
revised 60-second join, NVS persistence across power loss, complete phone
flow, and real ThingSpeak report have not yet been verified on the assembled
board**. Do not call this field-commissioned yet.
