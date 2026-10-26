import { createServer } from "node:http";
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivyClient } from "@privy-io/node";
import { WebSocket, WebSocketServer } from "ws";
import { createThingSpeakBridge } from "./thingspeak.js";
import { localDashboardState } from "./dashboard-state.js";
import { farmDeviceId } from "./farm-device.js";
import { isOperator, parseOperatorIds } from "./operator-access.js";
import {
  buildFarmReport,
  reportEligibility,
  REPORT_WAIT_MS,
} from "./report.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDirectory = join(root, "public");
const dataDirectory = process.env.PROJECT_AVATAR_DATA_DIR
  ? resolve(process.env.PROJECT_AVATAR_DATA_DIR)
  : join(root, "data");
const telemetryLog = join(dataDirectory, "telemetry.jsonl");
const latestFile = join(dataDirectory, "latest.json");
const farmFile = join(dataDirectory, "farm.json");

const port = Number(process.env.PORT || 8787);
const configuredDeviceToken =
  process.env.PROJECT_AVATAR_DEVICE_TOKEN ||
  process.env.NIGHT_GARDEN_DEVICE_TOKEN ||
  "";
const production = process.env.NODE_ENV === "production";
const operatorIds = parseOperatorIds(process.env.PROJECT_AVATAR_OPERATOR_USER_IDS);
if (production && configuredDeviceToken.length < 32) {
  throw new Error("Production requires a device token of at least 32 characters.");
}
const deviceToken =
  configuredDeviceToken || "project-avatar-local-development-token";
const privyAppId = process.env.PRIVY_APP_ID || "";
const privyAppSecret = process.env.PRIVY_APP_SECRET || "";
const authEnabled = Boolean(privyAppId && privyAppSecret);
if (production && !authEnabled) {
  throw new Error("Production requires Privy authentication credentials.");
}
if (production && operatorIds.size === 0) {
  throw new Error("Production requires at least one approved operator user ID.");
}
const privy = authEnabled
  ? new PrivyClient({ appId: privyAppId, appSecret: privyAppSecret })
  : null;
const thingSpeak = createThingSpeakBridge({
  soil: {
    id: process.env.THINGSPEAK_SOIL_CHANNEL_ID,
    writeKey: process.env.THINGSPEAK_SOIL_WRITE_KEY,
    readKey: process.env.THINGSPEAK_SOIL_READ_KEY,
  },
  environment: {
    id: process.env.THINGSPEAK_ENV_CHANNEL_ID,
    writeKey: process.env.THINGSPEAK_ENV_WRITE_KEY,
    readKey: process.env.THINGSPEAK_ENV_READ_KEY,
  },
});

const state = {
  farm: null,
  latest: null,
  history: [],
  commands: new Map(),
  inFlightCommands: new Map(),
  connectedBrowsers: new Set(),
  dashboardSockets: new Set(),
  deviceSockets: new Map(),
  lastAlertSignature: null,
};
let lastPersistedAt = 0;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
};

function json(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Request body is too large");
    }
  }
  return JSON.parse(body || "{}");
}

function isDeviceAuthorized(request) {
  return request.headers.authorization === `Bearer ${deviceToken}`;
}

function getCookie(request, name) {
  const pairs = (request.headers.cookie || "").split(";");
  for (const pair of pairs) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

async function getAuthenticatedUser(request) {
  if (!authEnabled) return { user_id: "local-development-user" };
  const token = getCookie(request, "project-avatar-session");
  if (!token) return null;

  try {
    return await privy.utils().auth().verifyAccessToken(token);
  } catch {
    return null;
  }
}

async function getOperator(request) {
  const user = await getAuthenticatedUser(request);
  return isOperator(user, operatorIds, production) ? user : null;
}

async function requireUser(request, response) {
  const user = await getOperator(request);
  if (!user) {
    json(response, 401, { error: "Sign in is required" });
    return null;
  }
  return user;
}

function publish(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of state.connectedBrowsers) {
    response.write(message);
  }
  const socketMessage = JSON.stringify({ event, payload });
  for (const socket of state.dashboardSockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(socketMessage);
  }
}

function hasRecentDeviceReport() {
  return (
    Boolean(state.latest) &&
    Date.now() - Date.parse(state.latest.receivedAt) <= 150_000
  );
}

function normalizeTelemetry(payload) {
  if (!payload.deviceId || !payload.readings || !payload.outputs) {
    throw new Error("deviceId, readings, and outputs are required");
  }

  return {
    ...payload,
    receivedAt: new Date().toISOString(),
  };
}

