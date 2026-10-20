export const REPORT_WAIT_MS = 12 * 60 * 60 * 1000;

const number = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function statistics(feeds, field) {
  const values = feeds.map((entry) => number(entry[field])).filter((value) => value !== null);
  if (!values.length) return { count: 0, average: null, minimum: null, maximum: null };
  return {
    count: values.length,
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function flagged(feeds, field) {
  return feeds.filter((entry) => number(entry[field]) === 1).length;
}

export function reportEligibility(farm, now = Date.now()) {
  const setupAt = Date.parse(farm?.commissionedAt || "");
  if (!farm || !farm.deviceSyncedAt || !Number.isFinite(setupAt) || setupAt > now)
    return { eligible: false, eligibleAt: null, remainingMs: null };
  const eligibleAt = new Date(setupAt + REPORT_WAIT_MS).toISOString();
  return { eligible: now >= setupAt + REPORT_WAIT_MS,
    eligibleAt, remainingMs: Math.max(0, setupAt + REPORT_WAIT_MS - now) };
}

export function buildFarmReport(farm, soilFeed, climateFeed, now = Date.now()) {
  if (!reportEligibility(farm, now).eligible) throw new Error("Farm is not yet 12 hours old");
  const since = now - REPORT_WAIT_MS;
  const withinWindow = (feed) => (Array.isArray(feed?.feeds) ? feed.feeds : [])
    .filter((entry) => {
      const at = Date.parse(entry.created_at);
      return Number.isFinite(at) && at >= since && at <= now;
    });
  const soil = withinWindow(soilFeed);
  const climate = withinWindow(climateFeed);
  return {
    farm: { name: farm.name, farmerName: farm.farmerName, crop: farm.crop || null,
      setupAt: farm.setupAt },
    period: { from: new Date(since).toISOString(), to: new Date(now).toISOString() },
    source: "Private ThingSpeak channel records",
    sampleCount: { soil: soil.length, climate: climate.length },
    air: { temperatureC: statistics(climate, "field1"),
      humidityPercent: statistics(climate, "field2") },
    soil: { moistureAdc: statistics(soil, "field6"), drySamples: flagged(soil, "field8") },
    protection: { fireDetectedSamples: flagged(climate, "field5"),
      irrigationCommandedSamples: flagged(climate, "field6"),
      firePumpCommandedSamples: flagged(climate, "field7") },
    researchNote: "Soil moisture is a raw ADC reading. pH, EC, NPK and MQ-6 require validation before agronomic or safety claims. Pump commands do not prove water flow.",
  };
}
