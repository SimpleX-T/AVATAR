const deviceId = "project-avatar-001";
const dryThreshold = 2928; // Commissioned capacitive sensor; prefer device's soilDry flag.
const eventLog = document.querySelector("#event-log");
const toast = document.querySelector("#toast");
const copyLogsButton = document.querySelector("#copy-logs");
const downloadLogsButton = document.querySelector("#download-logs");
const signOutButton = document.querySelector("#operator-signout");
const farmForm = document.querySelector("#farm-profile-form");
const farmStatus = document.querySelector("#farm-profile-status");
const reportButton = document.querySelector("#open-report");
let farmSetup = null;
let lastTelemetryAt = 0;
let currentMode = null;
let cloudMode = false;
const telemetryFreshnessMs = 150_000;

async function redirectIfUnauthorized(response) {
  if (response.status !== 401) return false;
  window.location.assign("/auth/");
  return true;
}

async function signOut() {
  signOutButton.disabled = true;
  await fetch("/api/auth/session", { method: "DELETE" });
  window.location.assign("/auth/?logout=1");
}

function renderFarmProfile(payload) {
  farmSetup = payload;
  const farm = payload.farm;
  if (farm) {
    farmForm.elements.name.value = farm.name;
    farmForm.elements.farmerName.value = farm.farmerName;
    farmForm.elements.crop.value = farm.crop || "";
  }
  const eligibleAt = Date.parse(payload.report?.eligibleAt || "");
  const ready = Number.isFinite(eligibleAt) && Date.now() >= eligibleAt;
  reportButton.disabled = !ready;
  farmStatus.textContent = !farm
    ? "No greenhouse details saved yet. Reports unlock 12 hours after the ESP32 confirms setup."
    : !farm.deviceSyncedAt
      ? "Saved on this server. Waiting for the ESP32 to confirm on-chip storage; keep it powered and connected."
    : ready
      ? `Ready: ${farm.name}'s recorded 12-hour report can be printed.`
      : `ESP32 confirmed setup. Report unlocks ${new Date(eligibleAt).toLocaleString()}.`;
}

async function loadFarmProfile() {
  const response = await fetch("/api/farm");
  if (await redirectIfUnauthorized(response)) return;
  if (!response.ok) throw new Error("Could not load greenhouse setup.");
  renderFarmProfile(await response.json());
}

const elements = {
  connection: document.querySelector("#connection"),
  connectionLabel: document.querySelector("#connection-label"),
  temperature: document.querySelector("#temperature-value"),
  temperatureState: document.querySelector("#temperature-state"),
  humidity: document.querySelector("#humidity-value"),
  humidityState: document.querySelector("#humidity-state"),
  introCopy: document.querySelector("#intro-copy"),
  controlsExplanation: document.querySelector("#controls-explanation"),
  soil: document.querySelector("#soil-value"),
  soilState: document.querySelector("#soil-state"),
  soilExplanation: document.querySelector("#soil-explanation"),
  deviceState: document.querySelector("#device-state"),
  deviceWord: document.querySelector("#device-word"),
  lastSeen: document.querySelector("#last-seen"),
  soilSummary: document.querySelector("#soil-summary"),
  fireSummary: document.querySelector("#fire-summary"),
  signalSummary: document.querySelector("#signal-summary"),
  overallStatus: document.querySelector("#overall-status"),
  deviceId: document.querySelector("#device-id-value"),
  mode: document.querySelector("#mode-value"),
  rssi: document.querySelector("#rssi-value"),
  fire: document.querySelector("#fire-value"),
  dataSource: document.querySelector("#data-source-value"),
  probe: document.querySelector("#probe-value"),
  gas: document.querySelector("#gas-value"),
  water: document.querySelector("#water-value"),
};

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "—";
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function flashReading(element) {
  element.classList.remove("reading-flash");
  requestAnimationFrame(() => element.classList.add("reading-flash"));
}

function addLog(message, timestamp = new Date()) {
  eventLog.querySelector(".log-empty")?.remove();

  const item = document.createElement("li");
  const time = document.createElement("time");
  const description = document.createElement("span");
  time.dateTime = new Date(timestamp).toISOString();
  time.textContent = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  description.textContent = message;
  item.dataset.timestamp = new Date(timestamp).toISOString();
  item.dataset.message = message;
  item.append(time, description);
  eventLog.prepend(item);

  while (eventLog.children.length > 7) {
    eventLog.lastElementChild.remove();
  }
}

