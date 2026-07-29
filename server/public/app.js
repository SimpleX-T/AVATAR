const deviceId = "night-garden-001";
const soilHistory = [];
const eventLog = document.querySelector("#event-log");
const toast = document.querySelector("#toast");

const elements = {
  connection: document.querySelector("#connection"),
  connectionLabel: document.querySelector("#connection-label"),
  soil: document.querySelector("#soil-value"),
  temperature: document.querySelector("#temperature-value"),
  humidity: document.querySelector("#humidity-value"),
  climateNote: document.querySelector("#climate-note"),
  mode: document.querySelector("#mode-value"),
  rssi: document.querySelector("#rssi-value"),
  motion: document.querySelector("#motion-value"),
  fire: document.querySelector("#fire-value"),
  lastSeen: document.querySelector("#last-seen"),
};

function formatNumber(value, digits = 0) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function addLog(message, timestamp = new Date()) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  const description = document.createElement("span");
  time.textContent = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  description.textContent = message;
  item.append(time, description);
  eventLog.prepend(item);

  while (eventLog.children.length > 6) {
    eventLog.lastElementChild.remove();
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function drawSoilChart() {
  const canvas = document.querySelector("#soil-chart");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  if (soilHistory.length < 2) return;

  const minimum = Math.min(...soilHistory) - 100;
  const maximum = Math.max(...soilHistory) + 100;
  const range = Math.max(maximum - minimum, 1);

  context.beginPath();
  soilHistory.forEach((value, index) => {
    const x = (index / (soilHistory.length - 1)) * width;
    const y = height - ((value - minimum) / range) * (height - 12) - 6;
    index === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
  });
  context.strokeStyle = "#a9df82";
  context.lineWidth = 2;
  context.stroke();
}

function renderTelemetry(telemetry, log = true) {
  if (!telemetry) return;

  const { readings, outputs } = telemetry;
  elements.connection.classList.add("is-live");
  elements.connectionLabel.textContent = `${telemetry.deviceId} connected`;
  elements.soil.textContent = formatNumber(readings.soilRaw);
  elements.temperature.textContent = formatNumber(readings.temperatureC, 1);
  elements.humidity.textContent = formatNumber(readings.humidityPercent, 1);
  elements.mode.textContent = telemetry.mode;
  elements.rssi.textContent = `${formatNumber(telemetry.wifiRssi)} dBm`;
  elements.motion.textContent = readings.motionDetected ? "Detected" : "Clear";
  elements.fire.textContent = outputs.fireResponse ? "Active" : "Clear";
  elements.lastSeen.textContent = `Seen ${new Date(
    telemetry.receivedAt,
  ).toLocaleTimeString()}`;

  const dry = Number(readings.soilRaw) >= 1800;
  elements.climateNote.textContent = dry
    ? "Soil has crossed the configured dry threshold. In hardware mode, the guarded irrigation cycle would respond."
    : "Conditions are within the current simulation baseline.";

  soilHistory.push(Number(readings.soilRaw));
  if (soilHistory.length > 40) soilHistory.shift();
  drawSoilChart();

  if (log) addLog("Telemetry received from the field station", telemetry.receivedAt);
}

async function loadState() {
  const response = await fetch("/api/state");
  const snapshot = await response.json();
  for (const telemetry of snapshot.history || []) {
    soilHistory.push(Number(telemetry.readings.soilRaw));
  }
  if (soilHistory.length > 40) soilHistory.splice(0, soilHistory.length - 40);
  renderTelemetry(snapshot.latest, false);
}

async function sendCommand(action) {
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, action }),
  });
  const result = await response.json();

  if (!response.ok) throw new Error(result.error || "Command failed");
  showToast(`${action.replaceAll("_", " ").toLowerCase()} queued`);
}

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await sendCommand(button.dataset.action);
    } catch (error) {
      showToast(error.message);
    } finally {
      button.disabled = false;
    }
  });
}

const eventSource = new EventSource("/api/events");
eventSource.addEventListener("telemetry", (event) => {
  renderTelemetry(JSON.parse(event.data));
});
eventSource.addEventListener("command", (event) => {
  const command = JSON.parse(event.data);
  addLog(`Command queued: ${command.action.toLowerCase().replaceAll("_", " ")}`);
});
eventSource.onerror = () => {
  elements.connection.classList.remove("is-live");
  elements.connectionLabel.textContent = "Server link interrupted";
};

window.addEventListener("resize", drawSoilChart);
loadState().catch((error) => showToast(error.message));