async function persistTelemetry(telemetry) {
  await mkdir(dataDirectory, { recursive: true });
  await Promise.all([
    appendFile(telemetryLog, `${JSON.stringify(telemetry)}\n`),
    writeFile(latestFile, JSON.stringify(telemetry, null, 2)),
  ]);
}

async function recordTelemetry(payload) {
  const telemetry = normalizeTelemetry(payload);
  state.latest = telemetry;
  state.history.push(telemetry);
  state.history = state.history.slice(-120);
  if (Date.now() - lastPersistedAt >= 1_000) {
    lastPersistedAt = Date.now();
    await persistTelemetry(telemetry);
  }
  publish("telemetry", telemetry);
  const alert =
    telemetry.readings?.fireDetected === true
      ? "FIRE_DETECTED"
      : telemetry.outputs?.fireLockout === true
        ? "FIRE_RESPONSE_FAULT"
        : telemetry.outputs?.waterFault === true ||
            telemetry.outputs?.irrigationLockout === true
          ? "IRRIGATION_FAULT"
          : null;
  const signature = alert ? `${telemetry.deviceId}:${alert}` : null;
  if (signature && signature !== state.lastAlertSignature)
    publish("alert", {
      deviceId: telemetry.deviceId,
      alert,
      at: telemetry.receivedAt,
    });
  if (!signature && state.lastAlertSignature)
    publish("alert-clear", {
      deviceId: telemetry.deviceId,
      at: telemetry.receivedAt,
    });
  state.lastAlertSignature = signature;
  // Demonstration readings must never be stored as real field history.
  if (telemetry.mode === "hardware") thingSpeak.enqueue(telemetry);
  return telemetry;
}

// Cloud failure is isolated from telemetry ingestion and from ESP32 control.
// Keep the latest sample for retry; do not build an unbounded memory queue.
setInterval(() => {
  thingSpeak.publishPending().catch((error) => {
    console.warn("[THINGSPEAK] Publish deferred:", error.message);
  });
}, 5_000).unref();

