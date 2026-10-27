import { useMemo } from "react";
import { LiveState } from "../lib/useLive";
import {
  numeric,
  numericSeries,
  soilMoisturePercent,
  rssiQuality,
  rssiWord,
  mq6Word,
} from "../lib/model";
import {
  MetricRing,
  BarChart,
  TrendChart,
} from "../components/charts";
import {
  GreenhouseScene,
  WaitingGrove,
} from "../components/illustrations";
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

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
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
  const soilRaw = numeric(r.soilRaw);
  const moisture = soilMoisturePercent(soilRaw);
  const mq6 = numeric(r.mq6Raw);
  const dbm = numeric(latest?.wifiRssi) ?? null;
  const quality = rssiQuality(dbm);
  const probe = r.probe?.raw || {};
  const ph = numeric(probe.ph);
  const ec = numeric(probe.ec);
  const nitrogen = numeric(probe.nitrogen);
  const phosphorus = numeric(probe.phosphorus);
  const potassium = numeric(probe.potassium);

  const tempSpark = useMemo(
    () => numericSeries(history, (readings) => numeric(readings.temperatureC)),
    [history],
  );
  const humSpark = useMemo(
    () => numericSeries(history, (readings) => numeric(readings.humidityPercent)),
    [history],
  );
  const moistSpark = useMemo(
    () =>
      numericSeries(history, (readings) =>
        soilMoisturePercent(numeric(readings.soilRaw)),
      ),
    [history],
  );
  const phSpark = useMemo(
    () =>
      numericSeries(history, (readings) => numeric(readings.probe?.raw?.ph)),
    [history],
  );
  const gasSpark = useMemo(
    () => numericSeries(history, (readings) => numeric(readings.mq6Raw)),
    [history],
  );

  if (loading)
    return (
      <div className="empty" style={{ padding: "120px 20px" }}>
        <span className="dots" style={{ justifyContent: "center" }}>
          <i />
          <i />
          <i />
        </span>
        <p style={{ marginTop: 18 }}>Opening the observatory…</p>
      </div>
    );

  if (!latest)
    return (
      <div className="empty" style={{ padding: "70px 20px" }}>
        <div style={{ display: "grid", placeItems: "center" }}>
          <WaitingGrove width={230} />
        </div>
        <h2 style={{ margin: "10px 0 6px", fontSize: 22, fontWeight: 700 }}>
          No news from the field yet
        </h2>
        <p style={{ maxWidth: 420, margin: "0 auto 22px" }}>
          Power the unit and get it on Wi-Fi — everything here fills in by
          itself the moment it checks in.
        </p>
        <button className="cta-line" onClick={() => void live.refresh()}>
          Look again
        </button>
      </div>
    );

  const alert = (() => {
    if (fs.fire[2] === "danger")
      return {
        tone: "danger" as const,
        icon: <IconFire />,
        title: "The fire watcher needs eyes on it",
        body: fs.fire[1],
      };
    if (fs.water[2] === "danger")
      return {
        tone: "danger" as const,
        icon: <IconDroplet />,
        title: "Watering is holding for a safety reason",
        body: fs.water[1],
      };
    if (!fs.fresh)
      return {
        tone: "warning" as const,
        icon: <IconAlert />,
        title: "The unit's last check-in is ageing",
        body: `Heard from it ${ago(now - fs.at)}. Its protection limits never left.`,
      };
    return null;
  })();

  const hour = new Date(now).getHours();
  const dayWord = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const firstName = farm?.farmerName?.split(" ")[0];

  return (
    <>
      <div className="kicker">
        {new Date(now).toLocaleDateString([], {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        {farm?.name ? ` — ${farm.name}` : ""}
      </div>
      <h1 className="headline">
        Good {dayWord}
        {firstName ? `, ${firstName}` : ""}.
        <br />
        <em>
          {fs.fire[2] === "danger"
            ? "Here's what needs you."
            : fs.fresh
              ? "Here's the field right now."
              : "Here's where things stood."}
        </em>
      </h1>
      <p className="meta-line">
        DEVICE {latest.deviceId} · HEARD FROM IT {ago(Math.max(0, now - fs.at)).toUpperCase()}
      </p>

      {farm && !farm.deviceSyncedAt && (
        <div className="notice warning" role="status">
          <IconAlert />
          <div>
            <strong>One step left in setup</strong>
            The unit hasn't confirmed your profile yet.
            <button
              className="cta-line"
              style={{ marginLeft: 14, padding: "8px 18px", fontSize: 13 }}
              onClick={() => onNavigate("setup")}
            >
              Finish setup
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

      {/* ── Every value: its own card, its own dial, its own trend ── */}
      <div className="metric-grid" style={{ marginTop: 34 }}>
        <MetricRing
          id="temp"
          label="Air temperature"
          icon={<IconThermometer />}
          display={temp === null ? "——" : temp.toFixed(1)}
          unit="°C"
          percent={temp === null ? null : (temp / 50) * 100}
          ideal={[18, 30]}
          caption={
            temp === null
              ? "No reading yet — the climate sensor hasn't reported."
              : temp > 35
                ? "It's hot in there — most crops sulk above 35 °C."
                : temp < 10
                  ? "It's cold — growth slows below 10 °C."
                  : "In the comfortable band for most greenhouse crops (green arc)."
          }
          status={{
            text:
              temp === null
                ? "No data"
                : temp > 35 || temp < 10
                  ? "Off range"
                  : "Healthy",
            severity:
              temp === null ? "neutral" : temp > 35 || temp < 10 ? "warning" : "good",
          }}
          spark={tempSpark}
        />

        <MetricRing
          id="hum"
          label="Humidity"
          icon={<IconWind />}
          display={humidity === null ? "——" : humidity.toFixed(0)}
          unit="% RH"
          percent={humidity}
          ideal={[40, 70]}
          caption={
            humidity === null
              ? "No reading yet from the climate sensor."
              : humidity > 80
                ? "Very damp air — watch for mould on leaves."
                : humidity < 30
                  ? "Dry air — plants will drink faster than usual."
                  : "Comfortable moisture in the air (green arc)."
          }
          status={{
            text:
              humidity === null
                ? "No data"
                : humidity > 80 || humidity < 30
                  ? "Off range"
                  : "Healthy",
            severity:
              humidity === null
                ? "neutral"
                : humidity > 80 || humidity < 30
                  ? "warning"
                  : "good",
          }}
          spark={humSpark}
        />

        <MetricRing
          id="moist"
          label="Soil moisture"
          icon={<IconLeaf />}
          display={moisture === null ? "——" : String(moisture)}
          unit="% wet"
          percent={moisture}
          ideal={[40, 80]}
          caption={
            moisture === null
              ? fs.usbOnly
                ? "The probe input is switched off on this bench build."
                : "No soil reading — check the probe cable."
              : moisture < 30
                ? "Parched — the unit will water on its own schedule."
                : moisture > 90
                  ? "Very soggy — the pump should be resting."
                  : "Moist where it should be (green arc)."
          }
          status={{
            text:
              moisture === null
                ? "No data"
                : moisture < 30 || moisture > 90
                  ? "Needs attention"
                  : "Healthy",
            severity:
              moisture === null
                ? "neutral"
                : moisture < 30 || moisture > 90
                  ? "warning"
                  : "good",
          }}
          spark={moistSpark}
        />

        <MetricRing
          id="gas"
          label="Air quality · MQ-6"
          icon={<IconWind />}
          display={mq6 === null ? "——" : String(mq6)}
          unit="raw"
          percent={mq6 === null ? null : Math.min((mq6 / 2000) * 100, 100)}
          ideal={[0, 30]}
          caption={
            mq6 === null
              ? "No gas reading. The sensor leads need dividing down to 3.3 V first."
              : `${mq6Word(mq6)}. A hint from a raw sensor, not a lab measurement.`
          }
          status={{
            text: mq6 === null ? "No data" : mq6 > 1500 ? "Check it" : mq6 > 600 ? "Something" : "Clear",
            severity:
              mq6 === null ? "neutral" : mq6 > 1500 ? "danger" : mq6 > 600 ? "warning" : "good",
          }}
          spark={gasSpark}
        />

        <MetricRing
          id="ph"
          label="Soil pH"
          icon={<IconLeaf />}
          display={ph === null ? "——" : String(ph)}
          unit="pH"
          percent={ph === null ? null : (ph / 14) * 100}
          ideal={[39, 50]}
          caption={
            ph === null
              ? "The RS-485 probe hasn't produced a pH register yet."
              : ph < 5.5
                ? "Acidic side — some crops struggle below 5.5."
                : ph > 7
                  ? "Alkaline side — nutrients can lock out above 7."
                  : "In the slightly-sour range most crops love (green arc)."
          }
          status={{
            text: ph === null ? "Awaiting" : ph > 7 || ph < 5.5 ? "Off range" : "Healthy",
            severity:
              ph === null ? "neutral" : ph > 7 || ph < 5.5 ? "warning" : "good",
          }}
          spark={phSpark}
        />

        <MetricRing
          id="link"
          label="Field link"
          icon={<IconSignal />}
          display={quality === null ? "——" : String(quality)}
          unit={rssiWord(dbm)}
          percent={quality}
          caption={
            quality === null
              ? "No radio signal reported."
              : `${dbm} dBm — ${rssiWord(dbm)} connection back to the network.`
          }
          status={{
            text:
              quality === null
                ? "No data"
                : quality > 60
                  ? "Strong"
                  : quality > 35
                    ? "Okay"
                    : "Weak",
            severity:
              quality === null
                ? "neutral"
                : quality > 35
                  ? "good"
                  : "warning",
          }}
        />

        <MetricRing
          id="conduct"
          label="Soil conductivity"
          icon={<IconLeaf />}
          display={ec === null ? "——" : String(ec)}
          unit="raw EC"
          percent={ec === null ? null : Math.min((ec / 2000) * 100, 100)}
          caption={
            ec === null
              ? "The probe hasn't produced an EC register yet."
              : "Salts in the soil solution — raw register, scale still being verified."
          }
          status={{ text: ec === null ? "Awaiting" : "Raw", severity: ec === null ? "neutral" : "good" }}
        />

        <MetricRing
          id="nitro"
          label="Nitrogen"
          icon={<IconLeaf />}
          display={nitrogen === null ? "——" : String(nitrogen)}
          unit="raw N"
          percent={
            nitrogen === null ? null : Math.min((nitrogen / 1000) * 100, 100)
          }
          caption={
            nitrogen === null
              ? "The probe hasn't produced an N register yet."
              : "Raw nitrogen register — research value until the probe's scale is verified."
          }
          status={{ text: nitrogen === null ? "Awaiting" : "Raw", severity: nitrogen === null ? "neutral" : "good" }}
        />

        <MetricRing
          id="phos"
          label="Phosphorus"
          icon={<IconLeaf />}
          display={phosphorus === null ? "——" : String(phosphorus)}
          unit="raw P"
          percent={
            phosphorus === null
              ? null
              : Math.min((phosphorus / 1000) * 100, 100)
          }
          caption={
            phosphorus === null
              ? "The probe hasn't produced a P register yet."
              : "Raw phosphorus register — research value until the probe's scale is verified."
          }
          status={{ text: phosphorus === null ? "Awaiting" : "Raw", severity: phosphorus === null ? "neutral" : "good" }}
        />

        <MetricRing
          id="kali"
          label="Potassium"
          icon={<IconLeaf />}
          display={potassium === null ? "——" : String(potassium)}
          unit="raw K"
          percent={
            potassium === null
              ? null
              : Math.min((potassium / 1000) * 100, 100)
          }
          caption={
            potassium === null
              ? "The probe hasn't produced a K register yet."
              : "Raw potassium register — research value until the probe's scale is verified."
          }
          status={{ text: potassium === null ? "Awaiting" : "Raw", severity: potassium === null ? "neutral" : "good" }}
        />
      </div>

      {/* Protection + connection summary */}
      <div className="split" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <section className="panel">
          <div className="panel-title">
            <h2>The two guardians</h2>
            <span className="hint">decisions run on the unit itself</span>
          </div>
          <div className="protection-row">
            <span className={`protection-icon ${fs.fire[2] === "good" ? "good" : fs.fire[2] === "danger" ? "danger" : "warning"}`}>
              <IconFire />
            </span>
            <div style={{ flex: 1 }}>
              <h3>Fire watcher</h3>
              <p>{fs.fire[1]}</p>
            </div>
            <span className={`pill ${fs.fire[2] || "neutral"}`}>{fs.fire[0]}</span>
          </div>
          <div className="protection-row">
            <span className={`protection-icon ${fs.water[2] === "good" ? "good" : fs.water[2] === "danger" ? "danger" : "warning"}`}>
              <IconDroplet />
            </span>
            <div style={{ flex: 1 }}>
              <h3>Water keeper</h3>
              <p>{fs.water[1]}</p>
            </div>
            <span className={`pill ${fs.water[2] || "neutral"}`}>{fs.water[0]}</span>
          </div>
          <div className="protection-row">
            <span className="protection-icon neutral">
              <IconShield />
            </span>
            <div style={{ flex: 1 }}>
              <h3>Manual pumps</h3>
              <p>
                {r.manualPumpTest && r.manualPumpTest !== "none"
                  ? `A test burst is running — ${r.manualPumpTest}, ${Math.round((r.manualPumpRemainingMs || 0) / 100) / 10}s left.`
                  : "Idle. Fire and irrigation always outrank a manual trigger."}
              </p>
            </div>
            <span className={`pill ${r.manualPumpTest && r.manualPumpTest !== "none" ? "warning" : "neutral"}`}>
              {r.manualPumpTest && r.manualPumpTest !== "none" ? "Bursting" : "Idle"}
            </span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <h2>Connection health</h2>
          </div>
          <TrendChart
            points={moistSpark.map((p) => ({ at: p.at, value: p.value }))}
            unit="%"
            label="soil moisture"
            height={160}
          />
          <p className="quiet" style={{ marginBottom: 8 }}>
            Soil moisture over the recent window — the graph the pump listens
            to.
          </p>
          <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="quiet">Stream to the cloud</span>
              <span className="num" style={{ color: live.connected ? "var(--mint)" : "var(--gold)" }}>
                {live.connected ? "OPEN" : "RECONNECTING"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="quiet">Last handshake</span>
              <span className="num">{ago(Math.max(0, now - fs.at))}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="quiet">Running profile</span>
              <span className="num">{latest.hardwareProfile}</span>
            </div>
          </div>
        </section>
      </div>

      {history.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title">
            <h2>Temperature, report by report</h2>
            <span className="hint">hatched bars are missing reports</span>
          </div>
          <BarChart points={tempSpark} unit="°C" stale={!fs.fresh} />
        </section>
      )}

      {live.feed.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title">
            <h2>Fresh off the wire</h2>
            <button className="quiet" style={{ fontWeight: 700, color: "var(--mint)" }} onClick={() => onNavigate("activity")}>
              The whole story →
            </button>
          </div>
          <div className="feed">
            {live.feed.slice(0, 5).map((entry, i) => (
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

      <div style={{ textAlign: "center", marginTop: 30 }}>
        <GreenhouseScene width={420} />
      </div>
    </>
  );
}
