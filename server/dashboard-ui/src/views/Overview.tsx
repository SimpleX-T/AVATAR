import { useMemo } from "react";
import { LiveState } from "../lib/useLive";
import { numeric, numericSeries } from "../lib/model";
import { BarChart, Donut, Sparkline } from "../components/charts";
import {
  GreenhouseScene,
  QuietField,
  WaitingGrove,
} from "../components/illustrations";
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
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function Delta({ current, previous, unit }: { current: number | null; previous: number | null; unit: string }) {
  if (current === null || previous === null || current === previous)
    return <span className="delta flat">— steady</span>;
  const diff = current - previous;
  const up = diff > 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {diff.toFixed(1)}
      {unit} since last
    </span>
  );
}

function StatCard({
  label,
  icon,
  value,
  unit,
  foot,
  spark,
  id,
  delta,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  unit?: string;
  foot: string;
  spark?: { at: number; value: number }[];
  id: string;
  delta?: React.ReactNode;
}) {
  return (
    <article className="card stat-card">
      <span className="sc-icon">{icon}</span>
      <span className="sc-label">{label}</span>
      <span className="sc-value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {delta}
      <span className="sc-foot">{foot}</span>
      {spark && spark.length > 1 && (
        <div className="sc-spark">
          <Sparkline points={spark} id={id} />
        </div>
      )}
    </article>
  );
}

