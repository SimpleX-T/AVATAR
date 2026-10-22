// Shared interpretation: no zero-by-coercion, invented observations or generic online flag.
export const FRESHNESS_MS = 150_000;
export function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function fieldState(telemetry, now = Date.now()) {
  const usbOnly = telemetry?.hardwareProfile === "usb-only";
  const r = usbOnly ? {} : telemetry?.readings || {},
    o = usbOnly ? {} : telemetry?.outputs || {};
  const at = Date.parse(telemetry?.receivedAt || "");
  const age = now - at;
  const fresh = Number.isFinite(age) && age >= -5000 && age <= FRESHNESS_MS;
  const hardware = telemetry?.mode === "hardware";
  const soilRaw = numeric(r.soilRaw);
  const soilValid =
    r.soilSensorEnabled !== false &&
    r.soilValid !== false &&
    soilRaw !== null &&
    soilRaw > 0 &&
    soilRaw < 4095;
  const fireKnown =
    r.fireSensorEnabled === true && typeof r.fireDetected === "boolean";
  const fire = !fresh
    ? ["Unknown", "Last report is not current", "warning"]
    : !fireKnown
      ? [
          "No reading",
          r.fireSensorEnabled === false
            ? "Fire input is disabled"
            : "Detector state is unavailable",
          "warning",
        ]
      : r.fireDetected
        ? ["Detected", "Check the greenhouse now", "danger"]
        : r.fireSensorReady !== true
          ? [
              "Initialising",
              "Detector has not confirmed a stable idle state; response is not armed",
              "warning",
            ]
          : o.fireLockout
            ? ["Locked", "Response limit reached; inspect the system", "danger"]
            : o.fireResponse
              ? ["Active", "Fire pump commanded on", "warning"]
              : ["Monitoring", "No fire reported by the detector", "good"];
  const water = !fresh
    ? ["Unknown", "Last report is not current", "warning"]
    : o.irrigationLockout || o.waterFault
      ? ["Locked", "Inspect the water path and soil sensor", "danger"]
      : !soilValid
        ? ["No reading", "Soil input is missing or invalid", "warning"]
        : o.irrigation
          ? ["Watering", "Irrigation pump commanded on", "good"]
          : o.waterSoaking
            ? ["Soaking", "Waiting before the next soil check", "good"]
            : [
                "Standby",
                r.soilDry === true
                  ? "Dry soil reported; local policy decides watering"
                  : "Pump is commanded off",
                "",
              ];
  return {
    fresh,
    hardware,
    usbOnly,
    at,
    age,
    readings: r,
    outputs: o,
    soilValid,
    soilRaw: soilValid ? soilRaw : null,
    fire,
    water,
    canCommand:
      fresh &&
      hardware &&
      typeof telemetry?.deviceId === "string" &&
      telemetry.deviceId.length > 0,
  };
}
export function activationState(farm, telemetry, now = Date.now()) {
  const state = fieldState(telemetry, now);
  const matching = Boolean(
    farm && telemetry && farm.deviceId === telemetry.deviceId,
  );
  return {
    receiving: state.fresh && state.hardware,
    profileSaved: Boolean(farm?.deviceSyncedAt),
    matching,
    ready:
      state.fresh &&
      state.hardware &&
      matching &&
      Boolean(farm?.deviceSyncedAt),
  };
}
export function temperaturePoints(history) {
  return history
    .filter(
      (t) =>
        numeric(t.readings?.temperatureC) !== null &&
        Number.isFinite(Date.parse(t.receivedAt)),
    )
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))
    .filter((t, i, a) => i === 0 || t.receivedAt !== a[i - 1].receivedAt)
    .slice(-40);
}
