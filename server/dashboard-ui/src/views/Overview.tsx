import { useMemo } from "react";
import {
  LiveState,
  FeedEntry,
} from "../lib/useLive";
import { temperaturePoints, numeric, numericSeries } from "../lib/model";
import { Sparkline, TrendChart, RadialGauge } from "../components/charts";
import {
  IconThermometer,
  IconDroplet,
  IconLeaf,
  IconSignal,
  IconFire,
  IconWind,
  IconAlert,
  IconShield,
} from "../components/icons";

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

function StatCard({
  label,
  icon,
  value,
  unit,
  foot,
  spark,
  id,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  unit?: string;
  foot: string;
  spark?: { at: number; value: number }[];
  id: string;
}) {
  return (
    <article className="stat-card rise">
      <span className="stat-label">
        {icon}
        {label}
      </span>
      <span className="stat-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      <span className="stat-foot">{foot}</span>
      {spark && spark.length > 1 && (
        <div className="stat-spark">
          <Sparkline points={spark} id={id} />
        </div>
      )}
    </article>
  );
}

function ProtectionRow({
  icon,
  tone,
  title,
  detail,
  pill,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  detail: string;
  pill: { text: string; severity: string };
}) {
  return (
    <div className="protection-row">
      <div className={`protection-icon ${tone}`}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <span className={`pill ${pill.severity || "neutral"}`}>{pill.text}</span>
    </div>
  );
}

