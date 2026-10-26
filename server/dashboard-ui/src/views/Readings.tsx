import { useEffect, useState } from "react";
import { LiveState } from "../lib/useLive";
import { numeric } from "../lib/model";
import { sendCommand, CommandStatus } from "../lib/api";
import { IconFire, IconDroplet, IconSignal } from "../components/icons";

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
      setNote({
        text: "ESP32 acknowledged the cloud command.",
        tone: "ok",
      });
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
      const command: CommandStatus = await sendCommand(
        latest!.deviceId,
        action,
      );
      live.enqueue(command.commandId, action);
      setNote({
        text: "Queued. Waiting for the field unit to acknowledge.",
        tone: "",
      });
    } catch (e) {
      setNote({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  const sourceBadge = fs.usbOnly
    ? "BENCH DEVICE REPORT"
    : live.source === "thingspeak"
      ? "CLOUD OBSERVATION"
      : "PHYSICAL FIELD REPORT";

  const rows: {
    name: string;
    sub: string;
    value: string;
    unit?: string;
    status: { text: string; severity: string };
  }[] = [
    {
      name: "Air temperature",
      sub: "DHT11 · uncalibrated bench sensor",
      value: numeric(r.temperatureC) === null ? "—" : numeric(r.temperatureC)!.toFixed(1),
      unit: "°C",
      status: numeric(r.temperatureC) === null
        ? { text: "No data", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Humidity",
      sub: "DHT11 · relative humidity",
      value: numeric(r.humidityPercent) === null ? "—" : numeric(r.humidityPercent)!.toFixed(1),
      unit: "% RH",
      status: numeric(r.humidityPercent) === null
        ? { text: "No data", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Soil moisture",
      sub: "Capacitive probe · raw ADC counts",
      value: fs.soilRaw === null ? "—" : String(fs.soilRaw),
      status: r.soilSensorEnabled === false
        ? { text: "Disabled", severity: "neutral" }
        : fs.soilValid
          ? { text: r.soilDry ? "Dry" : "Valid", severity: "good" }
          : { text: "Invalid", severity: "warning" },
    },
    {
      name: "Atmosphere · MQ-6",
      sub: "Raw gas signal, not a concentration",
      value: numeric(r.mq6Raw) === null ? "—" : String(numeric(r.mq6Raw)),
      unit: "ADC",
      status: numeric(r.mq6Raw) === null
        ? { text: "No data", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Soil probe pH",
      sub: "RS-485 raw register, unverified scaling",
      value: numeric(probe.ph) === null ? "—" : String(numeric(probe.ph)),
      status: numeric(probe.ph) === null
        ? { text: "Awaiting probe", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Soil probe EC",
      sub: "RS-485 raw register, unverified scaling",
      value: numeric(probe.ec) === null ? "—" : String(numeric(probe.ec)),
      status: numeric(probe.ec) === null
        ? { text: "Awaiting probe", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
    {
      name: "Nitrogen · Phosphorus · Potassium",
      sub: "RS-485 NPK raw registers",
      value:
        numeric(probe.nitrogen) === null
          ? "—"
          : `${numeric(probe.nitrogen)} / ${numeric(probe.phosphorus) ?? "—"} / ${numeric(probe.potassium) ?? "—"}`,
      status: numeric(probe.nitrogen) === null
        ? { text: "Awaiting probe", severity: "neutral" }
        : { text: "Reporting", severity: "good" },
    },
  ];

  return (
    <>
      <header className="page-head rise">
        <p className="eyebrow">Sensor observations</p>
        <h1>
          What the field <em>reports.</em>
        </h1>
        <p className="lede">
          Every row is a measured value. Gaps stay gaps — nothing is averaged
          into existence.
        </p>
        <p className="head-meta">
          {sourceBadge} ·{" "}
          {fs.at
            ? `received ${Math.max(0, Math.round((now - fs.at) / 1000))}s ago`
            : "no report yet"}
        </p>
      </header>

      <section className="panel rise">
        <table className="sensor-table">
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
                  <span className="sensor-name">{row.name}</span>
                  <span className="sensor-sub">{row.sub}</span>
                </td>
                <td className="value">
                  {row.value}
                  {row.unit && <span className="unit"> {row.unit}</span>}
                </td>
                <td>
                  <span className={`pill ${row.status.severity || "neutral"}`}>
                    {row.status.text}
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
      </section>

      <section className="panel rise">
        <div className="panel-title">
          <h2>Field unit</h2>
          <span className="hint">{latest?.hardwareProfile || "unknown profile"}</span>
        </div>
        <table className="sensor-table">
          <tbody>
            <tr>
              <td>
                <span className="sensor-name">Device identifier</span>
              </td>
              <td className="value" style={{ fontSize: 13 }}>
                {latest?.deviceId || "—"}
              </td>
            </tr>
            <tr>
              <td>
                <span className="sensor-name">Wi-Fi signal</span>
                <span className="sensor-sub">
                  <IconSignal size={12} /> radio link quality
                </span>
              </td>
              <td className="value">
                {latest?.wifiRssi !== undefined && Number.isFinite(latest.wifiRssi)
                  ? `${latest.wifiRssi} dBm`
                  : "—"}
              </td>
            </tr>
            <tr>
              <td>
                <span className="sensor-name">Cloud history</span>
                <span className="sensor-sub">
                  {live.source === "thingspeak"
                    ? "reading from private ThingSpeak channels"
                    : "reading from live device stream"}
                </span>
              </td>
              <td>
                {live.cloudAvailable === undefined ? (
                  <span className="pill neutral">Checking…</span>
                ) : live.cloudAvailable ? (
                  <span className="pill good">Configured</span>
                ) : (
                  <span className="pill warning">Unavailable</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="manual-controls">
          <h3>Connection &amp; pump controls</h3>
          <p className="quiet">
            Each trigger runs one pump for at most three seconds. Only one
            pump runs at a time; a ten-second cooldown follows each stop.
            Automatic fire and irrigation responses always take priority.
          </p>
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button
              className="btn btn-outline"
              disabled={!fs.canCommand || anyPending || busy}
              onClick={() => void trigger("PING")}
            >
              Test cloud link
            </button>
            <button
              className="btn btn-outline"
              disabled={!fs.canCommand || anyPending || busy}
              onClick={() => void trigger("TEST_FIRE_PUMP")}
            >
              <IconFire size={15} /> Run fire pump (3 s)
            </button>
            <button
              className="btn btn-outline"
              disabled={!fs.canCommand || anyPending || busy}
              onClick={() => void trigger("TEST_HYDRATION_PUMP")}
            >
              <IconDroplet size={15} /> Run hydration pump (3 s)
            </button>
            <button
              className="btn btn-danger"
              disabled={!fs.canCommand || anyPending || busy}
              onClick={() => void trigger("STOP_PUMP_TEST")}
            >
              Stop pump test
            </button>
          </div>
          <p className={`command-note ${note.tone}`} role="status">
            {note.text}
          </p>
        </div>
      </section>
    </>
  );
}
