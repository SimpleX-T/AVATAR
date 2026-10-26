// Exact port of server/public/field-model.js — no zero-by-coercion,
// invented observations, or generic online flag.

export const FRESHNESS_MS = 150_000;

export type Theme = "dark" | "light";

export interface ProbeRaw {
  ph?: number;
  ec?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
}
export interface Probe {
  raw?: ProbeRaw;
  validCount?: number;
  validated?: boolean;
}
export interface Readings {
  temperatureC?: number;
  humidityPercent?: number;
  soilRaw?: number;
  soilValid?: boolean;
  soilSensorEnabled?: boolean;
  soilDry?: boolean;
  fireDetected?: boolean;
  fireSensorEnabled?: boolean;
  fireSensorReady?: boolean;
  mq6Raw?: number;
  mq6Digital?: number;
  manualPumpTest?: "fire" | "hydration" | "none";
  manualPumpRemainingMs?: number;
  manualPumpCooldownMs?: number;
  probe?: Probe;
}
export interface Outputs {
  irrigation?: boolean;
  fireResponse?: boolean;
  fireLockout?: boolean;
  waterFault?: boolean;
  irrigationLockout?: boolean;
  waterSoaking?: boolean;
  controllerReady?: boolean;
  lastEvent?: string;
}
export interface Telemetry {
  deviceId: string;
  mode: string;
  hardwareProfile: string;
  wifiRssi?: number;
  receivedAt: string;
  readings?: Readings;
  outputs?: Outputs;
}
export interface HistoryPoint {
  receivedAt: string;
  readings?: Readings;
  outputs?: Outputs;
}

export interface Farm {
  name: string;
  farmerName?: string;
  crop?: string;
  deviceId: string;
  revision?: string;
  deviceSyncedAt?: string | null;
  commissionedAt?: string | null;
}
export interface ReportEligibility {
  [k: string]: unknown;
}

export function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type Severity = "good" | "warning" | "danger" | "";
export type StatusTriple = [state: string, detail: string, severity: Severity];

export interface FieldState {
  fresh: boolean;
  hardware: boolean;
  usbOnly: boolean;
  at: number;
  age: number;
  readings: Readings;
  outputs: Outputs;
  soilValid: boolean;
  soilRaw: number | null;
  fire: StatusTriple;
  water: StatusTriple;
  canCommand: boolean;
}

export function fieldState(
  telemetry: Telemetry | null,
  now: number = Date.now(),
): FieldState {
  const usbOnly = telemetry?.hardwareProfile === "usb-only";
  const r: Readings = usbOnly ? {} : telemetry?.readings || {};
  const o: Outputs = usbOnly ? {} : telemetry?.outputs || {};
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
  let fire: StatusTriple;
  if (!fresh)
    fire = [
      "Can't tell yet",
      "This reading is out of date — the unit hasn't checked in recently.",
      "warning",
    ];
  else if (!fireKnown)
    fire = [
      "Nothing on the detector",
      r.fireSensorEnabled === false
        ? "The fire input is switched off in this build."
        : "The detector isn't talking right now.",
      "warning",
    ];
  else if (r.fireDetected)
    fire = [
      "Flame picked up",
      "Get to the greenhouse — the response is already on it.",
      "danger",
    ];
  else if (r.fireSensorReady !== true)
    fire = [
      "Warming up",
      "The detector hasn't settled on a clear sky yet, so it's holding off.",
      "warning",
    ];
  else if (o.fireLockout)
    fire = [
      "Paused for safety",
      "It hit its response limit. Give things a look before rearming.",
      "danger",
    ];
  else if (o.fireResponse)
    fire = ["Spraying now", "The fire pump is running its bounded burst.", "warning"];
  else
    fire = ["All clear", "Nothing burning — the detector is watching calmly.", "good"];

  let water: StatusTriple;
  if (!fresh)
    water = [
      "Can't tell yet",
      "This reading is out of date — the unit hasn't checked in recently.",
      "warning",
    ];
  else if (o.irrigationLockout || o.waterFault)
    water = [
      "Paused for safety",
      "Something looked off with the water path. Check the probe and the plumbing.",
      "danger",
    ];
  else if (!soilValid)
    water = [
      "No soil signal",
      "The moisture probe isn't part of the story yet.",
      "warning",
    ];
  else if (o.irrigation)
    water = ["Watering", "The pump is giving the bed a drink right now.", "good"];
  else if (o.waterSoaking)
    water = ["Letting it soak", "Watering's done — waiting for the soil to tell the truth.", "good"];
  else
    water = [
      r.soilDry === true ? "Soil's thirsty" : "Riding idle",
      r.soilDry === true
        ? "It's dry out there; the unit will act on its own schedule."
        : "The pump is off and the soil feels fine.",
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

export interface ActivationState {
  receiving: boolean;
  profileSaved: boolean;
  matching: boolean;
  ready: boolean;
}

export function activationState(
  farm: Farm | null,
  telemetry: Telemetry | null,
  now: number = Date.now(),
): ActivationState {
  const state = fieldState(telemetry, now);
  const matching = Boolean(
    farm && telemetry && farm.deviceId === telemetry.deviceId,
  );
  return {
    receiving: state.fresh && state.hardware,
    profileSaved: Boolean(farm?.deviceSyncedAt),
    matching,
    ready: state.fresh && state.hardware && matching && Boolean(farm?.deviceSyncedAt),
  };
}

export function temperaturePoints(history: HistoryPoint[]): HistoryPoint[] {
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

export function numericSeries(
  history: HistoryPoint[],
  pick: (r: Readings) => number | null | undefined,
  cap = 40,
): { at: number; value: number }[] {
  return history
    .map((t) => ({ at: Date.parse(t.receivedAt), value: pick(t.readings || {}) }))
    .filter(
      (p) =>
        Number.isFinite(p.at) &&
        typeof p.value === "number" &&
        Number.isFinite(p.value),
    )
    .sort((a, b) => a.at - b.at)
    .filter((p, i, a) => i === 0 || p.at !== a[i - 1].at)
    .slice(-cap) as { at: number; value: number }[];
}
