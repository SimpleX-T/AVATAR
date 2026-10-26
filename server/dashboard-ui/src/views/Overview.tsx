import { useMemo } from "react";
import { LiveState } from "../lib/useLive";
import {
  temperaturePoints,
  numeric,
  numericSeries,
} from "../lib/model";
import { Sparkline, TrendChart, RadialGauge } from "../components/charts";
import {
  IconThermometer,
  IconDroplet,
  IconLeaf,
  IconFire,
  IconWind,
  IconAlert,
  IconShield,
} from "../components/icons";

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}min` : `${Math.round(m / 60)}h`;
}

function BigNum({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "warn" | "alert";
}) {
  return (
    <div className="bignum">
      <span className="label">{label}</span>
      <span className={`value ${tone || ""}`}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}

export default function Overview({
  live,
  onNavigate,
}: {
  live: LiveState;
  onNavigate: (v: "readings" | "setup" | "activity") => void;
}) {
  const { fs, latest, farm, history, now } = live;
  const r = fs.readings;
  const temp = numeric(r.temperatureC);
  const humidity = numeric(r.humidityPercent);
  const mq6 = numeric(r.mq6Raw);

  const tempSpark = useMemo(
    () => numericSeries(history, (readings) => numeric(readings.temperatureC)),
    [history],
  );
  const humSpark = useMemo(
    () => numericSeries(history, (readings) => numeric(readings.humidityPercent)),
    [history],
  );
  const soilSpark = useMemo(
    () => numericSeries(history, (readings) => numeric(readings.soilRaw)),
    [history],
  );
  const trend = useMemo(() => temperaturePoints(history), [history]);

  // Readiness dial: subsystems reporting, never faked.
  const dial = useMemo(() => {
    let score = 0;
    let max = 0;
    const bump = (ok: boolean) => {
      max += 1;
      if (ok) score += 1;
    };
    bump(temp !== null);
    bump(humidity !== null);
    bump(fs.soilValid);
    bump(r.fireSensorEnabled === true && r.fireSensorReady === true);
    bump(mq6 !== null && mq6 > 0);
    bump(r.probe?.validated === true);
    const value = max === 0 ? 0 : (score / max) * 100;
    return {
      value,
      sub: `${score} of ${max} subsystems reporting`,
      severity: (!fs.fresh || value < 60 ? "warning" : "good") as
        | "warning"
        | "good",
    };
  }, [temp, humidity, fs, r, mq6]);

  const headline = !latest
    ? ["Waiting for the", "first report."]
    : !fs.fresh
      ? ["The field is", "quiet."]
      : fs.fire[2] === "danger"
        ? ["The field", "needs you."]
        : ["Good growing", "keeps going."];

  const alert = (() => {
    if (fs.fire[2] === "danger")
      return {
        tone: "danger" as const,
        icon: <IconFire />,
        title: "Fire state demands attention",
        body: fs.fire[1],
      };
    if (fs.water[2] === "danger")
      return {
        tone: "danger" as const,
        icon: <IconDroplet />,
        title: "Irrigation safety lock engaged",
        body: fs.water[1],
      };
    if (!fs.fresh && latest)
      return {
        tone: "warning" as const,
        icon: <IconAlert />,
        title: "Field report is stale",
        body: `Last observation arrived ${ago(now - fs.at)} ago. Local protection limits stay active on the ESP32.`,
      };
    const gaps: string[] = [];
    if (temp === null) gaps.push("air climate");
    if (!fs.soilValid) gaps.push("soil moisture");
    if (r.fireSensorEnabled !== true) gaps.push("fire detector");
    if (gaps.length)
      return {
        tone: "warning" as const,
        icon: <IconAlert />,
        title: "Sensor gaps",
        body: `No valid data from ${gaps.join(", ")} — shown as gaps, never estimated.`,
      };
    return null;
  })();

  const breaker = (
    title: string,
    triple: [string, string, string],
    icon: React.ReactNode,
  ) => {
    const tone =
      triple[2] === "danger"
        ? "danger"
        : triple[2] === "warning"
          ? "warning"
          : triple[2] === "good"
            ? "good"
            : "neutral";
    const fill =
      triple[0] === "Monitoring" || triple[0] === "Standby"
        ? 18
        : triple[0] === "Watering" || triple[0] === "Active"
          ? 86
          : triple[0] === "Soaking"
            ? 55
            : 40;
    return (
      <div className={`breaker tone-${tone}`}>
        <div className="breaker-top">
          <span className="breaker-title">{title}</span>
          <span className={`badge ${tone}`}>{triple[0]}</span>
        </div>
        <div className="state-bar">
          <div className="fill" style={{ width: `${fill}%` }} />
        </div>
        <p>{triple[1]}</p>
        <div style={{ marginTop: 12, color: "var(--ink-3)" }}>{icon}</div>
      </div>
    );
  };

  return (
    <>
      <p className="kicker">
        {new Date(now).toLocaleDateString([], {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        {farm?.name ? ` — ${farm.name}` : ""}
      </p>
      <h1 className="headline">
        {headline[0]}
        <br />
        <em>{headline[1]}</em>
      </h1>
      <p className="sub">
        {fs.fresh
          ? "Live telemetry from the field unit, bounded local responses on the ESP32, and a cloud record you can trust — every gap shown, nothing invented."
          : "The field unit has not reported recently. Its safety limits keep working without the network; this page resumes the moment it checks in."}
      </p>
      <p className="meta-line">
        {latest
          ? `LAST REPORT ${ago(Math.max(0, now - fs.at))} AGO · DEVICE ${latest.deviceId} · ${fs.usbOnly ? "BENCH BUILD" : latest.hardwareProfile?.toUpperCase()}`
          : "AWAITING FIRST FIELD REPORT"}
      </p>

      {farm && !farm.deviceSyncedAt && (
        <div className="notice warning" role="status">
          <IconAlert />
          <div>
            <strong>Setup is not finished</strong>
            The field unit has not acknowledged your greenhouse profile yet.
            <button
              className="cta cta-line"
              style={{ marginLeft: 14, padding: "8px 18px", fontSize: 13 }}
              onClick={() => onNavigate("setup")}
            >
              Continue setup
            </button>
          </div>
        </div>
      )}

      {alert && (
        <div className={`notice ${alert.tone}`} role="status">
          {alert.icon}
          <div>
            <strong>{alert.title}</strong>
            {alert.body}
          </div>
        </div>
      )}

      <div className="hero">
        <div className="dial-wrap">
          <RadialGauge
            value={dial.value}
            label={fs.fresh ? "reporting" : "stale"}
            sub={dial.sub}
            severity={dial.severity}
            size={300}
          />
        </div>

        <div className="bignum-stack">
          <BigNum
            label="Air temperature"
            value={temp === null ? "——" : temp.toFixed(1)}
            unit="°C"
          />
          <BigNum
            label="Humidity"
            value={humidity === null ? "——" : humidity.toFixed(1)}
            unit="% RH"
          />
          <BigNum
            label="Soil moisture"
            value={fs.soilRaw === null ? "——" : String(fs.soilRaw)}
            unit="ADC"
            tone={
              fs.soilValid ? (r.soilDry ? "warn" : undefined) : "alert"
            }
          />
          <BigNum
            label="Field link"
            value={
              Number.isFinite(latest?.wifiRssi) ? String(latest!.wifiRssi) : "——"
            }
            unit="dBm"
          />
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>
            <span className="index">01</span>Air temperature
          </h2>
          <span className="hint">
            {tempSpark.length > 1
              ? `${tempSpark.length} recent observations`
              : "collecting observations"}
          </span>
        </div>
        <div className="panel chart-frame">
          <TrendChart
            points={trend.map((p) => ({
              at: Date.parse(p.receivedAt),
              value: p.readings!.temperatureC!,
            }))}
            unit="°C"
            label="temperature"
          />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>
            <span className="index">02</span>Protection
          </h2>
          <span className="hint">
            decisions run on the ESP32 — the cloud never holds the keys
          </span>
        </div>
        <div className="breakers">
          {breaker("Fire response", fs.fire, <IconFire size={16} />)}
          {breaker("Irrigation", fs.water, <IconDroplet size={16} />)}
          {breaker(
            "Atmosphere · MQ-6",
            [
              mq6 === null
                ? "No data"
                : mq6 > 1500
                  ? "Elevated"
                  : "Nominal",
              mq6 === null
                ? "No gas reading. Both MQ-6 inputs must be divided to 3.3 V before connection."
                : `Raw signal ${mq6} — an uncalibrated signal, not a gas concentration.`,
              mq6 === null ? "neutral" : mq6 > 1500 ? "warning" : "good",
            ],
            <IconWind size={16} />,
          )}
        </div>
      </section>

      {live.feed.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>
              <span className="index">03</span>Latest activity
            </h2>
            <button className="link-btn" onClick={() => onNavigate("activity")}>
              Open the full log →
            </button>
          </div>
          <div className="panel">
            <div className="feed">
              {live.feed.slice(0, 5).map((entry, i) => (
                <div className="feed-line" key={`${entry.at}-${i}`}>
                  <time>
                    {new Date(entry.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>
            <span className="index">04</span>Signals
          </h2>
          <span className="hint">recent micro-trends</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div className="panel" style={{ padding: "18px 0 0" }}>
            <p className="quiet" style={{ padding: "0 20px", margin: "0 0 8px", fontWeight: 600 }}>
              Temperature <IconThermometer size={13} />
            </p>
            <Sparkline points={tempSpark} id="big-temp" />
          </div>
          <div className="panel" style={{ padding: "18px 0 0" }}>
            <p className="quiet" style={{ padding: "0 20px", margin: "0 0 8px", fontWeight: 600 }}>
              Humidity <IconWind size={13} />
            </p>
            <Sparkline points={humSpark} id="big-hum" />
          </div>
          <div className="panel" style={{ padding: "18px 0 0" }}>
            <p className="quiet" style={{ padding: "0 20px", margin: "0 0 8px", fontWeight: 600 }}>
              Soil moisture <IconLeaf size={13} />
            </p>
            <Sparkline points={soilSpark} id="big-soil" />
          </div>
          <div className="panel" style={{ padding: "18px 0 0" }}>
            <p className="quiet" style={{ padding: "0 20px", margin: "0 0 8px", fontWeight: 600 }}>
              <IconShield size={13} /> Protection
            </p>
            <p className="quiet" style={{ padding: "0 20px 18px", margin: 0 }}>
              Fire {fs.fire[0].toLowerCase()} · water {fs.water[0].toLowerCase()}.
              All limits enforced locally on the field unit.
            </p>
          </div>
        </div>
      </section>

      <div style={{ marginTop: 48, textAlign: "center" }}>
        <button className="cta cta-line" onClick={() => onNavigate("readings")}>
          Open the sensor ledger →
        </button>
      </div>
    </>
  );
}
