// ThingSpeak is an external history store, not the controller. Failed writes
// never block ingestion or local pump decisions; the newest snapshot wins.
const PUBLISH_INTERVAL_MS = 60_000;
const READ_CACHE_MS = 15_000;
const REQUEST_TIMEOUT_MS = 5_000;

const numeric = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const flag = (value) => (value === true ? 1 : value === false ? 0 : null);

function fields(values) {
  return Object.fromEntries(
    values.flatMap((value, index) =>
      value === null || value === undefined ? [] : [[`field${index + 1}`, value]],
    ),
  );
}

export function toThingSpeakEntries(telemetry) {
  const readings = telemetry.readings || {};
  const outputs = telemetry.outputs || {};
  const probe = readings.probe || {};
  const raw = probe.raw || {};
  const soilValid = readings.soilSensorEnabled === true && readings.soilValid === true;
  const faults = {
    deviceId: telemetry.deviceId,
    event: outputs.lastEvent || null,
    fireLockout: outputs.fireLockout === true,
    irrigationFault: outputs.irrigationLockout === true || outputs.waterFault === true,
    probeValidated: false,
  };
  return {
    soil: {
      ...fields([
        numeric(raw.ph), numeric(raw.ec), numeric(raw.nitrogen),
        numeric(raw.phosphorus), numeric(raw.potassium),
        soilValid ? numeric(readings.soilRaw) : null,
        numeric(probe.validCount), soilValid ? flag(readings.soilDry) : null,
      ]),
      status: JSON.stringify({ deviceId: telemetry.deviceId, rawRegisterValues: true }),
    },
    environment: {
      ...fields([
        numeric(readings.temperatureC), numeric(readings.humidityPercent),
        numeric(readings.mq6Raw), numeric(readings.mq6Digital),
        flag(readings.fireDetected), flag(outputs.irrigation),
        flag(outputs.fireResponse), flag(outputs.controllerReady),
      ]),
      status: JSON.stringify(faults),
    },
  };
}

function latest(feed) {
  const entries = Array.isArray(feed?.feeds) ? feed.feeds : [];
  return entries.at(-1) || null;
}

function readNumber(entry, field) {
  const value = entry?.[field];
  return value === null || value === undefined || value === ""
    ? null : numeric(Number(value));
}

export function fromThingSpeakFeeds(soilFeed, environmentFeed, fallback = null) {
  const soil = latest(soilFeed);
  const environment = latest(environmentFeed);
  if (!soil && !environment) return null;
  const status = (() => {
    try { return JSON.parse(environment?.status || "{}"); }
    catch { return {}; }
  })();
  const raw = {
    ph: readNumber(soil, "field1"), ec: readNumber(soil, "field2"),
    nitrogen: readNumber(soil, "field3"),
    phosphorus: readNumber(soil, "field4"), potassium: readNumber(soil, "field5"),
  };
  const soilRaw = readNumber(soil, "field6");
  const fire = readNumber(environment, "field5");
  const irrigation = readNumber(environment, "field6");
  const firePump = readNumber(environment, "field7");
  const ready = readNumber(environment, "field8");
  return {
    deviceId: status.deviceId || fallback?.deviceId || null,
    mode: "hardware",
    source: "thingspeak",
    receivedAt: environment?.created_at || soil?.created_at || null,
    // Wi-Fi RSSI belongs to a local device heartbeat, not this cloud entry.
    // Do not blend values from different timestamps into one recorded sample.
    wifiRssi: null,
    readings: {
      temperatureC: readNumber(environment, "field1"),
      humidityPercent: readNumber(environment, "field2"),
      mq6Raw: readNumber(environment, "field3"),
      mq6Digital: readNumber(environment, "field4"),
      fireDetected: fire === null ? null : fire === 1,
      fireSensorEnabled: fire !== null,
      soilRaw, soilSensorEnabled: soilRaw !== null,
      soilDry: readNumber(soil, "field8") === null
        ? null : readNumber(soil, "field8") === 1,
      probe: { raw, validCount: readNumber(soil, "field7"), validated: false },
    },
    outputs: {
      irrigation: irrigation === 1,
      fireResponse: firePump === 1,
      controllerReady: ready === 1,
      fireLockout: status.fireLockout === true,
      irrigationLockout: status.irrigationFault === true,
      lastEvent: status.event || null,
    },
  };
}

export function createThingSpeakBridge(config, fetchImpl = fetch) {
  const channels = [config.soil, config.environment];
  const configured = channels.every((channel) =>
    Number.isSafeInteger(Number(channel.id)) && Number(channel.id) > 0 &&
    channel.writeKey && channel.readKey,
  );
  const baseUrl = config.baseUrl || "https://api.thingspeak.com";
  let pending = null;
  let publishing = false;
  let lastAttemptAt = 0;
  let cached = null;
  let cacheAt = 0;

  async function writeChannel(channel, values) {
    const response = await fetchImpl(`${baseUrl}/update.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", THINGSPEAKAPIKEY: channel.writeKey },
      body: JSON.stringify(values),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`ThingSpeak write HTTP ${response.status}`);
    const result = await response.json();
    if (!Number.isSafeInteger(Number(result?.entry_id)) || Number(result.entry_id) < 1)
      throw new Error("ThingSpeak rejected the channel update");
  }

  async function publishPending(now = Date.now()) {
    if (!configured || !pending || publishing || now - lastAttemptAt < PUBLISH_INTERVAL_MS)
      return false;
    publishing = true;
    lastAttemptAt = now;
    const snapshot = pending;
    const entries = toThingSpeakEntries(snapshot);
    try {
      await Promise.all([
        writeChannel(config.soil, entries.soil),
        writeChannel(config.environment, entries.environment),
      ]);
      if (pending === snapshot) pending = null;
      cached = null;
      return true;
    } finally {
      publishing = false;
    }
  }

  async function readLatest(fallback = null, now = Date.now()) {
    if (!configured) return null;
    if (cached && now - cacheAt < READ_CACHE_MS) return cached;
    const read = async (channel) => {
      const url = new URL(`${baseUrl}/channels/${channel.id}/feeds.json`);
      url.searchParams.set("api_key", channel.readKey);
      url.searchParams.set("results", "1");
      url.searchParams.set("status", "true");
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`ThingSpeak read HTTP ${response.status}`);
      return response.json();
    };
    const [soil, environment] = await Promise.all(channels.map(read));
    cached = fromThingSpeakFeeds(soil, environment, fallback);
    cacheAt = now;
    return cached;
  }

  async function readRange(from, to) {
    if (!configured) throw new Error("ThingSpeak is not configured");
    const read = async (channel) => {
      const url = new URL(`${baseUrl}/channels/${channel.id}/feeds.json`);
      url.searchParams.set("api_key", channel.readKey);
      url.searchParams.set("start", new Date(from).toISOString().slice(0, 19).replace("T", " "));
      url.searchParams.set("end", new Date(to).toISOString().slice(0, 19).replace("T", " "));
      url.searchParams.set("results", "8000");
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`ThingSpeak history HTTP ${response.status}`);
      return response.json();
    };
    const [soil, environment] = await Promise.all(channels.map(read));
    return { soil, environment };
  }

  return {
    configured,
    enqueue(snapshot) { if (configured) pending = snapshot; },
    publishPending,
    readLatest,
    readRange,
    get pending() { return pending !== null; },
  };
}
