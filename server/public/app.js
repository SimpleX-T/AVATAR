import {
  fieldState,
  activationState,
  numeric,
  temperaturePoints,
} from "./field-model.js";
import { readApiResponse } from "./http-response.js";
import { mountFigureViewport } from "./figure-viewport.js";
const $ = (id) => document.getElementById(id);
const state = {
  latest: null,
  history: [],
  farm: null,
  report: null,
  source: "local",
  cloudConfigured: false,
  pendingUpload: false,
  cloudError: null,
  step: 1,
  selected: "controller",
  events: [],
  pendingCommands: new Map(),
  recentCommandStatuses: new Map(),
  initialized: false,
  requestBusy: false,
};
const views = new Set(["overview", "readings", "activity", "reports", "setup"]);
let socket,
  reconnectTimer,
  toastTimer,
  profileBusy = false,
  lastSocketAt = 0;
const draftKey = "avatar-greenhouse-draft-v2";
const fmt = (v, d = 0) => (numeric(v) === null ? "—" : v.toFixed(d));
const time = (v) =>
  new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
function text(id, value) {
  $(id).textContent = value;
}
function badge(id, label, tone = "") {
  const el = $(id);
  el.textContent = label;
  el.className = "status-badge " + tone;
}
function toast(message) {
  clearTimeout(toastTimer);
  text("toast", message);
  $("toast").classList.add("visible");
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 5500);
}
async function api(path, options = {}) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(path, { ...options, signal: controller.signal });
    if (r.status === 401) {
      location.assign("/auth/");
      throw new Error("Sign in again to reconnect to your greenhouse.");
    }
    return await readApiResponse(r);
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error(
        "The server took too long to respond. Check the connection and retry.",
      );
    throw e;
  } finally {
    clearTimeout(deadline);
  }
}
function route() {
  window.scrollTo({ top: 0, behavior: "instant" });
  const name = views.has(location.hash.slice(1))
    ? location.hash.slice(1)
    : "overview";
  document
    .querySelectorAll("[data-view]")
    .forEach((el) => (el.hidden = el.dataset.view !== name));
  document.querySelectorAll("[data-nav]").forEach((el) => {
    if (el.dataset.nav === name) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  text(
    "breadcrumb",
    "Workspace / " +
      {
        overview: "Overview",
        readings: "Sensor readings",
        activity: "Activity",
        reports: "Research reports",
        setup: "Greenhouse setup",
      }[name],
  );
  if (name === "setup") renderSetup();
}
function go(name) {
  location.hash = name;
  window.scrollTo({ top: 0, behavior: "instant" });
  requestAnimationFrame(() => {
    const target = document.querySelector(`[data-view="${name}"] h1`);
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  });
}
window.addEventListener("hashchange", route);
document
  .querySelectorAll("[data-go]")
  .forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
function log(message, at = new Date().toISOString()) {
  if (state.events[0]?.message === message) return;
  state.events.unshift({ message, at });
  state.events = state.events.slice(0, 80);
  $("event-log").replaceChildren();
  for (const item of state.events) {
    const li = document.createElement("li"),
      stamp = document.createElement("time"),
      copy = document.createElement("span");
    stamp.dateTime = item.at;
    stamp.textContent = time(item.at);
    copy.textContent = item.message;
    li.append(stamp, copy);
    $("event-log").append(li);
  }
}
function acceptTelemetry(t, record = true) {
  if (!t?.readings || !t?.outputs) return;
  const previous = state.latest;
  state.latest = t;
  if (!state.history.some((row) => row.receivedAt === t.receivedAt))
    state.history.push(t);
  state.history = state.history.slice(-120);
  if (record && previous?.receivedAt !== t.receivedAt) {
    if (
      previous?.outputs?.lastEvent !== t.outputs.lastEvent &&
      t.outputs.lastEvent &&
      t.outputs.lastEvent !== "BOOT"
    )
      log(
        "Field event: " +
          t.outputs.lastEvent.toLowerCase().replaceAll("_", " "),
        t.receivedAt,
      );
    else log("Field observation received from " + t.deviceId, t.receivedAt);
  }
  render();
}
function render() {
  const t = state.latest,
    f = fieldState(t),
    r = f.readings,
    o = f.outputs;
  const fresh = f.fresh,
    simulated = t?.mode === "simulation";
  text("temperature-value", fmt(r.temperatureC, 1));
  text("humidity-value", fmt(r.humidityPercent, 1));
  text("soil-value", fmt(f.soilRaw));
  const provenance = simulated
    ? "Simulation · not a physical observation"
    : fresh
      ? "Recent sensor observation"
      : t
        ? "Last recorded observation"
        : "Waiting for sensor";
  text(
    "temperature-note",
    numeric(r.temperatureC) === null ? "No valid DHT11 reading" : provenance,
  );
  text(
    "humidity-note",
    numeric(r.humidityPercent) === null ? "No valid DHT11 reading" : provenance,
  );
  text(
    "soil-note",
    !f.soilValid
      ? "Sensor missing or invalid"
      : !fresh
        ? "Last recorded observation"
        : r.soilDry === true
          ? "Dry soil reported"
          : r.soilDry === false
            ? "Wet / below dry threshold"
            : "Raw sensor reading",
  );
  text(
    "connection-value",
    fresh
      ? simulated
        ? "Simulation"
        : "Reporting"
      : t
        ? "Last seen"
        : "Waiting",
  );
  text(
    "connection-note",
    fresh
      ? "Recent report · " + time(t.receivedAt)
      : t
        ? "Last report " + time(t.receivedAt)
        : "No recent device report",
  );
  text(
    "network-status",
    fresh
      ? simulated
        ? "Simulation connected"
        : "Field unit reporting"
      : t
        ? "Field report is stale"
        : "Waiting for field unit",
  );
  $("network-status").className =
    "connection-chip " + (fresh ? "live" : "stale");
  text(
    "last-updated",
    t
      ? "Last observation " + time(t.receivedAt)
      : "Waiting for first observation",
  );
  text(
    "footer-source",
    state.source === "thingspeak"
      ? "Recorded cloud observation"
      : "Live field-unit observations",
  );
  const name = state.farm?.name;
  text("sidebar-farm", name || "Your greenhouse");
  const heading = $("greenhouse-heading");
  heading.replaceChildren(
    document.createTextNode(name ? name : "Your greenhouse,"),
    document.createElement("br"),
  );
  const em = document.createElement("em");
  em.textContent = "in view.";
  heading.append(document.createTextNode(" "), em);
  text(
    "overview-date",
    new Date().toLocaleDateString([], {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );
  text(
    "overview-summary",
    fresh
      ? "Your latest field observations, with local protection status."
      : t
        ? "Your field unit has not reported recently. Last observations are shown."
        : "Waiting for the field unit. Missing readings are shown as dashes.",
  );
  const alarm = f.fire[2] === "danger" || f.water[2] === "danger";
  const sensorGaps = [];
  if (fresh && f.hardware) {
    if (!f.soilValid) sensorGaps.push("soil input is invalid");
    if (numeric(r.temperatureC) === null || numeric(r.humidityPercent) === null)
      sensorGaps.push("DHT11 is not returning valid readings");
    if (r.fireSensorReady !== true)
      sensorGaps.push("fire detector is not armed");
  }
  $("field-alert").hidden = !alarm && sensorGaps.length === 0;
  if (!alarm && sensorGaps.length) {
    $("field-alert").className = "notice";
    text(
      "field-alert",
      "Field connection verified. Sensor checks still need attention: " +
        sensorGaps.join("; ") +
        ".",
    );
  }
  if (alarm) {
    $("field-alert").className = "notice danger";
    text(
      "field-alert",
      f.fire[2] === "danger"
        ? "Fire system: " +
            f.fire[1] +
            ". Local safety limits remain in control."
        : "Irrigation system: " +
            f.water[1] +
            ". Local safety limits remain in control.",
    );
  }
  badge("fire-badge", f.fire[0], f.fire[2]);
  text("fire-detail", f.fire[1]);
  badge("water-badge", f.water[0], f.water[2]);
  text("water-detail", f.water[1]);
  badge(
    "gas-badge",
    numeric(r.mq6Raw) === null ? "No data" : fmt(r.mq6Raw) + " ADC",
  );
  text("gas-detail", "MQ-6 · uncalibrated raw signal");
  text(
    "local-control-note",
    !fresh
      ? "Protection state is unknown from this dashboard. Local control runs on the ESP32."
      : o.controllerReady
        ? "Local controller reports ready. Pump status describes commands, not confirmed water flow."
        : "Controller is initialising or awaiting a stable detector. Check the field unit.",
  );
  $("setup-nudge").hidden = Boolean(state.farm?.deviceSyncedAt);
  $("setup-nav-dot").hidden = Boolean(state.farm?.deviceSyncedAt);
  text(
    "readings-source",
    simulated
      ? "SIMULATION"
      : state.source === "thingspeak"
        ? "CLOUD OBSERVATION"
        : "PHYSICAL FIELD REPORT",
  );
  text(
    "readings-timestamp",
    t ? new Date(t.receivedAt).toLocaleString() : "No report yet",
  );
  text(
    "device-mode",
    t ? (simulated ? "Simulation" : "Physical hardware") : "Unknown mode",
  );
  text("device-id", t?.deviceId || "—");
  text(
    "device-rssi",
    numeric(t?.wifiRssi) === null ? "Not reported" : fmt(t.wifiRssi) + " dBm",
  );
  text(
    "cloud-state",
    !state.cloudConfigured
      ? "Not configured"
      : state.cloudError
        ? "Unavailable · local readings retained"
        : state.pendingUpload
          ? "Upload pending"
          : "Configured · no upload pending",
  );
  document
    .querySelectorAll("[data-action]")
    .forEach(
      (b) => (b.disabled = !f.canCommand || state.pendingCommands.size > 0),
    );
  renderSensorRows(f);
  renderTrend();
  renderReports();
  renderSetup();
  renderFigureReadout();
}
function renderSensorRows(f) {
  const r = f.readings,
    raw = r.probe?.raw || {},
    valid = r.probe?.validCount || 0;
  const rows = [
    [
      "Air temperature",
      "DHT11 · degrees Celsius",
      fmt(r.temperatureC, 1) + " °C",
      numeric(r.temperatureC) !== null ? "Observed" : "No valid reading",
    ],
    [
      "Relative humidity",
      "DHT11 · moisture in air",
      fmt(r.humidityPercent, 1) + " %",
      numeric(r.humidityPercent) !== null ? "Observed" : "No valid reading",
    ],
    [
      "Soil moisture",
      "Capacitive probe · raw ADC",
      fmt(f.soilRaw),
      f.soilValid ? "Observed" : "Invalid / missing",
    ],
    ["Atmosphere signal", "MQ-6 · raw ADC", fmt(r.mq6Raw), "Uncalibrated"],
    ...[
      ["pH register", "ph"],
      ["Electrical conductivity register", "ec"],
      ["Nitrogen register", "nitrogen"],
      ["Phosphorus register", "phosphorus"],
      ["Potassium register", "potassium"],
    ].map(([label, key]) => [
      label,
      "RS-485 probe · raw register value",
      fmt(valid > 0 ? raw[key] : null),
      numeric(raw[key]) !== null && valid > 0
        ? "Unverified units"
        : "No valid register",
    ]),
  ];
  $("sensor-rows").replaceChildren();
  for (const [name, detail, value, status] of rows) {
    const row = document.createElement("div");
    row.className = "sensor-row";
    const label = document.createElement("div"),
      strong = document.createElement("strong"),
      small = document.createElement("small"),
      reading = document.createElement("span"),
      flag = document.createElement("span");
    strong.textContent = name;
    small.textContent = detail;
    label.append(strong, small);
    reading.textContent = value;
    flag.textContent = status;
    flag.className = "status-badge";
    row.append(label, reading, flag);
    $("sensor-rows").append(row);
  }
}
function renderTrend() {
  const rows = temperaturePoints(state.history);
  const root = $("trend");
  root.replaceChildren();
  if (rows.length < 2) {
    root.className = "trend-empty";
    root.textContent =
      "Two valid temperature observations are needed to show a trend.";
    return;
  }
  root.className = "trend-chart";
  const values = rows.map((t) => t.readings.temperatureC),
    min = Math.min(...values) - 1,
    max = Math.max(...values) + 1;
  const width = 500,
    height = 135,
    pad = 30,
    first = Date.parse(rows[0].receivedAt),
    last = Date.parse(rows.at(-1).receivedAt);
  const points = rows.map((t) => [
    pad +
      ((Date.parse(t.receivedAt) - first) / Math.max(last - first, 1)) *
        (width - pad - 8),
    10 + ((max - t.readings.temperatureC) / (max - min)) * (height - 25),
  ]);
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Temperature across ${rows.length} recorded observations, ${Math.min(...values).toFixed(1)} to ${Math.max(...values).toFixed(1)} degrees Celsius.`,
  );
  for (const [fraction, label] of [
    [0, max],
    [0.5, (min + max) / 2],
    [1, min],
  ]) {
    const y = 10 + fraction * (height - 25),
      line = document.createElementNS(ns, "path"),
      textEl = document.createElementNS(ns, "text");
    line.setAttribute("d", `M${pad} ${y}H${width}`);
    line.setAttribute("stroke", "#e8ece2");
    line.setAttribute("stroke-width", "1");
    textEl.setAttribute("x", "0");
    textEl.setAttribute("y", String(y + 3));
    textEl.textContent = label.toFixed(0) + "°";
    svg.append(line, textEl);
  }
  const path = document.createElementNS(ns, "path");
  path.setAttribute(
    "d",
    points
      .map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1))
      .join(" "),
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#638044");
  path.setAttribute("stroke-width", "2");
  svg.append(path);
  root.append(svg);
  const times = document.createElement("div");
  times.className = "chart-times";
  const start = document.createElement("span"),
    end = document.createElement("span");
  start.textContent = time(rows[0].receivedAt);
  end.textContent = time(rows.at(-1).receivedAt);
  times.append(start, end);
  root.append(times);
  text(
    "trend-caption",
    `${rows.length} actual observations · no estimated points`,
  );
}
function renderReports() {
  const farm = state.farm,
    report = state.report,
    eligible = report?.eligible === true;
  const message = !farm
    ? "Finish greenhouse setup to start your research record."
    : !farm.deviceSyncedAt
      ? "Waiting for the field unit to confirm setup. The 12-hour clock starts after acknowledgement."
      : eligible
        ? "Your first 12-hour window is complete. The report requires recorded ThingSpeak history."
        : `Your report unlocks ${new Date(report.eligibleAt).toLocaleString()}. The clock started when the ESP32 confirmed setup.`;
  text("report-status", message);
  text("report-summary", message);
  text(
    "report-state",
    !farm
      ? "SETUP NEEDED"
      : !farm.deviceSyncedAt
        ? "WAITING FOR DEVICE"
        : eligible
          ? "TIME WINDOW COMPLETE"
          : "OBSERVING YOUR GREENHOUSE",
  );
  $("open-report").disabled = !eligible;
}
function renderSetup() {
  const activated = activationState(state.farm, state.latest),
    f = fieldState(state.latest);
  if (state.farm && state.step !== 2) state.step = 3;
  document.querySelectorAll("[data-step]").forEach((li) => {
    const n = Number(li.dataset.step);
    li.className = n === state.step ? "active" : n < state.step ? "done" : "";
  });
  for (let i = 1; i <= 3; i++) $("setup-step-" + i).hidden = i !== state.step;
  text(
    "setup-device-name",
    state.latest?.deviceId || "Looking for the field unit",
  );
  text(
    "setup-device-status",
    activated.receiving
      ? "Physical field report received at " + time(state.latest.receivedAt)
      : state.latest?.mode === "simulation"
        ? "Simulation data is not physical commissioning evidence."
        : f.fresh
          ? "Waiting for a hardware-mode report."
          : "Keep the field unit powered and connected to Wi-Fi.",
  );
  badge(
    "setup-device-badge",
    activated.receiving ? "Receiving" : "Waiting",
    activated.receiving ? "good" : "warning",
  );
  $("setup-continue").disabled = !activated.receiving;
  text("profile-ack", activated.profileSaved ? "Confirmed ✓" : "Waiting");
  text(
    "fresh-ack",
    activated.receiving && activated.matching ? "Confirmed ✓" : "Waiting",
  );
  const success = activated.ready;
  text(
    "setup-confirm-title",
    success ? "Your greenhouse is connected." : "Making the connection stick.",
  );
  text(
    "setup-confirm-copy",
    success
      ? "The ESP32 confirmed your greenhouse details and is sending hardware reports. Open the dashboard to review sensor health before the physical test."
      : "Your details are saved on the server. Keep the ESP32 connected while it confirms on-chip storage.",
  );
  text(
    "setup-confirm-status",
    !state.farm
      ? "No profile saved yet."
      : !activated.matching && state.latest
        ? "The reporting device does not match this profile. Review details before continuing."
        : success
          ? "Connection and profile verified. The research window has started; sensor health is checked separately."
          : !activated.receiving
            ? "The field report is stale. Reconnect the ESP32; your saved details are kept."
            : "Still waiting for the field unit acknowledgement. You can leave this page and return.",
  );
  $("setup-finish").disabled = !success;
}
function selectSystem(system) {
  state.selected = system;
  document
    .querySelectorAll("[data-system]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.system === system)),
    );
  const doc = $("greenhouse-figure").contentDocument;
  if (doc) {
    const svg = doc.querySelector("svg");
    svg?.classList.add("selected");
    doc
      .querySelectorAll("[data-system]")
      .forEach((el) =>
        el.classList.toggle("selected-part", el.dataset.system === system),
      );
  }
  renderFigureReadout();
}
function renderFigureReadout() {
  const f = fieldState(state.latest),
    r = f.readings;
  const copy = {
    controller: [
      "ESP32 field unit",
      f.fresh
        ? `Recent report from ${state.latest.deviceId}. Decisions run locally; this drawing is a system schematic.`
        : "Waiting for a recent report. Local protection does not depend on this page.",
    ],
    soil: [
      "Soil observation",
      f.soilValid
        ? `${fmt(f.soilRaw)} raw ADC. ${r.soilDry === true ? "Dry soil reported." : "Dryness is interpreted by the local controller."}`
        : "The soil input is missing or invalid. Check the capacitive sensor before testing irrigation.",
    ],
    irrigation: [
      "Irrigation system",
      f.water[1] + ". Water flow is not independently measured.",
    ],
    fire: [
      "Fire protection",
      f.fire[1] + ". The controller uses bounded response bursts.",
    ],
    climate: [
      "Climate sensor",
      numeric(r.temperatureC) !== null
        ? `${fmt(r.temperatureC, 1)} °C · ${fmt(r.humidityPercent, 1)} % RH from the latest DHT11 report.`
        : "The DHT11 has not returned a valid climate observation.",
    ],
  };
  const [title, description] = copy[state.selected];
  text("system-readout-title", title);
  text("system-readout", description);
}
$("greenhouse-figure").addEventListener("load", () =>
  selectSystem(state.selected),
);
mountFigureViewport($("figure-stage"), $("greenhouse-figure"));
document
  .querySelectorAll("button[data-system]")
  .forEach((b) =>
    b.addEventListener("click", () => selectSystem(b.dataset.system)),
  );
function fillProfile() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(draftKey) || "null");
  } catch {}
  const identity = state.latest?.deviceId || state.farm?.deviceId;
  const usableDraft =
    draft?.profile &&
    draft.deviceId === identity &&
    draft.revision === (state.farm?.revision || null);
  const profile = usableDraft ? draft.profile : state.farm;
  if (profile)
    for (const key of ["name", "farmerName", "crop"])
      $("farm-profile-form").elements[key].value = profile[key] || "";
}
$("farm-profile-form").addEventListener("input", () => {
  const form = $("farm-profile-form");
  try {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        profile: Object.fromEntries(new FormData(form)),
        deviceId: state.latest?.deviceId || state.farm?.deviceId,
        revision: state.farm?.revision || null,
      }),
    );
  } catch {}
});
$("farm-profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (profileBusy) return;
  const f = fieldState(state.latest);
  if (!f.canCommand) {
    $("setup-save-error").hidden = false;
    text(
      "setup-save-error",
      "Wait for a recent physical report before saving. Your draft is kept.",
    );
    return;
  }
  const form = event.currentTarget;
  profileBusy = true;
  $("setup-save").disabled = true;
  text("setup-save", "Saving greenhouse…");
  $("setup-save-error").hidden = true;
  try {
    const data = await api("/api/farm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(new FormData(form)),
        deviceId: state.latest.deviceId,
      }),
    });
    state.farm = data.farm;
    state.report = data.report;
    state.step = 3;
    log(
      "Greenhouse details saved on the server; waiting for device acknowledgement.",
    );
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    render();
    const heading = $("setup-confirm-title");
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  } catch (e) {
    $("setup-save-error").hidden = false;
    text("setup-save-error", e.message);
  } finally {
    profileBusy = false;
    $("setup-save").disabled = false;
    text("setup-save", "Save to field unit →");
  }
});
$("setup-continue").addEventListener("click", () => {
  state.step = 2;
  renderSetup();
  $("farm-name").focus();
});
$("setup-back").addEventListener("click", () => {
  state.step = 1;
  renderSetup();
});
$("setup-edit").addEventListener("click", () => {
  state.step = 2;
  renderSetup();
  $("farm-name").focus();
});
$("setup-finish").addEventListener("click", () => {
  log("Greenhouse setup verified by the field unit.");
  go("overview");
});
async function refresh() {
  if (state.requestBusy) return;
  state.requestBusy = true;
  $("refresh").disabled = true;
  try {
    const [data, profile] = await Promise.all([
      api("/api/state"),
      api("/api/farm"),
    ]);
    state.source = data.source;
    state.cloudConfigured =
      data.cloudConfigured || data.source === "thingspeak";
    state.pendingUpload = data.pendingUpload;
    state.cloudError = data.cloudError;
    state.farm = profile.farm;
    state.report = profile.report;
    if (data.history) state.history = data.history;
    acceptTelemetry(data.latest, false);
    $("page-error").hidden = true;
    if (!state.initialized) {
      state.step = state.farm ? 3 : 1;
      fillProfile();
      state.initialized = true;
      if (!state.farm && !location.hash) go("setup");
    }
    render();
  } catch (e) {
    text("page-error", e.message + " Last observations are retained.");
    $("page-error").hidden = false;
  } finally {
    state.requestBusy = false;
    $("refresh").disabled = false;
  }
}
$("refresh").addEventListener("click", () => void refresh());
async function sendCommand(action) {
  if (!fieldState(state.latest).canCommand) return;
  try {
    const data = await api("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: state.latest.deviceId, action }),
    });
    const earlyStatus = state.recentCommandStatuses.get(data.commandId);
    if (earlyStatus) {
      state.recentCommandStatuses.delete(data.commandId);
      showCommandStatus(earlyStatus);
    } else {
      state.pendingCommands.set(data.commandId, { action, at: Date.now() });
      text("command-status", "Queued. Waiting for the field unit to acknowledge.");
      log("Identify LED request queued; not yet applied.");
    }
    render();
  } catch (e) {
    toast(e.message);
  }
}
function showCommandStatus(status) {
  const label = status.applied
    ? "Field unit accepted the blink request. Check the external LED on GPIO22."
    : status.error || "Field unit rejected the command.";
  text("command-status", label);
  log(label, status.acknowledgedAt);
  render();
}
document
  .querySelectorAll("[data-action]")
  .forEach((b) =>
    b.addEventListener("click", () => void sendCommand(b.dataset.action)),
  );
function connect() {
  clearTimeout(reconnectTimer);
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/dashboard`,
  );
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    lastSocketAt = Date.now();
    if (message.event === "telemetry") {
      state.source = "local";
      acceptTelemetry(message.payload);
    }
    if (message.event === "farm-updated") void refresh();
    if (message.event === "command-status") {
      const p = message.payload;
      if (state.pendingCommands.delete(p.commandId)) {
        showCommandStatus(p);
      } else if (p.action === "LED_IDENTIFY") {
        // The acknowledgement can reach this socket before the POST returns.
        state.recentCommandStatuses.set(p.commandId, p);
        if (state.recentCommandStatuses.size > 20)
          state.recentCommandStatuses.delete(state.recentCommandStatuses.keys().next().value);
      }
      if (p.action === "SET_PROFILE") void refresh();
    }
    if (message.event === "alert")
      log(
        "Field protection alert: " +
          message.payload.alert.toLowerCase().replaceAll("_", " "),
        message.payload.at,
      );
    if (message.event === "alert-clear")
      log("Field protection alert cleared.", message.payload.at);
  });
  socket.addEventListener("close", () => {
    reconnectTimer = setTimeout(connect, 5000);
  });
  socket.addEventListener("error", () => socket.close());
}
document
  .querySelectorAll("#operator-signout,#operator-signout-mobile")
  .forEach((button) =>
    button.addEventListener("click", async () => {
      try {
        await api("/api/auth/session", { method: "DELETE" });
        location.assign("/auth/?logout=1");
      } catch (e) {
        toast(e.message);
      }
    }),
  );
$("open-report").addEventListener("click", () => {
  window.open("/report/", "_blank", "noopener");
});
function logText(separator) {
  const safe = (s) => '"' + String(s).replaceAll('"', '""') + '"';
  return [
    "timestamp" + separator + "event",
    ...state.events.map((e) => safe(e.at) + separator + safe(e.message)),
  ].join("\n");
}
$("copy-logs").addEventListener("click", async () => {
  try {
    if (!state.events.length) return toast("No activity to copy yet.");
    await navigator.clipboard.writeText(logText("\t"));
    toast("Activity copied.");
  } catch {
    toast("Clipboard unavailable. Use Download CSV instead.");
  }
});
$("download-logs").addEventListener("click", () => {
  if (!state.events.length) return toast("No activity to export yet.");
  const url = URL.createObjectURL(
    new Blob([logText(",")], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "AVATAR-field-activity.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
setInterval(() => {
  if (document.hidden) return;
  render();
  for (const [id, p] of state.pendingCommands)
    if (Date.now() - p.at > 70000) {
      state.pendingCommands.delete(id);
      text(
        "command-status",
        "No acknowledgement received. Check the field unit connection before retrying.",
      );
      render();
    }
}, 5000);
setInterval(() => {
  if (!document.hidden) void refresh();
}, 20000);
setInterval(() => {
  if (!document.hidden && state.farm && !state.farm.deviceSyncedAt)
    void refresh();
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refresh();
});
window.addEventListener("online", () => void refresh());
window.addEventListener("offline", () => {
  text(
    "page-error",
    "This browser is offline. Local ESP32 protection continues; observations are not live.",
  );
  $("page-error").hidden = false;
});
route();
render();
void refresh();
connect();