function getLogRows() {
  return [...eventLog.querySelectorAll("li[data-timestamp]")].map((item) => ({
    timestamp: item.dataset.timestamp,
    message: item.dataset.message,
  }));
}

async function copyLogs() {
  const rows = getLogRows();
  if (!rows.length) {
    showToast("NO LOG ENTRIES TO COPY");
    return;
  }

  const text = [
    "timestamp\tmessage",
    ...rows.map(({ timestamp, message }) => `${timestamp}\t${message}`),
  ].join("\n");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    if (!copied) throw new Error("Clipboard access unavailable");
  }
  showToast(`${rows.length} LOG ENTRIES COPIED`);
}

function downloadLogs() {
  const rows = getLogRows();
  if (!rows.length) {
    showToast("NO LOG ENTRIES TO DOWNLOAD");
    return;
  }

  const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    ["timestamp", "message"],
    ...rows.map(({ timestamp, message }) => [timestamp, message]),
  ]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `project-avatar-log-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`${rows.length} LOG ENTRIES DOWNLOADED`);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function describeSignal(rssi) {
  if (!Number.isFinite(rssi)) return "No Wi-Fi signal reading is available.";
  if (rssi >= -60) return `Strong connection (${rssi} dBm).`;
  if (rssi >= -70) return `Usable connection (${rssi} dBm).`;
  return `Weak connection (${rssi} dBm). Move the ESP32 closer to the router.`;
}

function setOverallStatus(readings, outputs) {
  const statusIcon = elements.overallStatus.querySelector("span");
  const statusCopy = elements.overallStatus.querySelector("p");
  elements.overallStatus.classList.remove("is-good", "is-alert");

  if (readings.fireDetected) {
    elements.overallStatus.classList.add("is-alert");
    statusIcon.textContent = "!";
    statusCopy.innerHTML = outputs.fireResponse
      ? "<strong>Fire detected · pump active</strong>Check the farm immediately. The local response is running."
      : "<strong>Fire detected · pump inactive</strong>Check the farm immediately. The controller is not spraying.";
    return;
  }

  if (outputs.fireLockout) {
    elements.overallStatus.classList.add("is-alert");
    statusIcon.textContent = "!";
    statusCopy.innerHTML =
      "<strong>Fire response locked</strong>Inspect the unit before resetting the safety lock.";
    return;
  }

  if (readings.fireSensorEnabled === false) {
    elements.overallStatus.classList.add("is-alert");
    statusIcon.textContent = "!";
    statusCopy.innerHTML =
      "<strong>Fire sensor not configured</strong>Fire protection has not been commissioned on this unit.";
    return;
  }

  elements.overallStatus.classList.add("is-good");
  statusIcon.textContent = "✓";
  statusCopy.innerHTML =
    "<strong>No protection alert reported</strong>Check the last update time before acting on these readings.";
}

class FieldCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.telemetry = null;
    this.connected = false;
    this.visible = true;
    this.frame = 0;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
    });
    this.visibilityObserver.observe(canvas);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.start();
    });

    this.resize();
    this.start();
  }

  update(telemetry, connected = true) {
    this.telemetry = telemetry;
    this.connected = connected;
    this.draw(performance.now());
  }

  setConnected(connected) {
    this.connected = connected;
    this.draw(performance.now());
  }

  resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const bounds = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(bounds.width * ratio);
    this.canvas.height = Math.round(bounds.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = bounds.width;
    this.height = bounds.height;
    this.draw(performance.now());
  }

  start() {
    if (this.frame || !this.visible || document.hidden) return;
    const tick = (time) => {
      this.draw(time);
      if (!this.reducedMotion && this.visible && !document.hidden) {
        this.frame = requestAnimationFrame(tick);
      } else {
        this.frame = 0;
      }
    };
    this.frame = requestAnimationFrame(tick);
  }

  line(x1, y1, x2, y2, width = 2) {
    const context = this.context;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineWidth = width;
    context.strokeStyle = "#11110f";
    context.stroke();
  }

  label(text, x, y, size = 12, align = "left") {
    const context = this.context;
    context.fillStyle = "#11110f";
    context.font = `900 ${size}px "Courier New", monospace`;
    context.textAlign = align;
    context.fillText(text, x, y);
  }

  roundedRect(x, y, width, height, radius = 8) {
    const context = this.context;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  drawPlant(x, soilY, scale, sway) {
    const context = this.context;
    const top = soilY - 62 * scale;

    context.beginPath();
    context.moveTo(x, soilY);
    context.quadraticCurveTo(x + sway, soilY - 34 * scale, x + sway * 0.4, top);
    context.lineWidth = Math.max(2, 3 * scale);
    context.strokeStyle = "#11110f";
    context.stroke();

    for (const direction of [-1, 1]) {
      context.beginPath();
      context.moveTo(x + sway * 0.25, soilY - 31 * scale);
      context.quadraticCurveTo(
        x + direction * 18 * scale,
        soilY - 46 * scale,
        x + direction * 25 * scale,
        soilY - 38 * scale,
      );
      context.quadraticCurveTo(
        x + direction * 13 * scale,
        soilY - 29 * scale,
        x + sway * 0.25,
        soilY - 31 * scale,
      );
      context.fillStyle = "#b9f34a";
      context.fill();
      context.stroke();
    }
  }

  draw(time) {
    if (!this.width || !this.height) return;

    const context = this.context;
    const width = this.width;
    const height = this.height;
    const soilY = height * 0.67;
    const live = this.connected;
  const readings = this.telemetry?.readings;
    const soilRaw = Number(readings?.soilRaw);
    const hasSoilReading = readings?.soilSensorEnabled !== false &&
      Number.isFinite(soilRaw) && soilRaw >= 0;
    const isDry = hasSoilReading && soilRaw >= dryThreshold;
    const t = this.reducedMotion ? 0 : time / 1000;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffd84d";
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.13;
    for (let x = 0; x < width; x += 22) this.line(x, 0, x, height, 1);
    for (let y = 0; y < height; y += 22) this.line(0, y, width, y, 1);
    context.globalAlpha = 1;

    context.fillStyle = isDry ? "#ff9b6f" : "#b9f34a";
    context.fillRect(0, soilY, width, height - soilY);
    this.line(0, soilY, width, soilY, 4);

    context.save();
    context.beginPath();
    context.rect(0, soilY, width, height - soilY);
    context.clip();
    context.globalAlpha = 0.22;
    for (let x = -height; x < width + height; x += 16) {
      this.line(x, height, x + height, soilY, 1);
    }
    context.restore();

    const plantCount = width < 520 ? 4 : 6;
    for (let index = 0; index < plantCount; index += 1) {
      const x = width * (0.08 + index * (0.48 / Math.max(plantCount - 1, 1)));
      const sway = Math.sin(t * 1.2 + index) * 3;
      this.drawPlant(x, soilY, 0.75 + (index % 3) * 0.08, sway);
    }

    const probeX = width * 0.54;
    this.line(probeX, soilY - 54, probeX, soilY + 58, 5);
    context.fillStyle = "#fffdf5";
    context.fillRect(probeX - 13, soilY + 36, 26, 26);
    context.strokeStyle = "#11110f";
    context.lineWidth = 3;
    context.strokeRect(probeX - 13, soilY + 36, 26, 26);
    this.label("SOIL", probeX, soilY - 65, 11, "center");

    const deviceWidth = Math.min(210, width * 0.3);
    const deviceHeight = 120;
    const deviceX = width - deviceWidth - 30;
    const deviceY = 38;

    context.fillStyle = "#11110f";
    this.roundedRect(deviceX + 7, deviceY + 7, deviceWidth, deviceHeight, 10);
    context.fill();
    context.fillStyle = "#fffdf5";
    this.roundedRect(deviceX, deviceY, deviceWidth, deviceHeight, 10);
    context.fill();
    context.strokeStyle = "#11110f";
    context.lineWidth = 3;
    context.stroke();

    this.label("ESP32 FIELD UNIT", deviceX + 18, deviceY + 31, 13);
    this.label(live ? "CONNECTED" : "WAITING", deviceX + 18, deviceY + 58, 18);
    this.label(
      this.telemetry && hasSoilReading ? `${formatNumber(soilRaw)} ADC` : "NO DATA",
      deviceX + 18,
      deviceY + 86,
      13,
    );

    context.beginPath();
    context.arc(deviceX + deviceWidth - 25, deviceY + 26, 8, 0, Math.PI * 2);
    context.fillStyle = live ? "#b9f34a" : "#ff6b57";
    context.fill();
    context.stroke();

    const cableStartX = probeX;
    const cableStartY = soilY - 52;
    const cableEndX = deviceX;
    const cableEndY = deviceY + 82;
    context.beginPath();
    context.moveTo(cableStartX, cableStartY);
    context.bezierCurveTo(
      cableStartX + 50,
      cableStartY - 105,
      cableEndX - 70,
      cableEndY + 55,
      cableEndX,
      cableEndY,
    );
    context.lineWidth = 3;
    context.strokeStyle = "#11110f";
    context.setLineDash([8, 7]);
    context.lineDashOffset = live ? -t * 22 : 0;
    context.stroke();
    context.setLineDash([]);

    const serverX = deviceX + deviceWidth * 0.5;
    const serverY = deviceY + deviceHeight + 58;
    this.line(serverX, deviceY + deviceHeight, serverX, serverY - 17, 3);
    context.fillStyle = "#7db7ff";
    context.fillRect(serverX - 58, serverY - 17, 116, 42);
    context.strokeStyle = "#11110f";
    context.lineWidth = 3;
    context.strokeRect(serverX - 58, serverY - 17, 116, 42);
    this.label("LOCAL SERVER", serverX, serverY + 9, 11, "center");

    context.fillStyle = "#fffdf5";
    context.fillRect(16, 16, 125, 38);
    context.strokeRect(16, 16, 125, 38);
    this.label(
      !hasSoilReading ? "SOIL: WAIT" : isDry ? "SOIL: DRY" : "SOIL: MOIST",
      78,
      41,
      12,
      "center",
    );
  }
}

const fieldCanvas = new FieldCanvas(document.querySelector("#field-canvas"));

function renderTelemetry(telemetry, log = true) {
  if (!telemetry) return;

  const { readings, outputs } = telemetry;
  currentMode = telemetry.mode;
  const simulation = currentMode === "simulation";
  for (const button of document.querySelectorAll("[data-action]")) {
    if (button.dataset.action.startsWith("SIMULATE_") ||
        button.dataset.action === "CLEAR_SIMULATION") {
      button.disabled = !simulation;
      button.title = simulation ? "" : "Available only in simulation mode";
    }
  }
  elements.controlsExplanation.textContent = simulation
    ? "These controls change simulated readings only. Pump and servo controls remain disabled."
    : "Simulation controls are unavailable while the unit is reading physical sensors.";
  const soilRaw = Number(readings.soilRaw);
  const hasSoilReading = readings.soilSensorEnabled !== false &&
    Number.isFinite(soilRaw) && soilRaw >= 0;
  const isDry = hasSoilReading && (typeof readings.soilDry === "boolean"
    ? readings.soilDry : soilRaw >= dryThreshold);
  const rssi = telemetry.wifiRssi == null ? NaN : Number(telemetry.wifiRssi);
  const receivedAt = Date.parse(telemetry.receivedAt);
  lastTelemetryAt = Number.isFinite(receivedAt) ? receivedAt : Date.now();
  const isFresh = Date.now() - lastTelemetryAt <= telemetryFreshnessMs;

  elements.connection.classList.add("is-live");
  elements.connectionLabel.textContent = telemetry.source === "thingspeak"
    ? "THINGSPEAK REPORT" : "RECENT FIELD REPORT";
  elements.deviceState.textContent = "REPORTED";
  elements.deviceWord.textContent = "RECENT DATA";
  elements.deviceId.textContent = telemetry.deviceId;
  elements.temperature.textContent = formatNumber(readings.temperatureC, 1);
  elements.humidity.textContent = formatNumber(readings.humidityPercent, 1);
  elements.soil.textContent = hasSoilReading ? formatNumber(soilRaw) : "—";
  elements.temperatureState.textContent = telemetry.source === "thingspeak"
    ? "CLOUD" : telemetry.mode === "simulation" ? "SIMULATED" : "SENSOR";
  elements.humidityState.textContent = telemetry.source === "thingspeak"
    ? "CLOUD" : telemetry.mode === "simulation" ? "SIMULATED" : "SENSOR";
  elements.introCopy.textContent = telemetry.source === "thingspeak"
    ? "Recorded readings from your private ThingSpeak channels. Check the update time before acting."
    : telemetry.mode === "simulation"
    ? "Simulation readings from the field unit. Last update time shows how recent they are."
    : "Latest readings from the field unit. Check the last update time before acting.";
  elements.mode.textContent =
    telemetry.mode === "simulation" ? "Simulation" : "Physical hardware";
  elements.rssi.textContent = Number.isFinite(rssi) ? `${formatNumber(rssi)} dBm` : "—";
  elements.dataSource.textContent = telemetry.source === "thingspeak"
    ? "Private ThingSpeak channels" : "Local field server (cloud not configured)";
  const raw = readings.probe?.raw;
  elements.probe.textContent = raw && readings.probe.validCount > 0
    ? `pH ${formatNumber(raw.ph)} · EC ${formatNumber(raw.ec)} · N ${formatNumber(raw.nitrogen)} · P ${formatNumber(raw.phosphorus)} · K ${formatNumber(raw.potassium)} (raw registers, unverified units)`
    : "No recent probe reading";
  elements.gas.textContent = readings.mq6Raw == null
    ? "No reading" : `${formatNumber(readings.mq6Raw)} ADC (uncalibrated)`;
  elements.water.textContent = outputs.fireResponse ? "Fire pump commanded on"
    : outputs.irrigation ? "Irrigation pump commanded on"
    : outputs.fireLockout ? "Fire response blocked; inspect system"
    : outputs.irrigationLockout ? "Irrigation fault; inspect water path"
    : "Pumps commanded off";
  elements.fire.textContent = readings.fireSensorEnabled === false
    ? "Not configured"
    : readings.fireDetected ? "Fire detected" : "Clear";
  elements.lastSeen.textContent = `Last update: ${new Date(
    telemetry.receivedAt,
  ).toLocaleTimeString()}`;

  elements.soilState.textContent = !hasSoilReading ? "NOT CONFIGURED" : isDry ? "DRY" : "MOIST";
  elements.soilExplanation.textContent = !hasSoilReading
    ? "The soil moisture sensor has not been commissioned."
    : isDry ? "Above the configured irrigation threshold."
    : "Below the configured dry-soil threshold.";
  elements.soilSummary.textContent = !hasSoilReading
    ? "No verified soil moisture reading is available."
    : isDry ? `Dry: ${soilRaw} ADC is above the ${dryThreshold} irrigation threshold.`
    : `Moist: ${soilRaw} ADC is below the ${dryThreshold} irrigation threshold.`;
  elements.fireSummary.textContent = readings.fireSensorEnabled === false
    ? "Fire monitoring has not been configured."
    : readings.fireDetected
      ? outputs.fireResponse ? "Fire detected; the pump is active." : "Fire detected; the pump is inactive."
      : outputs.fireLockout ? "The fire response is locked until inspection."
      : "No fire detected in the latest reading.";
  elements.signalSummary.textContent = describeSignal(rssi);

  setOverallStatus(readings, outputs);
  fieldCanvas.update(telemetry, isFresh);

  for (const element of [
    elements.temperature,
    elements.humidity,
    elements.soil,
    elements.deviceWord,
  ]) {
    flashReading(element);
  }

  if (log) {
    addLog("ESP32 telemetry received", telemetry.receivedAt);
  }

  if (!isFresh) {
    markOffline(
      `Last ESP32 transmission: ${new Date(lastTelemetryAt).toLocaleTimeString()}.`,
    );
  }
}

function markOffline(reason = "No recent transmission") {
  currentMode = null;
  for (const button of document.querySelectorAll("[data-action]")) {
    if (button.dataset.action.startsWith("SIMULATE_") ||
        button.dataset.action === "CLEAR_SIMULATION")
      button.disabled = true;
  }
  elements.connection.classList.remove("is-live");
  elements.connectionLabel.textContent = "NO RECENT REPORT";
  elements.deviceState.textContent = "STALE";
  elements.deviceWord.textContent = "STALE DATA";
  elements.lastSeen.textContent = reason;
  elements.overallStatus.classList.remove("is-good");
  elements.overallStatus.classList.add("is-alert");
  elements.overallStatus.querySelector("span").textContent = "!";
  elements.overallStatus.querySelector("p").innerHTML =
    "<strong>No recent field report</strong>Check the unit's power and Wi-Fi. Local protection may still be working.";
  fieldCanvas.setConnected(false);
}

async function loadState() {
  const response = await fetch("/api/state");
  if (await redirectIfUnauthorized(response)) return;
  const snapshot = await response.json();
  cloudMode = snapshot.source === "thingspeak";
  if (!response.ok)
    throw new Error(snapshot.error || "Could not load the latest system state.");
  if (snapshot.source === "thingspeak" && !snapshot.latest) {
    markOffline("ThingSpeak has no field reports yet.");
    return;
  }
  renderTelemetry(snapshot.latest, false);
}

async function sendCommand(action) {
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, action }),
  });
  if (await redirectIfUnauthorized(response)) return;
  const result = await response.json();

  if (!response.ok) throw new Error(result.error || "Command could not be queued.");
  showToast(`${action.replaceAll("_", " ")} — COMMAND QUEUED`);
}

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", async () => {
    const simulationAction = button.dataset.action.startsWith("SIMULATE_") ||
      button.dataset.action === "CLEAR_SIMULATION";
    if (simulationAction && currentMode !== "simulation") return;
    button.disabled = true;
    button.classList.add("is-sending");
    try {
      await sendCommand(button.dataset.action);
    } catch (error) {
      showToast(error.message.toUpperCase());
    } finally {
      button.disabled = simulationAction && currentMode !== "simulation";
      button.classList.remove("is-sending");
    }
  });
}

function connectDashboardSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/ws/dashboard`);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.event === "telemetry" && !cloudMode) renderTelemetry(message.payload);
    if (message.event === "alert") {
      const labels = {
        FIRE_DETECTED: "Fire detected — check the farm now",
        FIRE_RESPONSE_FAULT: "Fire response stopped — inspect the water path",
        IRRIGATION_FAULT: "Irrigation stopped — inspect the water path",
      };
      const copy = labels[message.payload.alert] || "Field protection alert";
      addLog(copy, message.payload.at);
      showToast(copy.toUpperCase());
    }
    if (message.event === "alert-clear")
      addLog("Protection alert cleared by the field unit", message.payload.at);
    if (message.event === "command") {
      addLog(`Command queued: ${message.payload.action.toLowerCase().replaceAll("_", " ")}`);
    }
    if (message.event === "command-status") {
      const action = message.payload.action.toLowerCase().replaceAll("_", " ");
      const status = message.payload.applied ? "applied" : "rejected";
      addLog(`Command ${status}: ${action}`, message.payload.acknowledgedAt);
    }
    if (message.event === "farm-updated")
      loadFarmProfile().catch(() => { farmStatus.textContent = "Could not refresh setup status."; });
  });
  socket.addEventListener("close", () => {
    setTimeout(connectDashboardSocket, 1_000);
  });
}