async function acceptTelemetry(request, response) {
  if (!isDeviceAuthorized(request)) {
    return json(response, 401, { error: "Invalid device token" });
  }

  try {
    await recordTelemetry(await readJsonBody(request));
    return json(response, 202, { accepted: true });
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
}

function takeDeviceCommand(deviceId) {
  if (!deviceId) return null;
  const now = Date.now();
  const inFlight = [...state.inFlightCommands.values()].find(
    (item) => item.deviceId === deviceId,
  );
  if (inFlight) {
    if (now - Date.parse(inFlight.lastSentAt || inFlight.createdAt) < 10_000)
      return null;
    if (inFlight.action !== "SET_PROFILE" && now - Date.parse(inFlight.createdAt) > 60_000) {
      state.inFlightCommands.delete(inFlight.commandId);
      publish("command-status", { ...inFlight, applied: false, error: "Device did not acknowledge in time" });
    } else {
      inFlight.lastSentAt = new Date(now).toISOString();
      return inFlight;
    }
  }

  const queue = state.commands.get(deviceId) || [];
  let command = queue.shift();
  state.commands.set(deviceId, queue);

  if (
    !command &&
    state.farm?.deviceId === deviceId &&
    !state.farm.deviceSyncedAt
  ) {
    command = {
      commandId: crypto.randomUUID(),
      deviceId,
      action: "SET_PROFILE",
      profileRevision: state.farm.revision,
      profile: {
        name: state.farm.name,
        farmerName: state.farm.farmerName,
        crop: state.farm.crop,
        setupAt: state.farm.setupAt,
        revision: state.farm.revision,
      },
      createdAt: new Date().toISOString(),
    };
  }

  if (command) {
    command.lastSentAt = new Date(now).toISOString();
    state.inFlightCommands.set(command.commandId, command);
  }
  return command || null;
}

function sendPendingToDevice(deviceId) {
  const socket = state.deviceSockets.get(deviceId);
  if (socket?.readyState !== WebSocket.OPEN) return;
  const command = takeDeviceCommand(deviceId);
  if (command) socket.send(JSON.stringify({ type: "command", payload: command }));
}

function nextDeviceCommand(request, response, url) {
  if (!isDeviceAuthorized(request)) {
    return json(response, 401, { error: "Invalid device token" });
  }

  const command = takeDeviceCommand(url.searchParams.get("deviceId"));

  if (!command) {
    response.writeHead(204);
    return response.end();
  }

  return json(response, 200, command);
}

async function recordCommandAcknowledgement(payload) {
    const command = state.inFlightCommands.get(payload.commandId);
    if (!command || command.deviceId !== payload.deviceId) {
      throw new Error("Command was not awaiting acknowledgement");
    }

    const acknowledgement = {
      ...command,
      applied: payload.applied === true,
      acknowledgedAt: new Date().toISOString(),
    };
    state.inFlightCommands.delete(command.commandId);
    if (
      command.action === "SET_PROFILE" &&
      acknowledgement.applied &&
      state.farm?.revision === command.profileRevision
    ) {
      const confirmedFarm = {
        ...state.farm,
        deviceSyncedAt: acknowledgement.acknowledgedAt,
        commissionedAt:
          state.farm.commissionedAt || acknowledgement.acknowledgedAt,
      };
      await persistFarm(confirmedFarm);
      state.farm = confirmedFarm;
      publish("farm-updated", { report: reportEligibility(state.farm) });
    }
    publish("command-status", acknowledgement);
    sendPendingToDevice(command.deviceId);
    return acknowledgement;
}

async function acknowledgeDeviceCommand(request, response) {
  if (!isDeviceAuthorized(request)) {
    return json(response, 401, { error: "Invalid device token" });
  }

  try {
    return json(response, 202, await recordCommandAcknowledgement(await readJsonBody(request)));
  } catch (error) {
    return json(response, error.message === "Command was not awaiting acknowledgement" ? 404 : 400, { error: error.message });
  }
}

async function enqueueCommand(request, response) {
  try {
    const payload = await readJsonBody(request);
    const allowedActions = new Set([
      "SIMULATE_DRY_SOIL",
      "CLEAR_SIMULATION",
      "LED_ON",
      "LED_OFF",
      "LED_IDENTIFY",
      "PING",
      "TEST_FIRE_PUMP",
      "TEST_HYDRATION_PUMP",
      "STOP_PUMP_TEST",
    ]);

    if (!payload.deviceId || !allowedActions.has(payload.action)) {
      return json(response, 400, { error: "Invalid deviceId or action" });
    }

    const command = {
      commandId: crypto.randomUUID(),
      deviceId: payload.deviceId,
      action: payload.action,
      createdAt: new Date().toISOString(),
    };

    const queue = state.commands.get(payload.deviceId) || [];
    queue.push(command);
    state.commands.set(payload.deviceId, queue.slice(-20));
    sendPendingToDevice(payload.deviceId);
    publish("command", command);
    return json(response, 202, command);
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
}

function authConfig(response) {
  return json(response, 200, {
    authEnabled,
    privyAppId: authEnabled ? privyAppId : null,
  });
}

async function establishUserSession(request, response) {
  if (!authEnabled) {
    return json(response, 409, {
      error: "Privy authentication is not configured",
    });
  }

  const authorization = request.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  try {
    const user = await privy.utils().auth().verifyAccessToken(token);
    if (!isOperator(user, operatorIds, production)) {
      return json(response, 403, {
        error: `This account is not approved to operate Project AVATAR. Privy user ID: ${user.user_id}`,
      });
    }
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.writeHead(204, {
      "Set-Cookie": `project-avatar-session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`,
      "Cache-Control": "no-store",
    });
    response.end();
  } catch (error) {
    console.warn(
      "[AUTH] Privy session verification failed:",
      error instanceof Error ? error.message : "Unknown verification error",
    );
    json(response, 401, { error: "Privy access token is invalid or expired" });
  }
}

function clearUserSession(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.writeHead(204, {
    "Set-Cookie": `project-avatar-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    "Cache-Control": "no-store",
  });
  response.end();
}

function openEventStream(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  response.write("retry: 2000\n\n");
  state.connectedBrowsers.add(response);

  const keepAlive = setInterval(() => response.write(": heartbeat\n\n"), 15000);
  request.on("close", () => {
    clearInterval(keepAlive);
    state.connectedBrowsers.delete(response);
  });
}

async function serveStatic(response, pathname) {
  const requested =
    pathname === "/"
      ? "/dashboard/index.html"
      : pathname === "/dashboard/"
        ? "/dashboard/index.html"
        : pathname === "/legacy"
          ? "/index.html"
          : pathname === "/auth/"
            ? "/auth/index.html"
            : pathname === "/slide/"
              ? "/slide/index.html"
              : pathname === "/report/"
                ? "/report/index.html"
                : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDirectory, safePath);

  if (!filePath.startsWith(publicDirectory)) {
    return json(response, 403, { error: "Forbidden" });
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type":
        mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

async function loadLatestState() {
  try {
    state.latest = JSON.parse(await readFile(latestFile, "utf8"));
    state.history.push(state.latest);
  } catch {
    // A fresh installation has no telemetry yet.
  }
}

await loadLatestState();
try {
  state.farm = JSON.parse(await readFile(farmFile, "utf8"));
} catch {
  // Setup has not been completed on this server.
}

function farmName(value, label, required = true) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const trimmed = value.trim();
  if (
    (required && trimmed.length < 2) ||
    trimmed.length > 80 ||
    /[\x00-\x1f\x7f]/.test(trimmed)
  )
    throw new Error(`${label} must be 2–80 readable characters`);
  return trimmed;
}

async function saveFarm(payload) {
  const name = farmName(payload.name, "Farm name");
  const farmerName = farmName(payload.farmerName, "Farmer name");
  const crop = farmName(payload.crop, "Crop", false);
  const deviceId = farmDeviceId(payload.deviceId, state.latest, state.farm);
  const unchanged =
    state.farm?.deviceId === deviceId &&
    Boolean(state.farm?.revision) &&
    state.farm?.name === name &&
    state.farm?.farmerName === farmerName &&
    state.farm?.crop === crop;
  const farm = {
    name,
    farmerName,
    crop,
    setupAt: state.farm?.setupAt || new Date().toISOString(),
    deviceId,
    revision: unchanged ? state.farm.revision : crypto.randomUUID(),
    deviceSyncedAt: unchanged ? state.farm.deviceSyncedAt || null : null,
    commissionedAt:
      state.farm?.deviceId === deviceId
        ? state.farm?.commissionedAt || null
        : null,
  };
  await persistFarm(farm);
  state.farm = farm;
  if (!unchanged) {
    for (const [id, command] of state.inFlightCommands)
      if (command.action === "SET_PROFILE") state.inFlightCommands.delete(id);
  }
  sendPendingToDevice(deviceId);
  return farm;
}

async function persistFarm(farm) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${farmFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(farm, null, 2), {
    mode: 0o600,
  });
  await rename(temporaryFile, farmFile);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.hostname === "0.0.0.0") {
    const localUrl = new URL(url);
    localUrl.hostname = "localhost";
    response.writeHead(307, { Location: localUrl.toString() });
    return response.end();
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json(response, 200, {
      status: "ok",
      latestTelemetryAt: state.latest?.receivedAt || null,
      deviceReportedRecently: hasRecentDeviceReport(),
      deviceStreamConnected: [...state.deviceSockets.values()].some(
        (socket) => socket.readyState === WebSocket.OPEN,
      ),
      thingSpeakConfigured: thingSpeak.configured,
      thingSpeakUploadPending: thingSpeak.pending,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/config") {
    return authConfig(response);
  }

  if (request.method === "POST" && url.pathname === "/api/auth/session") {
    return establishUserSession(request, response);
  }

  if (request.method === "DELETE" && url.pathname === "/api/auth/session") {
    return clearUserSession(response);
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    if (!(await requireUser(request, response))) return;
    const local = localDashboardState(state.latest, state.history, {
      configured: thingSpeak.configured,
      pending: thingSpeak.pending,
    });
    if (local) return json(response, 200, local);
    if (thingSpeak.configured) {
      try {
        const cloudLatest = await thingSpeak.readLatest(state.latest);
        return json(response, 200, {
          latest: cloudLatest,
          source: "thingspeak",
          history: state.history,
          cloudConfigured: true,
          cloudAvailable: true,
          pendingUpload: thingSpeak.pending,
          deviceReportedRecently: hasRecentDeviceReport(),
        });
      } catch (error) {
        return json(response, 200, {
          latest: state.latest,
          history: state.history,
          source: "local",
          cloudConfigured: true,
          cloudAvailable: false,
          cloudError:
            "Cloud history is unavailable. Local observations are retained.",
          pendingUpload: thingSpeak.pending,
          deviceReportedRecently: hasRecentDeviceReport(),
        });
      }
    }
    return json(response, 200, {
      latest: state.latest,
      history: state.history,
      source: "local",
      cloudAvailable: false,
      deviceReportedRecently: hasRecentDeviceReport(),
    });
  }

  if (url.pathname === "/api/farm") {
    if (!(await requireUser(request, response))) return;
    if (request.method === "GET")
      return json(response, 200, {
        farm: state.farm,
        report: reportEligibility(state.farm),
      });
    if (request.method === "POST") {
      try {
        const farm = await saveFarm(await readJsonBody(request));
        return json(response, 200, { farm, report: reportEligibility(farm) });
      } catch (error) {
        return json(response, 400, { error: error.message });
      }
    }
  }

  if (request.method === "GET" && url.pathname === "/api/report") {
    if (!(await requireUser(request, response))) return;
    if (!state.farm)
      return json(response, 409, { error: "Set up your farm first." });
    const eligibility = reportEligibility(state.farm);
    if (!eligibility.eligible)
      return json(response, 425, {
        error: "Report available 12 hours after farm setup.",
        ...eligibility,
      });
    if (!thingSpeak.configured)
      return json(response, 503, {
        error: "Private ThingSpeak history is not configured.",
      });
    try {
      const to = Date.now();
      const { soil, environment } = await thingSpeak.readRange(
        to - REPORT_WAIT_MS,
        to,
      );
      return json(
        response,
        200,
        buildFarmReport(state.farm, soil, environment, to),
      );
    } catch (error) {
      console.warn("[REPORT] History unavailable:", error.message);
      return json(response, 503, {
        error:
          "Recorded history is unavailable. Try again when ThingSpeak is reachable.",
      });
    }
  }

  if (request.method === "GET" && url.pathname === "/api/events") {
    if (!(await requireUser(request, response))) return;
    return openEventStream(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/device/telemetry") {
    return acceptTelemetry(request, response);
  }

  if (
    request.method === "GET" &&
    url.pathname === "/api/device/commands/next"
  ) {
    return nextDeviceCommand(request, response, url);
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/device/commands/ack"
  ) {
    return acknowledgeDeviceCommand(request, response);
  }

  if (request.method === "POST" && url.pathname === "/api/commands") {
    if (!(await requireUser(request, response))) return;
    return enqueueCommand(request, response);
  }

  if (url.pathname === "/auth") {
    response.writeHead(308, { Location: "/auth/" });
    return response.end();
  }

  if (url.pathname === "/slide") {
    response.writeHead(308, { Location: "/slide/" });
    return response.end();
  }

  if (url.pathname === "/report") {
    response.writeHead(308, { Location: "/report/" });
    return response.end();
  }

  if (
    authEnabled &&
    url.pathname === "/" &&
    !(await getOperator(request))
  ) {
    response.writeHead(302, { Location: "/auth/" });
    return response.end();
  }

  return serveStatic(response, url.pathname);
});

const deviceSocketServer = new WebSocketServer({ noServer: true });
const dashboardSocketServer = new WebSocketServer({ noServer: true });

deviceSocketServer.on("connection", (socket) => {
  let deviceId = null;
  socket.isAlive = true;
  socket.on("pong", () => { socket.isAlive = true; });
  socket.on("error", (error) => {
    console.warn(
      "[WS] Device socket closed with protocol error:",
      error.message,
    );
  });
  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === "telemetry") {
        const telemetry = await recordTelemetry(message.payload);
        deviceId = telemetry.deviceId;
        state.deviceSockets.set(deviceId, socket);
        socket.send(JSON.stringify({ type: "telemetry-accepted", receivedAt: telemetry.receivedAt }));
        sendPendingToDevice(deviceId);
      } else if (message.type === "command-ack") {
        if (!deviceId || message.payload?.deviceId !== deviceId)
          throw new Error("Device identity does not match this connection");
        await recordCommandAcknowledgement(message.payload);
      }
    } catch (error) {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "error", error: error.message }));
    }
  });
  socket.on("close", () => {
    if (deviceId && state.deviceSockets.get(deviceId) === socket)
      state.deviceSockets.delete(deviceId);
  });
});

setInterval(() => {
  for (const socket of deviceSocketServer.clients) {
    if (!socket.isAlive) socket.terminate();
    else { socket.isAlive = false; socket.ping(); }
  }
}, 30_000).unref();

dashboardSocketServer.on("connection", (socket) => {
  state.dashboardSockets.add(socket);
  socket.on("error", (error) => {
    console.warn(
      "[WS] Dashboard socket closed with protocol error:",
      error.message,
    );
  });
  socket.on("close", () => state.dashboardSockets.delete(socket));
});

server.on("upgrade", async (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/ws/device") {
    if (!isDeviceAuthorized(request)) return socket.destroy();
    return deviceSocketServer.handleUpgrade(
      request,
      socket,
      head,
      (webSocket) => {
        deviceSocketServer.emit("connection", webSocket, request);
      },
    );
  }
  if (url.pathname === "/ws/dashboard") {
    if (!(await getOperator(request))) return socket.destroy();
    return dashboardSocketServer.handleUpgrade(
      request,
      socket,
      head,
      (webSocket) => {
        dashboardSocketServer.emit("connection", webSocket, request);
      },
    );
  }
  socket.destroy();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Project AVATAR is listening on http://0.0.0.0:${port}`);
  console.log(
    authEnabled
      ? "Privy authentication is enabled for dashboard access."
      : "Privy authentication is not configured; local demonstration mode is active.",
  );
});
