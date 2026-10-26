import { useEffect, useState } from "react";
import { LiveState } from "../lib/useLive";
import { numeric } from "../lib/model";
import { sendCommand, CommandStatus } from "../lib/api";
import { IconFire, IconDroplet } from "../components/icons";

type Note = { text: string; tone: "ok" | "err" | "" };

export default function Readings({ live }: { live: LiveState }) {
  const { fs, latest, now } = live;
  const r = fs.readings;
  const probe = r.probe?.raw || {};
  const [note, setNote] = useState<Note>({ text: "", tone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = live.commandResult;
    if (!result) return;
    if (result.status.applied)
      setNote({ text: "Field unit applied the command.", tone: "ok" });
    else
      setNote({
        text: result.status.error || "Field unit rejected the command.",
        tone: "err",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.commandResult?.at]);

  const anyPending = live.pending.size > 0;

  const trigger = async (action: string) => {
    if (!fs.canCommand || anyPending || busy) return;
    setBusy(true);
    try {
      const command: CommandStatus = await sendCommand(latest!.deviceId, action);
      live.enqueue(command.commandId, action);
      setNote({ text: "Queued — waiting for the field unit.", tone: "" });
    } catch (e) {
      setNote({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  const rows: {
    name: string;
    sub: string;
    value: string;
    unit?: string;
    badge: { text: string; severity: string };
  }[] = [
    {
      name: "Air temperature",
      sub: "DHT11 · bench sensor, uncalibrated",
      value: numeric(r.temperatureC) === null ? "——" : numeric(r.temperatureC)!.toFixed(1),
      unit: "°C",
      badge: numeric(r.temperatureC) === null
        ? { text: "No data", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Humidity",
      sub: "DHT11 · relative humidity",
      value: numeric(r.humidityPercent) === null ? "——" : numeric(r.humidityPercent)!.toFixed(1),
      unit: "% RH",
      badge: numeric(r.humidityPercent) === null
        ? { text: "No data", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Soil moisture",
      sub: "Capacitive probe · raw ADC counts",
      value: fs.soilRaw === null ? "——" : String(fs.soilRaw),
      badge:
        r.soilSensorEnabled === false
          ? { text: "Disabled", severity: "neutral" }
          : fs.soilValid
            ? { text: r.soilDry ? "Dry" : "Valid", severity: "good" }
            : { text: "Invalid", severity: "warning" },
    },
    {
      name: "Atmosphere · MQ-6",
      sub: "Raw gas signal — not a concentration",
      value: numeric(r.mq6Raw) === null ? "——" : String(numeric(r.mq6Raw)),
      unit: "ADC",
      badge: numeric(r.mq6Raw) === null
        ? { text: "No data", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Probe pH",
      sub: "RS-485 register · unverified scaling",
      value: numeric(probe.ph) === null ? "——" : String(numeric(probe.ph)),
      badge: numeric(probe.ph) === null
        ? { text: "Awaiting probe", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Probe EC",
      sub: "RS-485 register · unverified scaling",
      value: numeric(probe.ec) === null ? "——" : String(numeric(probe.ec)),
      badge: numeric(probe.ec) === null
        ? { text: "Awaiting probe", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "N · P · K",
      sub: "RS-485 NPK raw registers",
      value:
        numeric(probe.nitrogen) === null
          ? "——"
          : `${numeric(probe.nitrogen)} / ${numeric(probe.phosphorus) ?? "—"} / ${numeric(probe.potassium) ?? "—"}`,
      badge: numeric(probe.nitrogen) === null
        ? { text: "Awaiting probe", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
  ];

  return (
    <>
      <p className="kicker">Sensor ledger</p>
      <h1 className="headline">
        What the field <em>reports.</em>
      </h1>
      <p className="sub">
        Every row is a measurement taken by the field unit. Gaps stay gaps —
        nothing is averaged into existence.
      </p>
      <p className="meta-line">
        {fs.usbOnly
          ? "BENCH DEVICE REPORT"
          : live.source === "thingspeak"
            ? "CLOUD OBSERVATION"
            : "PHYSICAL FIELD REPORT"}
        {fs.at ? ` · RECEIVED ${Math.max(0, Math.round((now - fs.at) / 1000))}S AGO` : ""}
      </p>

      <section className="section">
        <div className="panel">
          <table className="ledger">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Value</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>
                    <span className="chan">{row.name}</span>
                    <span className="chan-sub">{row.sub}</span>
                  </td>
                  <td className="val">
                    {row.value}
                    {row.unit && <span className="unit"> {row.unit}</span>}
                  </td>
                  <td>
                    <span className={`badge ${row.badge.severity || "neutral"}`}>
                      {row.badge.text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="disclaimer">
            Soil-probe numbers are raw register values with unverified scaling.
            MQ-6 values are uncalibrated signals, not a gas concentration or
            safety assessment.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>
            <span className="index">⌁</span>Field unit &amp; controls
          </h2>
          <span className="hint">{latest?.hardwareProfile || "unknown profile"}</span>
        </div>
        <div className="panel">
          <table className="ledger">
            <tbody>
              <tr>
                <td className="chan">Device identifier</td>
                <td className="val" style={{ fontSize: 13.5 }}>{latest?.deviceId || "——"}</td>
              </tr>
              <tr>
                <td>
                  <span className="chan">Wi-Fi signal</span>
                  <span className="chan-sub">radio link quality</span>
                </td>
                <td className="val">
                  {Number.isFinite(latest?.wifiRssi) ? `${latest!.wifiRssi} dBm` : "——"}
                </td>
              </tr>
              <tr>
                <td>
                  <span className="chan">Cloud history</span>
                  <span className="chan-sub">
                    {live.source === "thingspeak"
                      ? "from private ThingSpeak channels"
                      : "from the live device stream"}
                  </span>
                </td>
                <td>
                  {live.cloudAvailable === undefined ? (
                    <span className="badge neutral">Checking</span>
                  ) : live.cloudAvailable ? (
                    <span className="badge good">Configured</span>
                  ) : (
                    <span className="badge warning">Unavailable</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-2)" }}>
              Manual pump triggers
            </p>
            <p className="quiet" style={{ marginBottom: 16 }}>
              One pump at a time, three seconds maximum, ten-second cooldown
              after each stop. Automatic fire and irrigation responses always
              take priority.
            </p>
            <div className="cta-row">
              <button
                className="cta cta-line"
                disabled={!fs.canCommand || anyPending || busy}
                onClick={() => void trigger("PING")}
              >
                Test cloud link
              </button>
              <button
                className="cta cta-line"
                disabled={!fs.canCommand || anyPending || busy}
                onClick={() => void trigger("TEST_FIRE_PUMP")}
              >
                <IconFire size={15} /> Fire pump · 3 s
              </button>
              <button
                className="cta cta-line"
                disabled={!fs.canCommand || anyPending || busy}
                onClick={() => void trigger("TEST_HYDRATION_PUMP")}
              >
                <IconDroplet size={15} /> Hydration pump · 3 s
              </button>
              <button
                className="cta cta-flame"
                disabled={!fs.canCommand || anyPending || busy}
                onClick={() => void trigger("STOP_PUMP_TEST")}
              >
                Stop pump test
              </button>
            </div>
            <p
              className={`draft-note ${note.tone === "ok" ? "" : ""}`}
              style={{ color: note.tone === "ok" ? "var(--mint)" : note.tone === "err" ? "var(--flame)" : "var(--ink-3)" }}
              role="status"
            >
              {note.text}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
