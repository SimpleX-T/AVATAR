import test from "node:test";
import assert from "node:assert/strict";
import {
  fieldState,
  activationState,
  temperaturePoints,
} from "../public/field-model.js";
import { farmDeviceId } from "../src/farm-device.js";
import { localDashboardState } from "../src/dashboard-state.js";
const now = Date.parse("2026-10-21T10:00:00Z");
const sample = {
  deviceId: "field-1",
  mode: "hardware",
  receivedAt: new Date(now).toISOString(),
  readings: {
    temperatureC: null,
    humidityPercent: null,
    soilRaw: 0,
    soilValid: false,
    fireSensorEnabled: false,
    fireDetected: false,
  },
  outputs: {},
};
test("missing or rail-valued sensors never become healthy zeroes", () => {
  const s = fieldState(sample, now);
  assert.equal(s.soilValid, false);
  assert.equal(s.soilRaw, null);
  assert.equal(s.fire[0], "No reading");
  assert.equal(s.water[0], "No reading");
  assert.equal(s.canCommand, true);
});
test("USB-only reports confirm the chip link without claiming peripheral readings", () => {
  const disconnected = {
    ...sample,
    hardwareProfile: "usb-only",
    readings: {
      temperatureC: 31,
      humidityPercent: 70,
      soilRaw: 2100,
      soilValid: true,
      soilSensorEnabled: true,
      fireDetected: false,
      fireSensorEnabled: true,
      fireSensorReady: true,
    },
    outputs: { controllerReady: true },
  };
  const state = fieldState(disconnected, now);
  assert.equal(state.usbOnly, true);
  assert.equal(state.readings.temperatureC, undefined);
  assert.equal(state.soilValid, false);
  assert.equal(state.fire[0], "No reading");
  assert.equal(state.water[0], "No reading");
  assert.equal(state.canCommand, true);
});
test("stale, future and absent reports cannot enable commands or assert protection", () => {
  for (const receivedAt of [
    "bad",
    new Date(now - 150001).toISOString(),
    new Date(now + 10000).toISOString(),
  ]) {
    const s = fieldState({ ...sample, receivedAt }, now);
    assert.equal(s.canCommand, false);
    assert.equal(s.fire[0], "Unknown");
  }
  assert.equal(fieldState(null, now).canCommand, false);
});
test("activation requires matching physical telemetry and durable profile acknowledgement", () => {
  const farm = {
    deviceId: "field-1",
    deviceSyncedAt: new Date(now).toISOString(),
  };
  assert.equal(activationState(farm, sample, now).ready, true);
  assert.equal(
    activationState({ ...farm, deviceId: "other" }, sample, now).ready,
    false,
  );
  assert.equal(
    activationState({ ...farm, deviceSyncedAt: null }, sample, now).ready,
    false,
  );
  assert.equal(
    activationState(farm, { ...sample, mode: "simulation" }, now).ready,
    false,
  );
});
test("fresh device observations remain visible independently of the cloud archive", () => {
  const state = localDashboardState(sample, [sample], {
    configured: true,
    pending: true,
    now,
  });
  assert.equal(state.source, "local");
  assert.equal(state.cloudAvailable, null);
  assert.equal(state.latest, sample);
  assert.equal(state.pendingUpload, true);
  assert.equal(localDashboardState(sample, [], { now: now + 150001 }), null);
});
test("chart contains unique real observations, preserving missing readings", () => {
  const a = { ...sample, readings: { temperatureC: 25 } };
  const b = {
    ...sample,
    receivedAt: new Date(now + 1000).toISOString(),
    readings: { temperatureC: 26 },
  };
  assert.deepEqual(temperaturePoints([sample, b, a, a]), [a, b]);
});

test("setup follows the authenticated reporting device, including non-default identifiers", () => {
  assert.equal(
    farmDeviceId("field-1", sample, { deviceId: "project-avatar-001" }, now),
    "field-1",
  );
  assert.throws(
    () => farmDeviceId("other", sample, null, now),
    /matching recent/,
  );
  assert.throws(
    () => farmDeviceId("field-1", { ...sample, mode: "simulation" }, null, now),
    /matching recent/,
  );
});

test("an unarmed detector cannot be labelled healthy monitoring", () => {
  const s = fieldState(
    {
      ...sample,
      readings: {
        fireSensorEnabled: true,
        fireSensorReady: false,
        fireDetected: false,
      },
    },
    now,
  );
  assert.equal(s.fire[0], "Initialising");
  assert.equal(s.fire[2], "warning");
});