export default function Overview({
  live,
  onNavigate,
}: {
  live: LiveState;
  onNavigate: (hash: string) => void;
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

  // Readiness gauge: share of healthy subsystems reporting in.
  const gauge = useMemo(() => {
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
    bump(numeric(r.mq6Raw) !== null && numeric(r.mq6Raw)! > 0);
    const validated = r.probe?.validated;
    bump(validated === true);
    const value = max === 0 ? 0 : (score / max) * 100;
    const sub =
      max === 0
        ? "waiting for the field unit"
        : `${score} of ${max} subsystems reporting`;
    const severity =
      !fs.fresh ? "warning" : value >= 60 ? "good" : "warning";
    return { value, sub, severity } as const;
  }, [temp, humidity, fs, r]);

  const alert = (() => {
    if (fs.fire[2] === "danger")
      return {
        tone: "danger",
        icon: <IconFire />,
        title: "Fire response state needs attention",
        body: fs.fire[1],
      };
    if (fs.water[2] === "danger")
      return {
        tone: "danger",
        icon: <IconDroplet />,
        title: "Irrigation safety lock is engaged",
        body: fs.water[1],
      };
    if (!fs.fresh && latest)
      return {
        tone: "warning",
        icon: <IconAlert />,
        title: "Field report is stale",
        body: `Last observation arrived ${timeAgo(now - fs.at)}. Local protection limits stay active on the ESP32.`,
      };
    if (fs.usbOnly)
      return {
        tone: "info",
        icon: <IconAlert />,
        title: "Bench build",
        body: "The field unit reports over USB with external hardware disabled; values verify the link, not the greenhouse.",
      };
    const gaps: string[] = [];
    if (temp === null) gaps.push("air climate");
    if (!fs.soilValid) gaps.push("soil moisture");
    if (r.fireSensorEnabled !== true) gaps.push("fire detector");
    if (gaps.length)
      return {
        tone: "warning",
        icon: <IconAlert />,
        title: "Sensor gaps",
        body: `No valid data from ${gaps.join(", ")}. Gaps are shown, never estimated.`,
      };
    return null;
  })();

  return (
    <>
      <header className="page-head rise">
        <p className="eyebrow">
          {new Date(now).toLocaleDateString([], {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1>
          {farm?.name || "Your greenhouse"}{" "}
          <em>
            {fs.fresh
              ? fs.fire[2] === "danger"
                ? "needs you."
                : "is holding steady."
              : "is offline."}
          </em>
        </h1>
        <p className="lede">
          {fs.fresh
            ? "Live field telemetry, bounded local responses, and cloud records — with every gap shown honestly."
            : "The field unit has not reported recently. Its local safety limits keep working without the network."}
        </p>
        <p className="head-meta">
          {latest
            ? `Last field report ${timeAgo(Math.max(0, now - fs.at))} · device ${latest.deviceId}`
            : "Waiting for the first field report"}
        </p>
      </header>

      {farm && !farm.deviceSyncedAt && (
        <div className="setup-nudge rise">
          <span>Greenhouse setup is not finished — the field unit has not acknowledged your profile.</span>
          <button className="btn btn-outline" onClick={() => onNavigate("#setup")}>
            Continue setup
          </button>
        </div>
      )}

      {alert && (
        <div className={`alert-banner ${alert.tone} rise`} role="status">
          {alert.icon}
          <div>
            <strong>{alert.title}</strong>
            {alert.body}
          </div>
        </div>
      )}

      <div className="grid-cards">
        <StatCard
          id="temp"
          label="Air temperature"
          icon={<IconThermometer />}
          value={temp === null ? "—" : temp.toFixed(1)}
          unit="°C"
          foot={
            tempSpark.length > 1
              ? `${tempSpark.length} recent observations`
              : "waiting for readings"
          }
          spark={tempSpark}
        />
        <StatCard
          id="hum"
          label="Humidity"
          icon={<IconWind />}
          value={humidity === null ? "—" : humidity.toFixed(1)}
          unit="% RH"
          foot={
            humSpark.length > 1
              ? `${humSpark.length} recent observations`
              : "waiting for readings"
          }
          spark={humSpark}
        />
        <StatCard
          id="soil"
          label="Soil moisture"
          icon={<IconLeaf />}
          value={fs.soilRaw === null ? "—" : String(fs.soilRaw)}
          unit="ADC"
          foot={
            r.soilSensorEnabled === false
              ? "soil input disabled"
              : fs.soilValid
                ? r.soilDry
                  ? "dry · local policy may water"
                  : "within valid range"
                : "invalid or missing"
          }
          spark={soilSpark}
        />
        <StatCard
          id="link"
          label="Field link"
          icon={<IconSignal />}
          value={
            latest?.wifiRssi !== undefined && Number.isFinite(latest?.wifiRssi)
              ? String(latest.wifiRssi)
              : "—"
          }
          unit="dBm"
          foot={`${latest?.hardwareProfile || "unknown profile"}${live.connected ? " · stream live" : ""}`}
        />
      </div>

      <div className="split">
        <section className="panel rise">
          <div className="panel-title">
            <h2>Air temperature trend</h2>
            <span className="hint">live field observations only</span>
          </div>
          <TrendChart
            points={trend.map((p) => ({
              at: Date.parse(p.receivedAt),
              value: p.readings!.temperatureC!,
            }))}
            unit="°C"
            label="temperature"
          />
        </section>

        <section className="panel rise" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-title">
            <h2>Greenhouse readiness</h2>
            <span className="hint">subsystems reporting</span>
          </div>
          <div style={{ flex: 1, display: "grid", placeContent: "center" }}>
            <RadialGauge
              value={gauge.value}
              label={fs.fresh ? "reporting" : "stale"}
              sub={gauge.sub}
              severity={gauge.severity as "good" | "warning" | "danger"}
            />
          </div>
        </section>
      </div>

      <section className="panel rise">
        <div className="panel-title">
          <h2>Field protection</h2>
          <span className="hint">decisions run on the ESP32, not in the cloud</span>
        </div>
        <ProtectionRow
          icon={<IconFire />}
          tone={fs.fire[2] === "good" ? "good" : fs.fire[2] === "danger" ? "danger" : "warning"}
          title="Fire response"
          detail={fs.fire[1]}
          pill={{ text: fs.fire[0], severity: fs.fire[2] }}
        />
        <ProtectionRow
          icon={<IconDroplet />}
          tone={fs.water[2] === "good" ? "good" : fs.water[2] === "danger" ? "danger" : "warning"}
          title="Irrigation"
          detail={fs.water[1]}
          pill={{ text: fs.water[0], severity: fs.water[2] }}
        />
        <ProtectionRow
          icon={<IconShield />}
          tone={
            numeric(r.mq6Raw) === null
              ? "neutral"
              : numeric(r.mq6Raw)! > 1500
                ? "warning"
                : "good"
          }
          title="Atmosphere · MQ-6"
          detail={
            mq6 === null
              ? "No gas reading; both MQ-6 inputs must be divided to 3.3 V."
              : `Raw signal ${mq6} (uncalibrated, not a gas concentration).`
          }
          pill={{
            text: mq6 === null ? "No data" : mq6 > 1500 ? "Elevated" : "Nominal",
            severity: mq6 === null ? "neutral" : mq6 > 1500 ? "warning" : "good",
          }}
        />
      </section>

      {live.feed.length > 0 && (
        <section className="panel rise">
          <div className="panel-title">
            <h2>Latest field activity</h2>
            <button className="ghost-btn" onClick={() => onNavigate("#activity")}>
              Open activity
            </button>
          </div>
          <div className="feed">
            {live.feed.slice(0, 5).map((entry: FeedEntry, i: number) => (
              <div className="feed-item" key={`${entry.at}-${i}`}>
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
        </section>
      )}
    </>
  );
}
