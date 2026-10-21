# Hosted dashboard cutover (Render)

The browser, Node server, ThingSpeak bridge, and ESP32 command endpoint run as
one Render web service. The ESP32 continues local irrigation/fire decisions when
the internet is unavailable. Its outgoing connection uses HTTPS and WSS; no
router port forwarding is required. The dashboard is served at
`https://<service>.onrender.com/` once the service exists.

## What is ready in this repository

- `render.yaml` defines one Node service, a 1 GB persistent disk for farm
  profile and local telemetry, a health check, and secret environment fields.
- Production refuses to start without a strong device token, Privy app
  credentials, and at least one approved Privy operator user ID.
- The ESP32 source supports verified HTTPS/WSS and waits for its clock to sync
  before TLS certificate checks. The currently flashed LAN build has not been
  replaced by this cloud configuration.

## Cutover sequence

1. In Render, create a Blueprint from `simplex-t/avatar` using `render.yaml`.
   The persistent web-service plan and disk incur charges. Set the required
   secret environment values in Render; never commit or paste them into chat.
   `PROJECT_AVATAR_DEVICE_TOKEN` must be a strong random secret and later match
   `DEVICE_TOKEN` in the ESP32's ignored `code/include/secrets.h`. The old
   local `NIGHT_GARDEN_DEVICE_TOKEN` is a bench placeholder and must not be
   used publicly. The new value is staged privately in the ignored
   `server/.env.render` file; copy only its value into Render without posting
   it anywhere. The ESP32 will be flashed with that same value at cutover.
   Set `PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
   and `PROJECT_AVATAR_OPERATOR_USER_IDS` (comma-separated Privy user IDs).
   If the first operator ID is unknown, set this field temporarily to
   `pending-operator`: nobody can access controls with that value. A denied
   sign-in on the new site will show the real Privy user ID; replace the
   placeholder in Render immediately afterward.
   Add all six ThingSpeak variables if the private research archive is used.
2. Open the Render HTTPS URL and confirm `/api/health` returns `status: ok`.
   Add that exact HTTPS origin to the Privy application's allowed domains, and
   test sign-in with an approved operator. A denied sign-in displays that
   account's Privy user ID for adding to the allowlist. Verify an unapproved
   account receives 403 and cannot open the dashboard.
3. Identify the CA root that validates the deployed Render hostname. Copy
   `code/include/server_ca.example.h` to the ignored `server_ca.h` and put the
   verified root PEM there. Set `SERVER_BASE_URL` in the ignored `secrets.h` to
   the exact Render HTTPS origin. Keep preconfigured 2.4 GHz Wi-Fi enabled for
   this prototype. Rebuild and flash the ESP32 over USB.
4. Confirm serial logs show clock synchronization and WebSocket connection;
   confirm Render `/api/health` reports `deviceStreamConnected: true` and a
   recent device report. Test a dashboard command and its ESP32 acknowledgement.
   Power-cycle the ESP32 and confirm reconnection without re-entering Wi-Fi.
5. Recreate or migrate the existing farm profile on the persistent Render disk.
   Do not treat the new 12-hour report clock as continuous until that profile
   and its on-device acknowledgement are verified. Keep the local server
   available until the cloud path passes the full check.

The cost target is about **$7/month for the always-on 512 MB service plus
$0.25/month for a 1 GB disk**, before bandwidth or other charges. Render's free
service sleeps and its filesystem is ephemeral, so it is not suitable for a
reliable greenhouse endpoint or persistent farm records.

The public deployment does not implement QR claiming or multiple farms/accounts.
The explicit operator allowlist protects this one prototype; a later multi-user
product needs device ownership, provisioning, and per-farm authorization.

References: [Render pricing](https://render.com/pricing),
[persistent disks](https://render.com/docs/disks),
[Blueprint specification](https://render.com/docs/blueprint-spec), and
[WebSocket support](https://render.com/docs/websocket).
