import assert from "node:assert/strict";

const baseUrl = process.env.NIGHT_GARDEN_TEST_URL || "http://127.0.0.1:8787";
const token =
  process.env.NIGHT_GARDEN_DEVICE_TOKEN ||
  "night-garden-local-development-token";

const telemetry = {
  deviceId: "night-garden-001",
  mode: "simulation",
  uptimeMs: 12000,
  wifiRssi: -48,
  readings: {
    temperatureC: 29.4,
    humidityPercent: 68.2,
    soilRaw: 1640,
    lightRaw: 2510,
    motionDetected: false,
    flameLeftRaw: 3900,
    flameCenterRaw: 3920,
    flameRightRaw: 3880,
  },
  outputs: {
    irrigation: false,
    chemigation: false,
    deterrent: false,
    fireResponse: false,
    fireLockout: false,
  },
};

const healthResponse = await fetch(`${baseUrl}/api/health`);
assert.equal(healthResponse.status, 200);

const dashboardResponse = await fetch(baseUrl);
assert.equal(dashboardResponse.status, 200);
assert.match(await dashboardResponse.text(), /Night Garden · Field Station/);

const unauthorizedResponse = await fetch(`${baseUrl}/api/device/telemetry`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(telemetry),
});
assert.equal(unauthorizedResponse.status, 401);

const telemetryResponse = await fetch(`${baseUrl}/api/device/telemetry`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(telemetry),
});
assert.equal(telemetryResponse.status, 202);

const stateResponse = await fetch(`${baseUrl}/api/state`);
const state = await stateResponse.json();
assert.equal(state.latest.deviceId, telemetry.deviceId);
assert.equal(state.latest.readings.soilRaw, telemetry.readings.soilRaw);

const commandResponse = await fetch(`${baseUrl}/api/commands`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    deviceId: telemetry.deviceId,
    action: "SIMULATE_MOTION",
  }),
});
assert.equal(commandResponse.status, 202);

const pollResponse = await fetch(
  `${baseUrl}/api/device/commands/next?deviceId=${telemetry.deviceId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const command = await pollResponse.json();
assert.equal(command.action, "SIMULATE_MOTION");

const emptyPollResponse = await fetch(
  `${baseUrl}/api/device/commands/next?deviceId=${telemetry.deviceId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
assert.equal(emptyPollResponse.status, 204);

console.log("Night Garden smoke test passed.");
