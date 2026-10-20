import test from "node:test";
import assert from "node:assert/strict";
import { buildFarmReport, reportEligibility, REPORT_WAIT_MS } from "../src/report.js";

const now = Date.parse("2026-10-18T18:00:00.000Z");
const farm = { name: "South House", farmerName: "Ada", crop: "Tomato",
  setupAt: new Date(now - REPORT_WAIT_MS).toISOString(),
  commissionedAt: new Date(now - REPORT_WAIT_MS).toISOString(),
  deviceSyncedAt: new Date(now - REPORT_WAIT_MS).toISOString() };

test("report unlocks only after 12 hours from recorded setup", () => {
  const justStarted = { ...farm, commissionedAt: new Date(now - REPORT_WAIT_MS + 1).toISOString() };
  assert.equal(reportEligibility(justStarted, now).eligible, false);
  assert.equal(reportEligibility(justStarted, now).remainingMs, 1);
  assert.equal(reportEligibility(farm, now).eligible, true);
  assert.equal(reportEligibility(null, now).eligible, false);
  assert.equal(reportEligibility({ ...farm, deviceSyncedAt: null }, now).eligible, false);
  assert.throws(() => buildFarmReport(justStarted, {}, {}, now), /12 hours/);
});

test("report uses only actual in-window records and leaves missing values missing", () => {
  const entry = (minutesAgo, fields) => ({
    created_at: new Date(now - minutesAgo * 60_000).toISOString(), ...fields,
  });
  const soil = { feeds: [entry(60, { field6: "3120", field8: "1" }),
    entry(120, { field6: "2300", field8: "0" }),
    entry(800, { field6: "9999", field8: "1" })] };
  const climate = { feeds: [entry(60, { field1: "28", field2: "72", field5: "1", field6: "0" }),
    entry(120, { field1: "30", field2: "", field5: "0", field6: "1" })] };
  const report = buildFarmReport(farm, soil, climate, now);
  assert.deepEqual(report.sampleCount, { soil: 2, climate: 2 });
  assert.equal(report.air.temperatureC.average, 29);
  assert.equal(report.air.humidityPercent.count, 1);
  assert.equal(report.soil.moistureAdc.average, 2710);
  assert.equal(report.soil.drySamples, 1);
  assert.equal(report.protection.fireDetectedSamples, 1);
  assert.equal(report.protection.irrigationCommandedSamples, 1);
  assert.equal(report.protection.firePumpCommandedSamples, 0);
});
