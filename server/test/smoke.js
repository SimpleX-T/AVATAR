import assert from "node:assert/strict";

const baseUrl =
  process.env.PROJECT_AVATAR_TEST_URL ||
  process.env.NIGHT_GARDEN_TEST_URL ||
  "http://127.0.0.1:8787";
const token =
  process.env.PROJECT_AVATAR_DEVICE_TOKEN ||
  process.env.NIGHT_GARDEN_DEVICE_TOKEN ||
  "project-avatar-local-development-token";

const telemetry = {
  deviceId: "project-avatar-001",
  mode: "simulation",
  uptimeMs: 12000,
  wifiRssi: -48,
  readings: {
    temperatureC: 29.4,
    humidityPercent: 68.2,
    soilRaw: 1640,
    soilSensorEnabled: true,
    lightRaw: 2510,
    fireDetected: false,
    fireSensorEnabled: true,
  },
  outputs: {
    irrigation: false,
    irrigationLockout: false,
    fireResponse: false,
    fireLockout: false,
  },
};

const healthResponse = await fetch(`${baseUrl}/api/health`);
assert.equal(healthResponse.status, 200);

const authPageResponse = await fetch(`${baseUrl}/auth/`);
assert.equal(authPageResponse.status, 200);
assert.match(await authPageResponse.text(), /Sign in · Project AVATAR/);

const authConfigResponse = await fetch(`${baseUrl}/api/auth/config`);
assert.equal(authConfigResponse.status, 200);
const authConfig = await authConfigResponse.json();
assert.equal(typeof authConfig.authEnabled, "boolean");
assert.equal(
  authConfig.authEnabled,
  Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET),
);

const dashboardResponse = await fetch(baseUrl, { redirect: "manual" });
if (authConfig.authEnabled) {
  assert.equal(dashboardResponse.status, 302);
  assert.equal(dashboardResponse.headers.get("location"), "/auth/");
} else {
  assert.equal(dashboardResponse.status, 200);
  assert.match(
    await dashboardResponse.text(),
    /Project AVATAR · Greenhouse Research Dashboard/,
  );
}

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
if (authConfig.authEnabled) {
  assert.equal(stateResponse.status, 401);
  const protectedCommandResponse = await fetch(`${baseUrl}/api/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: telemetry.deviceId,
      action: "SIMULATE_DRY_SOIL",
    }),
  });
  assert.equal(protectedCommandResponse.status, 401);
  console.log("Project AVATAR authenticated-boundary smoke test passed.");
  process.exit(0);
}

const state = await stateResponse.json();
assert.equal(state.latest.deviceId, telemetry.deviceId);
assert.equal(state.latest.readings.soilRaw, telemetry.readings.soilRaw);
assert.equal(state.latest.readings.fireDetected, false);

const commandResponse = await fetch(`${baseUrl}/api/commands`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    deviceId: telemetry.deviceId,
    action: "SIMULATE_DRY_SOIL",
  }),
});
assert.equal(commandResponse.status, 202);

const pollResponse = await fetch(
  `${baseUrl}/api/device/commands/next?deviceId=${telemetry.deviceId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const command = await pollResponse.json();
assert.equal(command.action, "SIMULATE_DRY_SOIL");

const acknowledgementResponse = await fetch(
  `${baseUrl}/api/device/commands/ack`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      commandId: command.commandId,
      deviceId: telemetry.deviceId,
      action: command.action,
      applied: true,
    }),
  },
);
assert.equal(acknowledgementResponse.status, 202);
const acknowledgement = await acknowledgementResponse.json();
assert.equal(acknowledgement.applied, true);

const emptyPollResponse = await fetch(
  `${baseUrl}/api/device/commands/next?deviceId=${telemetry.deviceId}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
assert.equal(emptyPollResponse.status, 204);

console.log("Project AVATAR smoke test passed.");
