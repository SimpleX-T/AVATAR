import { createServer } from "node:http";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDirectory = join(root, "public");
const dataDirectory = join(root, "data");
const telemetryLog = join(dataDirectory, "telemetry.jsonl");
const latestFile = join(dataDirectory, "latest.json");

const port = Number(process.env.PORT || 8787);
const deviceToken =
  process.env.NIGHT_GARDEN_DEVICE_TOKEN ||
  "night-garden-local-development-token";

const state = {
  latest: null,
  history: [],
  commands: new Map(),
  connectedBrowsers: new Set(),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
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

function publish(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const response of state.connectedBrowsers) {
    response.write(message);
  }
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

async function acceptTelemetry(request, response) {
  if (!isDeviceAuthorized(request)) {
    return json(response, 401, { error: "Invalid device token" });
  }

  try {
    const telemetry = normalizeTelemetry(await readJsonBody(request));
    state.latest = telemetry;
    state.history.push(telemetry);
    state.history = state.history.slice(-120);
    await persistTelemetry(telemetry);
    publish("telemetry", telemetry);
    return json(response, 202, { accepted: true });
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
}

function nextDeviceCommand(request, response, url) {
  if (!isDeviceAuthorized(request)) {
    return json(response, 401, { error: "Invalid device token" });
  }

  const deviceId = url.searchParams.get("deviceId");
  const queue = state.commands.get(deviceId) || [];
  const command = queue.shift();
  state.commands.set(deviceId, queue);

  if (!command) {
    response.writeHead(204);
    return response.end();
  }

  return json(response, 200, command);
}

async function enqueueCommand(request, response) {
  try {
    const payload = await readJsonBody(request);
    const allowedActions = new Set([
      "SIMULATE_MOTION",
      "SIMULATE_DRY_SOIL",
      "CLEAR_SIMULATION",
      "LED_ON",
      "LED_OFF",
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
    publish("command", command);
    return json(response, 202, command);
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
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
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDirectory, safePath);

  if (!filePath.startsWith(publicDirectory)) {
    return json(response, 403, { error: "Forbidden" });
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json(response, 200, {
      status: "ok",
      latestTelemetryAt: state.latest?.receivedAt || null,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    return json(response, 200, {
      latest: state.latest,
      history: state.history,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/events") {
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

  if (request.method === "POST" && url.pathname === "/api/commands") {
    return enqueueCommand(request, response);
  }

  return serveStatic(response, url.pathname);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Night Garden is listening on http://0.0.0.0:${port}`);
  console.log("Keep this development server on your trusted local network.");
});
