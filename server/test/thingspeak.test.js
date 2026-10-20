import assert from "node:assert/strict";
import test from "node:test";
import {
  createThingSpeakBridge,
  fromThingSpeakFeeds,
  toThingSpeakEntries,
} from "../src/thingspeak.js";

const sample = {
  deviceId: "head-001",
  readings: {
    soilRaw: 3210, soilDry: true, temperatureC: 29.5,
    humidityPercent: 81, mq6Raw: 154, mq6Digital: 1,
    fireDetected: false,
    probe: { raw: { ph: 64, ec: 11, nitrogen: 0, phosphorus: 0, potassium: 1 }, validCount: 5 },
  },
  outputs: {
    irrigation: true, fireResponse: false, controllerReady: true,
    fireLockout: false, waterFault: false, lastEvent: "WATER_START",
  },
};

test("maps only measured/raw values into the two eight-field channels", () => {
  const entries = toThingSpeakEntries(sample);
  assert.equal(entries.soil.field1, 64);
  assert.equal(entries.soil.field6, 3210);
  assert.equal(entries.soil.field8, 1);
  assert.equal(entries.environment.field3, 154);
  assert.equal(entries.environment.field6, 1);
  assert.equal(Object.keys(entries.soil).length, 9); // 8 fields + status.
  assert.equal(toThingSpeakEntries({ ...sample, readings: { ...sample.readings, temperatureC: null } }).environment.field1, undefined);
});

test("round-trips channel data without inventing calibrated NPK units", () => {
  const entries = toThingSpeakEntries(sample);
  const asFeed = (entry) => ({ feeds: [{ ...entry, created_at: "2026-10-14T10:00:00Z" }] });
  const result = fromThingSpeakFeeds(asFeed(entries.soil), asFeed(entries.environment));
  assert.equal(result.source, "thingspeak");
  assert.equal(result.readings.probe.raw.ph, 64);
  assert.equal(result.readings.probe.validated, false);
  assert.equal(result.readings.soilDry, true);
  assert.equal(result.outputs.irrigation, true);
});

test("rejects a ThingSpeak 200 response with entry_id zero and keeps latest pending", async () => {
  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return { ok: true, json: async () => ({ entry_id: 0 }) };
  };
  const bridge = createThingSpeakBridge({
    baseUrl: "https://example.invalid",
    soil: { id: 1, readKey: "read1", writeKey: "write1" },
    environment: { id: 2, readKey: "read2", writeKey: "write2" },
  }, fakeFetch);
  bridge.enqueue(sample);
  await assert.rejects(bridge.publishPending(Date.now()), /rejected/);
  assert.equal(bridge.pending, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.THINGSPEAKAPIKEY, "write1");
});

test("reads both private channels server-side with status and never returns keys", async () => {
  const entries = toThingSpeakEntries(sample);
  const urls = [];
  const fakeFetch = async (url) => {
    urls.push(new URL(url));
    const entry = String(url).includes("/channels/1/")
      ? entries.soil : entries.environment;
    return {
      ok: true,
      json: async () => ({ feeds: [{ ...entry, created_at: "2026-10-14T10:00:00Z" }] }),
    };
  };
  const bridge = createThingSpeakBridge({
    baseUrl: "https://example.invalid",
    soil: { id: 1, readKey: "private-soil", writeKey: "write1" },
    environment: { id: 2, readKey: "private-env", writeKey: "write2" },
  }, fakeFetch);
  const result = await bridge.readLatest();
  assert.equal(result.deviceId, "head-001");
  assert.equal(result.outputs.lastEvent, "WATER_START");
  assert.equal(JSON.stringify(result).includes("private-soil"), false);
  assert.equal(urls.length, 2);
  assert.equal(urls[0].searchParams.get("status"), "true");
});

test("reads the bounded report window from both private channels", async () => {
  const urls = [];
  const fakeFetch = async (url) => {
    urls.push(new URL(url));
    return { ok: true, json: async () => ({ feeds: [] }) };
  };
  const bridge = createThingSpeakBridge({
    baseUrl: "https://example.invalid",
    soil: { id: 1, readKey: "private-soil", writeKey: "write1" },
    environment: { id: 2, readKey: "private-env", writeKey: "write2" },
  }, fakeFetch);
  const result = await bridge.readRange("2026-10-18T00:00:00Z", "2026-10-18T12:00:00Z");
  assert.deepEqual(result.soil.feeds, []);
  assert.equal(urls.length, 2);
  assert.equal(urls[0].searchParams.get("start"), "2026-10-18 00:00:00");
  assert.equal(urls[0].searchParams.get("results"), "8000");
  assert.equal(urls[0].searchParams.get("api_key"), "private-soil");
  assert.equal(JSON.stringify(result).includes("private-soil"), false);
});
