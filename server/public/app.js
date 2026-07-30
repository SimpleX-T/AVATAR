const deviceId = "night-garden-001";
const dryThreshold = 1800;
const eventLog = document.querySelector("#event-log");
const toast = document.querySelector("#toast");
let lastTelemetryAt = 0;

const elements = {
  connection: document.querySelector("#connection"),
  connectionLabel: document.querySelector("#connection-label"),
  temperature: document.querySelector("#temperature-value"),
  humidity: document.querySelector("#humidity-value"),
  soil: document.querySelector("#soil-value"),
  soilState: document.querySelector("#soil-state"),
  soilExplanation: document.querySelector("#soil-explanation"),
  deviceState: document.querySelector("#device-state"),
  deviceWord: document.querySelector("#device-word"),
  lastSeen: document.querySelector("#last-seen"),
  soilSummary: document.querySelector("#soil-summary"),
  motionSummary: document.querySelector("#motion-summary"),
  fireSummary: document.querySelector("#fire-summary"),
  signalSummary: document.querySelector("#signal-summary"),
  overallStatus: document.querySelector("#overall-status"),
  deviceId: document.querySelector("#device-id-value"),
  mode: document.querySelector("#mode-value"),
  rssi: document.querySelector("#rssi-value"),
  motion: document.querySelector("#motion-value"),
  fire: document.querySelector("#fire-value"),
};

function formatNumber(value, digits = 0) {
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
  item.append(time, description);
  eventLog.prepend(item);

  while (eventLog.children.length > 7) {
    eventLog.lastElementChild.remove();
  }
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

  if (outputs.fireResponse) {
    elements.overallStatus.classList.add("is-alert");
    statusIcon.textContent = "!";
    statusCopy.innerHTML =
      "<strong>Fire response active</strong>The controller reports an active fire-response state.";
    return;
  }

  if (readings.motionDetected) {
    elements.overallStatus.classList.add("is-alert");
    statusIcon.textContent = "!";
    statusCopy.innerHTML =
      "<strong>Movement detected</strong>The simulated motion detector is currently active.";
    return;
  }

  elements.overallStatus.classList.add("is-good");
  statusIcon.textContent = "✓";
  statusCopy.innerHTML =
    "<strong>System operating normally</strong>The ESP32 is online and no protection alert is active.";
}

class FieldCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.telemetry = null;
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

  update(telemetry) {
    this.telemetry = telemetry;
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

  drawBird(x, y, scale, phase) {
    const context = this.context;
    const wingLift = Math.sin(phase) * 3 * scale;

    context.save();
    context.translate(x, y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#11110f";
    context.lineWidth = Math.max(2, 2.5 * scale);

    context.beginPath();
    context.moveTo(-15 * scale, 2 * scale);
    context.quadraticCurveTo(-8 * scale, -7 * scale - wingLift, 0, 0);
    context.quadraticCurveTo(8 * scale, -7 * scale + wingLift, 15 * scale, 2 * scale);
    context.stroke();
    context.restore();
  }

  drawRabbit(x, soilY, scale, phase) {
    const context = this.context;
    const peek = (Math.sin(phase) + 1) * 2.5 * scale;
    const headY = soilY - 14 * scale - peek;

    context.save();
    context.translate(x, headY);
    context.fillStyle = "#fffdf5";
    context.strokeStyle = "#11110f";
    context.lineWidth = Math.max(2, 2.5 * scale);

    for (const direction of [-1, 1]) {
      context.beginPath();
      context.ellipse(
        direction * 7 * scale,
        -18 * scale,
        4.5 * scale,
        13 * scale,
        direction * 0.16,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.stroke();
    }

    context.beginPath();
    context.arc(0, 0, 14 * scale, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "#11110f";
    context.beginPath();
    context.arc(-5 * scale, -2 * scale, 1.8 * scale, 0, Math.PI * 2);
    context.arc(5 * scale, -2 * scale, 1.8 * scale, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.moveTo(-2 * scale, 4 * scale);
    context.lineTo(2 * scale, 4 * scale);
    context.lineTo(0, 7 * scale);
    context.closePath();
    context.fillStyle = "#ff6b57";
    context.fill();
    context.restore();
  }

  drawFieldWorker(x, soilY, scale, phase) {
    const context = this.context;
    const step = Math.sin(phase) * 3 * scale;
    const bodyY = soilY - 48 * scale;

    context.save();
    context.translate(x, 0);
    context.strokeStyle = "#11110f";
    context.fillStyle = "#7db7ff";
    context.lineCap = "round";
    context.lineWidth = Math.max(2, 3 * scale);

    context.beginPath();
    context.arc(0, bodyY - 16 * scale, 8 * scale, 0, Math.PI * 2);
    context.fillStyle = "#ffd9a0";
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(-13 * scale, bodyY - 22 * scale);
    context.lineTo(13 * scale, bodyY - 22 * scale);
    context.lineTo(8 * scale, bodyY - 29 * scale);
    context.lineTo(-6 * scale, bodyY - 29 * scale);
    context.closePath();
    context.fillStyle = "#ff6b57";
    context.fill();
    context.stroke();

    context.fillStyle = "#7db7ff";
    context.fillRect(-8 * scale, bodyY - 8 * scale, 16 * scale, 28 * scale);
    context.strokeRect(-8 * scale, bodyY - 8 * scale, 16 * scale, 28 * scale);

    this.line(x - 5 * scale, bodyY + 20 * scale, x - 8 * scale - step, soilY, 3);
    this.line(x + 5 * scale, bodyY + 20 * scale, x + 8 * scale + step, soilY, 3);
    this.line(x - 7 * scale, bodyY, x - 16 * scale + step, bodyY + 15 * scale, 3);
    this.line(x + 7 * scale, bodyY, x + 16 * scale - step, bodyY + 15 * scale, 3);
    context.restore();
  }

  draw(time) {
    if (!this.width || !this.height) return;

    const context = this.context;
    const width = this.width;
    const height = this.height;
    const soilY = height * 0.67;
    const live = Boolean(this.telemetry);
    const readings = this.telemetry?.readings;
    const soilRaw = Number(readings?.soilRaw || 1450);
    const isDry = soilRaw >= dryThreshold;
    const t = this.reducedMotion ? 0 : time / 1000;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffd84d";
    context.fillRect(0, 0, width, height);

    context.globalAlpha = 0.13;
    for (let x = 0; x < width; x += 22) this.line(x, 0, x, height, 1);
    for (let y = 0; y < height; y += 22) this.line(0, y, width, y, 1);
    context.globalAlpha = 1;

    const birdTravel = this.reducedMotion ? 0.42 : (t * 0.018) % 1;
    this.drawBird(
      width * (0.08 + birdTravel * 0.5),
      height * 0.19 + Math.sin(t * 0.45) * 4,
      0.85,
      t * 2.1,
    );
    this.drawBird(
      width * (0.22 + birdTravel * 0.38),
      height * 0.28 + Math.sin(t * 0.38 + 1.4) * 3,
      0.62,
      t * 1.8 + 1.2,
    );

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

    if (width >= 520) {
      this.drawFieldWorker(width * 0.64, soilY, 0.72, t * 0.9);
    }
    this.drawRabbit(width * (width < 520 ? 0.72 : 0.76), soilY, 0.72, t * 0.7);

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
      live ? `${formatNumber(soilRaw)} ADC` : "NO DATA",
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
    this.label(isDry ? "SOIL: DRY" : "SOIL: MOIST", 78, 41, 12, "center");
  }
}

const fieldCanvas = new FieldCanvas(document.querySelector("#field-canvas"));

function renderTelemetry(telemetry, log = true) {
  if (!telemetry) return;

  const { readings, outputs } = telemetry;
  const soilRaw = Number(readings.soilRaw);
  const isDry = soilRaw >= dryThreshold;
  const rssi = Number(telemetry.wifiRssi);
  lastTelemetryAt = Date.now();

  elements.connection.classList.add("is-live");
  elements.connectionLabel.textContent = "ONLINE — RECEIVING DATA";
  elements.deviceState.textContent = "ONLINE";
  elements.deviceWord.textContent = "ONLINE";
  elements.deviceId.textContent = telemetry.deviceId;
  elements.temperature.textContent = formatNumber(readings.temperatureC, 1);
  elements.humidity.textContent = formatNumber(readings.humidityPercent, 1);
  elements.soil.textContent = formatNumber(soilRaw);
  elements.mode.textContent =
    telemetry.mode === "simulation" ? "Simulation" : "Physical hardware";
  elements.rssi.textContent = `${formatNumber(rssi)} dBm`;
  elements.motion.textContent = readings.motionDetected ? "Detected" : "Clear";
  elements.fire.textContent = outputs.fireResponse ? "Active" : "Clear";
  elements.lastSeen.textContent = `Last update: ${new Date(
    telemetry.receivedAt,
  ).toLocaleTimeString()}`;

  elements.soilState.textContent = isDry ? "DRY" : "MOIST";
  elements.soilExplanation.textContent = isDry
    ? "Above the configured irrigation threshold."
    : "Below the configured dry-soil threshold.";
  elements.soilSummary.textContent = isDry
    ? `Dry: ${soilRaw} ADC is above the ${dryThreshold} irrigation threshold.`
    : `Moist: ${soilRaw} ADC is below the ${dryThreshold} irrigation threshold.`;
  elements.motionSummary.textContent = readings.motionDetected
    ? "Movement is currently detected."
    : "No movement is currently detected.";
  elements.fireSummary.textContent = outputs.fireResponse
    ? "The fire-response state is active."
    : "No fire-response event is active.";
  elements.signalSummary.textContent = describeSignal(rssi);

  setOverallStatus(readings, outputs);
  fieldCanvas.update(telemetry);

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
}

function markOffline(reason = "No recent transmission") {
  elements.connection.classList.remove("is-live");
  elements.connectionLabel.textContent = "OFFLINE — CHECK CONNECTION";
  elements.deviceState.textContent = "OFFLINE";
  elements.deviceWord.textContent = "OFFLINE";
  elements.lastSeen.textContent = reason;
  elements.overallStatus.classList.remove("is-good");
  elements.overallStatus.classList.add("is-alert");
  elements.overallStatus.querySelector("span").textContent = "!";
  elements.overallStatus.querySelector("p").innerHTML =
    "<strong>ESP32 connection interrupted</strong>Check Wi-Fi, the server address, and power to the board.";
}

async function loadState() {
  const response = await fetch("/api/state");
  if (!response.ok) throw new Error("Could not load the latest system state.");
  const snapshot = await response.json();
  renderTelemetry(snapshot.latest, false);
}

async function sendCommand(action) {
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, action }),
  });
  const result = await response.json();

  if (!response.ok) throw new Error(result.error || "Command could not be queued.");
  showToast(`${action.replaceAll("_", " ")} — COMMAND QUEUED`);
}

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.classList.add("is-sending");
    try {
      await sendCommand(button.dataset.action);
    } catch (error) {
      showToast(error.message.toUpperCase());
    } finally {
      button.disabled = false;
      button.classList.remove("is-sending");
    }
  });
}

const eventSource = new EventSource("/api/events");
eventSource.addEventListener("telemetry", (event) => {
  renderTelemetry(JSON.parse(event.data));
});
eventSource.addEventListener("command", (event) => {
  const command = JSON.parse(event.data);
  const action = command.action.toLowerCase().replaceAll("_", " ");
  addLog(`Command queued: ${action}`);
});
eventSource.onerror = () => {
  if (Date.now() - lastTelemetryAt > 12_000) {
    markOffline("Live server connection interrupted.");
  }
};

setInterval(() => {
  if (lastTelemetryAt && Date.now() - lastTelemetryAt > 12_000) {
    markOffline("No ESP32 transmission received for 12 seconds.");
  }
}, 2_000);

loadState().catch((error) => {
  markOffline(error.message);
  showToast(error.message.toUpperCase());
});
