import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const root = fileURLToPath(new URL("..", import.meta.url));
const base = "http://127.0.0.1:18883";
const token = "avatar-websocket-integration-token";

function nextMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("WebSocket message timed out")), 3000);
    function finish(error, value) {
      clearTimeout(timer);
      socket.off("message", onMessage);
      error ? reject(error) : resolve(value);
    }
    function onMessage(raw) {
      const message = JSON.parse(raw.toString());
      if (predicate(message)) finish(null, message);
    }
    socket.on("message", onMessage);
  });
}

test("device WebSocket delivers live observations, commands and profile acknowledgement", async () => {
  const data = await mkdtemp(join(tmpdir(), "avatar-device-ws-"));
  const env = {
    ...process.env,
    PORT: "18883",
    PROJECT_AVATAR_DATA_DIR: data,
    PROJECT_AVATAR_DEVICE_TOKEN: token,
  };
  for (const key of Object.keys(env))
    if (key.startsWith("PRIVY_") || key.startsWith("THINGSPEAK_")) delete env[key];
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let errors = "";
  child.stderr.on("data", (bytes) => { errors += bytes; });
  let device;
  let dashboard;
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { ready = (await fetch(base + "/api/health")).ok; } catch {}
      if (ready) break;
      if (child.exitCode !== null) throw new Error(errors);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, errors || "server did not start");
    device = new WebSocket("ws://127.0.0.1:18883/ws/device", "arduino", {
      headers: { Authorization: `Bearer ${token}` },
    });
    dashboard = new WebSocket("ws://127.0.0.1:18883/ws/dashboard");
    await Promise.all([
      new Promise((resolve, reject) => { device.once("open", resolve); device.once("error", reject); }),
      new Promise((resolve, reject) => { dashboard.once("open", resolve); dashboard.once("error", reject); }),
    ]);

    const observation = {
      deviceId: "field-unit-1",
      mode: "hardware",
      uptimeMs: 5000,
      readings: { temperatureC: 28, humidityPercent: 63, soilRaw: 2100, soilValid: true },
      outputs: { controllerReady: true },
    };
    const live = nextMessage(dashboard, (message) => message.event === "telemetry");
    const accepted = nextMessage(device, (message) => message.type === "telemetry-accepted");
    device.send(JSON.stringify({ type: "telemetry", payload: observation }));
    assert.equal((await live).payload.deviceId, observation.deviceId);
    assert.ok((await accepted).receivedAt);

    const identify = nextMessage(device, (message) => message.type === "command");
    const queued = await fetch(base + "/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: observation.deviceId, action: "LED_IDENTIFY" }),
    });
    assert.equal(queued.status, 202);
    const command = (await identify).payload;
    assert.equal(command.action, "LED_IDENTIFY");
    const commandStatus = nextMessage(dashboard, (message) => message.event === "command-status");
    device.send(JSON.stringify({
      type: "command-ack",
      payload: { deviceId: observation.deviceId, commandId: command.commandId, applied: true },
    }));
    assert.equal((await commandStatus).payload.commandId, command.commandId);

    const profileCommand = nextMessage(device, (message) => message.type === "command" && message.payload.action === "SET_PROFILE");
    const profileResponse = await fetch(base + "/api/farm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: observation.deviceId, name: "Test greenhouse", farmerName: "Test farmer", crop: "Tomato" }),
    });
    assert.equal(profileResponse.status, 200);
    const profile = (await profileCommand).payload;
    device.send(JSON.stringify({
      type: "command-ack",
      payload: { deviceId: observation.deviceId, commandId: profile.commandId, applied: true },
    }));
    for (let i = 0; i < 20; i++) {
      const farm = await (await fetch(base + "/api/farm")).json();
      if (farm.farm?.deviceSyncedAt) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail("profile was not acknowledged");
  } finally {
    device?.close();
    dashboard?.close();
    child.kill();
    await rm(data, { recursive: true, force: true });
  }
});