export default function Overview({
  live,
  onNavigate,
}: {
  live: LiveState;
  onNavigate: (v: "readings" | "setup" | "activity") => void;
}) {
  const { fs, latest, farm, history, now, loading } = live;
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
    return {
      percent: max === 0 ? 0 : (score / max) * 100,
      gaps: max - score,
      reporting: score,
      total: max,
    };
  }, [temp, humidity, fs, r, mq6]);

  // First visit with nothing recorded yet: a proper welcome state.
  if (loading)
    return (
      <div className="empty" style={{ padding: "120px 20px" }}>
        <span className="dots" style={{ justifyContent: "center" }}>
          <i />
          <i />
          <i />
        </span>
        <p style={{ marginTop: 18 }}>Waking the observatory…</p>
      </div>
    );

  if (!latest)
    return (
      <div className="empty" style={{ padding: "70px 20px" }}>
        <div style={{ display: "grid", placeItems: "center" }}>
          <WaitingGrove width={230} />
        </div>
        <h2 style={{ margin: "10px 0 6px", fontSize: 22, fontWeight: 800 }}>
          The field hasn't said a word yet
        </h2>
        <p style={{ maxWidth: 420, margin: "0 auto 22px" }}>
          Power the ESP32 and join it to your Wi-Fi — the moment it phones
          home, this page fills up on its own.
        </p>
        <button className="pill-btn solid" onClick={() => void live.refresh()}>
          Check again
        </button>
      </div>
    );

  const alert = (() => {
    if (fs.fire[2] === "danger")
      return {
        tone: "danger" as const,
        icon: <IconFire />,
        title: "The detector picked something up",
        body: fs.fire[1],
      };
    if (fs.water[2] === "danger")
      return {
        tone: "danger" as const,
        icon: <IconDroplet />,
        title: "Watering is paused for safety",
        body: fs.water[1],
      };
    if (!fs.fresh)
      return {
        tone: "warning" as const,
        icon: <IconAlert />,
        title: "Haven't heard from the field in a while",
        body: `The unit last checked in ${ago(now - fs.at)}. Its safety limits never left, though.`,
      };
    const gaps: string[] = [];
    if (temp === null) gaps.push("air climate");
    if (!fs.soilValid) gaps.push("soil moisture");
    if (r.fireSensorEnabled !== true) gaps.push("the fire detector");
    if (gaps.length)
      return {
        tone: "warning" as const,
        icon: <IconAlert />,
        title: "A few channels are quiet",
        body: `Nothing usable from ${gaps.join(", ")} — you'll see hatched gaps instead of made-up numbers.`,
      };
    return null;
  })();

  const hour = new Date(now).getHours();
  const dayWord = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const firstName = farm?.farmerName?.split(" ")[0];

  return (
    <div className="stagger">
      <div className="topbar">
        <div className="greeting">
          <h1>
            Good {dayWord}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p>
            {fs.fresh
              ? "Here's your tunnel right now, straight from the unit."
              : "The unit's been quiet — scroll on and you'll still see the record."}
          </p>
        </div>
        <div className="actions">
          <button className="pill-btn ghost" onClick={() => onNavigate("setup")}>
            <IconShield size={15} /> Setup
          </button>
        </div>
      </div>

      {farm && !farm.deviceSyncedAt && (
        <div className="notice warning" role="status">
          <IconAlert />
          <div>
            <strong>Almost there — one step left</strong>
            The unit hasn't confirmed your greenhouse profile yet. Keep it
            powered and online.
          </div>
          <button
            className="pill-btn solid"
            style={{ marginLeft: "auto" }}
            onClick={() => onNavigate("setup")}
          >
            Finish setup
          </button>
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

      <div className="stat-row">
        <article className="card stat-card hero">
          <span className="sc-corner">
            <IconShield size={16} />
          </span>
          <span className="sc-icon">
            <IconLeaf size={19} />
          </span>
          <span className="sc-label">Right now</span>
          <span className="sc-value">
            {fs.fire[2] === "danger"
              ? "Needs a human"
              : fs.fresh
                ? "Growing happily"
                : "Resting quietly"}
          </span>
          <span className="sc-foot">
            Checked in {ago(Math.max(0, now - fs.at))} ·{" "}
            {fs.usbOnly ? "bench build" : latest.hardwareProfile}
          </span>
        </article>

        <StatCard
          id="temp"
          label="Air temperature"
          icon={<IconThermometer />}
          value={temp === null ? "——" : temp.toFixed(1)}
          unit="°C"
          foot={`${tempSpark.length} fresh observations on file`}
          spark={tempSpark}
          delta={
            <Delta
              current={temp}
              previous={tempSpark.length > 1 ? tempSpark[tempSpark.length - 2].value : null}
              unit="°C"
            />
          }
        />
        <StatCard
          id="hum"
          label="Humidity"
          icon={<IconWind />}
          value={humidity === null ? "——" : humidity.toFixed(1)}
          unit="% RH"
          foot={`${humSpark.length} fresh observations on file`}
          spark={humSpark}
          delta={
            <Delta
              current={humidity}
              previous={humSpark.length > 1 ? humSpark[humSpark.length - 2].value : null}
              unit="%"
            />
          }
        />
        <StatCard
          id="soil"
          label="Soil moisture"
          icon={<IconLeaf />}
          value={fs.soilRaw === null ? "——" : String(fs.soilRaw)}
          unit="ADC"
          foot={
            r.soilSensorEnabled === false
              ? "This build keeps the probe switched off"
              : fs.soilValid
                ? r.soilDry
                  ? "Dry — the unit may water on its own"
                  : "Sitting in a healthy range"
                : "The probe's wire isn't making sense"
          }
          spark={soilSpark}
        />
      </div>

      <div className="chart-row">
        <section className="card">
          <div className="card-head">
            <h2>Temperature, report by report</h2>
            <span className="hint">hatched bars are missing reports</span>
          </div>
          <BarChart
            points={tempSpark}
            unit="°C"
            stale={!fs.fresh && history.length > 0}
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>How much is talking</h2>
            <span className="hint">channels answering right now</span>
          </div>
          <Donut
            percent={dial.percent}
            caption="answering"
            legend={[
              { label: "Talking", color: "var(--green)", count: dial.reporting },
              { label: "Silent", color: "var(--gold)", count: dial.gaps },
            ]}
          />
        </section>
      </div>

      <div className="chart-row">
        <section className="card">
          <div className="card-head">
            <h2>The two guardians</h2>
            <span className="hint">decisions happen on the unit — the cloud just watches</span>
          </div>
          <div className="row-list">
            <div className="row-item">
              <span
                className={`ri-icon ${
                  fs.fire[2] === "good" ? "good" : fs.fire[2] === "danger" ? "danger" : "warning"
                }`}
              >
                <IconFire />
              </span>
              <div className="ri-body">
                <h3>Fire watcher</h3>
                <p>{fs.fire[1]}</p>
              </div>
              <span className={`badge ${fs.fire[2] || "neutral"}`}>{fs.fire[0]}</span>
            </div>
            <div className="row-item">
              <span
                className={`ri-icon ${
                  fs.water[2] === "good" ? "good" : fs.water[2] === "danger" ? "danger" : "warning"
                }`}
              >
                <IconDroplet />
              </span>
              <div className="ri-body">
                <h3>Water keeper</h3>
                <p>{fs.water[1]}</p>
              </div>
              <span className={`badge ${fs.water[2] || "neutral"}`}>{fs.water[0]}</span>
            </div>
            <div className="row-item">
              <span
                className={`ri-icon ${
                  mq6 === null ? "neutral" : mq6 > 1500 ? "warning" : "good"
                }`}
              >
                <IconWind />
              </span>
              <div className="ri-body">
                <h3>Air sniffer</h3>
                <p>
                  {mq6 === null
                    ? "No gas reading yet — the sensor leads need dividing down to 3.3 V first."
                    : `Raw signal ${mq6}. It's a hint, not a measurement.`}
                </p>
              </div>
              <span
                className={`badge ${
                  mq6 === null ? "neutral" : mq6 > 1500 ? "warning" : "good"
                }`}
              >
                {mq6 === null ? "Nothing yet" : mq6 > 1500 ? "Sniffing something" : "Clean air"}
              </span>
            </div>
          </div>
        </section>

        <section
          className="card"
          style={{
            background: "linear-gradient(150deg, var(--deep-2), var(--deep) 75%)",
            color: "#d9edcf",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="card-head" style={{ borderBottom: "1px solid rgba(234,246,228,.14)" }}>
            <h2 style={{ color: "#fff" }}>The little box doing the work</h2>
          </div>
          <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ opacity: 0.72 }}>Its name tag</span>
              <span className="num" style={{ fontSize: 12.5 }}>
                {latest.deviceId}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ opacity: 0.72 }}>Running</span>
              <span className="num" style={{ fontSize: 12.5 }}>
                {latest.hardwareProfile}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ opacity: 0.72 }}>Wi-Fi strength</span>
              <span className="num" style={{ fontSize: 12.5 }}>
                {Number.isFinite(latest.wifiRssi) ? `${latest.wifiRssi} dBm` : "——"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={{ opacity: 0.72 }}>Connection to us</span>
              <span className="num" style={{ fontSize: 12.5, color: live.connected ? "#7fe08d" : "#e8c15a" }}>
                {live.connected ? "Stream open" : "Reconnecting"}
              </span>
            </div>
          </div>
          <div style={{ marginTop: "auto", paddingTop: 16, position: "relative" }}>
            <div style={{ position: "absolute", right: 0, top: -8, opacity: 0.9 }}>
              <QuietField width={110} />
            </div>
            <button
              className="pill-btn ghost"
              style={{ borderColor: "rgba(234,246,228,.3)", color: "#eaf6e4" }}
              onClick={() => onNavigate("readings")}
            >
              See every channel →
            </button>
          </div>
        </section>
      </div>

      {live.feed.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Fresh off the wire</h2>
            <button className="quiet" style={{ fontWeight: 700, color: "var(--green)" }} onClick={() => onNavigate("activity")}>
              The whole story →
            </button>
          </div>
          <div className="timeline" style={{ maxHeight: 240, overflow: "hidden" }}>
            {live.feed.slice(0, 4).map((entry, i) => (
              <div
                className={`tl-item ${
                  entry.text.toLowerCase().includes("fire")
                    ? "fire"
                    : entry.text.toLowerCase().includes("pump") || entry.text.toLowerCase().includes("water")
                      ? "water"
                      : ""
                }`}
                key={`${entry.at}-${i}`}
              >
                <span className="tl-dot" />
                <time>
                  {new Date(entry.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <span className="tl-text">{entry.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ textAlign: "center", paddingBottom: 20 }}>
        <GreenhouseScene width={420} />
      </div>
    </div>
  );
}