connectDashboardSocket();

// Cloud-configured dashboards display ThingSpeak's recorded feed, not an
// optimistic copy of the ESP32's most recent unconfirmed transmission.
setInterval(() => {
  if (cloudMode) loadState().catch(() => markOffline("ThingSpeak is unavailable."));
}, 20_000);

setInterval(() => {
  if (lastTelemetryAt && Date.now() - lastTelemetryAt > telemetryFreshnessMs) {
    markOffline("No ESP32 report received for more than two and a half minutes.");
  }
}, 2_000);

loadState().catch((error) => {
  markOffline(error.message);
  showToast(error.message.toUpperCase());
});
loadFarmProfile().catch((error) => { farmStatus.textContent = error.message; });
setInterval(() => { if (farmSetup) renderFarmProfile(farmSetup); }, 60_000);

farmForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = farmForm.querySelector('[type="submit"]');
  submit.disabled = true;
  farmStatus.textContent = "Saving greenhouse details…";
  try {
    const response = await fetch("/api/farm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(farmForm))),
    });
    if (await redirectIfUnauthorized(response)) return;
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save greenhouse details.");
    renderFarmProfile(result);
  } catch (error) {
    farmStatus.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
reportButton.addEventListener("click", () => {
  if (!reportButton.disabled) window.location.assign("/report/");
});

copyLogsButton.addEventListener("click", () => {
  copyLogs().catch(() => showToast("COPY FAILED — USE DOWNLOAD CSV"));
});
downloadLogsButton.addEventListener("click", downloadLogs);
signOutButton.addEventListener("click", () => {
  signOut().catch(() => {
    signOutButton.disabled = false;
    showToast("SIGN OUT FAILED — TRY AGAIN");
  });
});
