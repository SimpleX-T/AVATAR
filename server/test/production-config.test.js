import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("../src/server.js", import.meta.url));

test("production refuses to start without a strong device token", () => {
  const env = { ...process.env, NODE_ENV: "production" };
  delete env.PROJECT_AVATAR_DEVICE_TOKEN;
  delete env.NIGHT_GARDEN_DEVICE_TOKEN;
  const result = spawnSync(process.execPath, [server], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires a device token/);
});

test("production refuses to start without operator authentication", () => {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PROJECT_AVATAR_DEVICE_TOKEN: "a".repeat(32),
  };
  delete env.NIGHT_GARDEN_DEVICE_TOKEN;
  delete env.PRIVY_APP_ID;
  delete env.PRIVY_APP_SECRET;
  const result = spawnSync(process.execPath, [server], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires Privy authentication/);
});

test("production refuses to start without an approved operator", () => {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PROJECT_AVATAR_DEVICE_TOKEN: "a".repeat(32),
    PRIVY_APP_ID: "test-app",
    PRIVY_APP_SECRET: "test-secret",
  };
  delete env.PROJECT_AVATAR_OPERATOR_USER_IDS;
  const result = spawnSync(process.execPath, [server], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /approved operator user ID/);
});
