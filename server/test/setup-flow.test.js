import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
const root = fileURLToPath(new URL("..", import.meta.url));
const base = "http://127.0.0.1:18879";
const token = "avatar-isolated-integration-token";
test("hardware identity, profile revision, device acknowledgement and LED queue form a complete setup flow", async () => {
  const data = await mkdtemp(join(tmpdir(), "avatar-setup-flow-"));
  const env = {
    ...process.env,
    PORT: "18879",
    PROJECT_AVATAR_DATA_DIR: data,
    PROJECT_AVATAR_DEVICE_TOKEN: token,
  };
  for (const key of Object.keys(env))
    if (key.startsWith("PRIVY_") || key.startsWith("THINGSPEAK_"))
      delete env[key];
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let errors = "";
  child.stderr.on("data", (b) => (errors += b));
  async function request(path, body, device = false) {
    return fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(device ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  try {
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(base + "/api/health");
        if (r.ok) break;
      } catch {}
      if (child.exitCode !== null) throw new Error(errors);
      await new Promise((r) => setTimeout(r, 50));
    }
    const profile = {
      name: "Integration greenhouse",
      farmerName: "Test operator",
      crop: "Tomato",
      deviceId: "actual-field-unit",
    };
    assert.equal(
      (await request("/api/farm", profile)).status,
      400,
      "no setup without a matching hardware report",
    );
    const telemetry = {
      deviceId: "actual-field-unit",
      mode: "hardware",
      uptimeMs: 10000,
      wifiRssi: -50,
      readings: {
        temperatureC: 27,
        humidityPercent: 65,
        soilRaw: 2100,
        soilValid: true,
        fireSensorEnabled: true,
        fireSensorReady: true,
        fireDetected: false,
      },
      outputs: { controllerReady: true },
    };
    assert.equal(
      (await request("/api/device/telemetry", telemetry, true)).status,
      202,
    );
    const snapshot = await (await request("/api/state")).json();
    assert.equal(snapshot.source, "local");
    assert.equal(snapshot.latest.deviceId, "actual-field-unit");
    assert.equal(
      (await request("/api/farm", { ...profile, deviceId: "unseen-device" }))
        .status,
      400,
    );
    let saved = await (await request("/api/farm", profile)).json();
    assert.equal(saved.farm.deviceId, "actual-field-unit");
    assert.equal(saved.farm.deviceSyncedAt, null);
    const revision = saved.farm.revision;
    const duplicate = await (await request("/api/farm", profile)).json();
    assert.equal(
      duplicate.farm.revision,
      revision,
      "repeated save is idempotent",
    );
    let command = await (
      await request(
        "/api/device/commands/next?deviceId=actual-field-unit",
        null,
        true,
      )
    ).json();
    assert.equal(command.action, "SET_PROFILE");
    assert.equal(command.profile.revision, revision);
    assert.equal(
      (
        await request(
          "/api/device/commands/ack",
          {
            commandId: command.commandId,
            deviceId: "actual-field-unit",
            applied: true,
          },
          true,
        )
      ).status,
      202,
    );
    saved = await (await request("/api/farm")).json();
    assert.ok(saved.farm.deviceSyncedAt);
    assert.ok(saved.farm.commissionedAt);
    assert.equal(saved.report.eligible, false);
    const same = await (await request("/api/farm", profile)).json();
    assert.equal(same.farm.deviceSyncedAt, saved.farm.deviceSyncedAt);
    assert.equal(
      (
        await request(
          "/api/device/commands/next?deviceId=actual-field-unit",
          null,
          true,
        )
      ).status,
      204,
    );
    const queued = await (
      await request("/api/commands", {
        deviceId: "actual-field-unit",
        action: "LED_ON",
      })
    ).json();
    command = await (
      await request(
        "/api/device/commands/next?deviceId=actual-field-unit",
        null,
        true,
      )
    ).json();
    assert.equal(command.commandId, queued.commandId);
    assert.equal(command.action, "LED_ON");
    assert.equal(
      (
        await request(
          "/api/device/commands/ack",
          {
            commandId: command.commandId,
            deviceId: "actual-field-unit",
            applied: true,
          },
          true,
        )
      ).status,
      202,
    );
    const edited = await (
      await request("/api/farm", { ...profile, crop: "Pepper" })
    ).json();
    assert.notEqual(edited.farm.revision, revision);
    assert.equal(edited.farm.deviceSyncedAt, null);
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
    await rm(data, { recursive: true, force: true });
  }
});
