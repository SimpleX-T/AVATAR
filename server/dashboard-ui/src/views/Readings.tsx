import { useEffect, useState } from "react";
import { LiveState } from "../lib/useLive";
import { numeric } from "../lib/model";
import { sendCommand, CommandStatus } from "../lib/api";
import { ProbeHiccup } from "../components/illustrations";
import { IconFire, IconDroplet, IconSignal } from "../components/icons";

type Note = { text: string; tone: "ok" | "err" | "" };

export default function Readings({ live }: { live: LiveState }) {
  const { fs, latest, now, loading } = live;
  const r = fs.readings;
  const probe = r.probe?.raw || {};
  const [note, setNote] = useState<Note>({ text: "", tone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = live.commandResult;
    if (!result) return;
    if (result.status.applied)
      setNote({ text: "Done — the unit confirmed it did the job.", tone: "ok" });
    else
      setNote({
        text: result.status.error || "The unit said no to that one.",
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
      setNote({ text: "On its way — waiting for the unit to answer.", tone: "" });
    } catch (e) {
      setNote({ text: (e as Error).message, tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="empty" style={{ padding: "120px 20px" }}>
        <span className="dots" style={{ justifyContent: "center" }}>
          <i />
          <i />
          <i />
        </span>
        <p style={{ marginTop: 18 }}>Pulling the ledger together…</p>
      </div>
    );

  const rows: {
    name: string;
    sub: string;
    value: string;
    unit?: string;
    badge: { text: string; severity: string };
  }[] = [
    {
      name: "Air temperature",
      sub: "DHT11 · a bench-grade sensor, so treat it gently",
      value: numeric(r.temperatureC) === null ? "——" : numeric(r.temperatureC)!.toFixed(1),
      unit: "°C",
      badge: numeric(r.temperatureC) === null
        ? { text: "Nothing yet", severity: "neutral" }
        : { text: "Live", severity: "good" },
    },
    {
      name: "Humidity",
      sub: "DHT11 · moisture in the air",
      value: numeric(r.humidityPercent) === null ? "——" : numeric(r.humidityPercent)!.toFixed(1),
      unit: "% RH",
      badge: numeric(r.humidityPercent) === null
        ? { text: "Nothing yet", severity: "neutral" }
        : { text: "Live", severity: "good" },
    },
    {
      name: "Soil moisture",
      sub: "Capacitive probe · raw counts off the ADC",
      value: fs.soilRaw === null ? "——" : String(fs.soilRaw),
      badge:
        r.soilSensorEnabled === false
          ? { text: "Switched off", severity: "neutral" }
          : fs.soilValid
            ? { text: r.soilDry ? "Bone dry" : "Looking good", severity: "good" }
            : { text: "Doesn't add up", severity: "warning" },
    },
    {
      name: "Air sniffer · MQ-6",
      sub: "A raw hint of gas, not a lab number",
      value: numeric(r.mq6Raw) === null ? "——" : String(numeric(r.mq6Raw)),
      unit: "ADC",
      badge: numeric(r.mq6Raw) === null
        ? { text: "Nothing yet", severity: "neutral" }
        : { text: "Live", severity: "good" },
    },
    {
      name: "Probe pH",
      sub: "RS-485 register · scale still unverified",
      value: numeric(probe.ph) === null ? "——" : String(numeric(probe.ph)),
      badge: numeric(probe.ph) === null
        ? { text: "Probe asleep", severity: "neutral" }
        : { text: "Live", severity: "good" },
    },
    {
      name: "Probe EC",
      sub: "RS-485 register · scale still unverified",
      value: numeric(probe.ec) === null ? "——" : String(numeric(probe.ec)),
      badge: numeric(probe.ec) === null
        ? { text: "Probe asleep", severity: "neutral" }
        : { text: "Live", severity: "good" },
    },
    {
      name: "N · P · K",
      sub: "The three RS-485 nutrient registers",
      value:
        numeric(probe.nitrogen) === null
          ? "——"
          : `${numeric(probe.nitrogen)} / ${numeric(probe.phosphorus) ?? "—"} / ${numeric(probe.potassium) ?? "—"}`,
      badge: numeric(probe.nitrogen) === null
        ? { text: "Probe asleep", severity: "neutral" }
        : { text: "Live", severity: "good" },
    },
  ];

  return (
    <div className="stagger">
      <div className="topbar" style={{ padding: 0 }}>
        <div className="greeting">
          <h1>Every channel, exactly as reported</h1>
          <p>
            Raw numbers straight off the sensors. When something's missing,
            we say so instead of guessing.
          </p>
        </div>
        <div className="actions">
          <span className="badge neutral">
            {fs.usbOnly
              ? "BENCH BUILD"
              : live.source === "thingspeak"
                ? "FROM THE CLOUD RECORD"
                : "STRAIGHT FROM THE UNIT"}
          </span>
        </div>
      </div>

      {!fs.soilValid && r.soilSensorEnabled !== false && (
        <div className="notice warning">
          <ProbeHiccup width={64} />
          <div style={{ alignSelf: "center" }}>
            <strong>The soil probe's cable seems to have popped out</strong>
            Reseat it at both ends and this row will wake up on its own.
          </div>
        </div>
      )}

      <section className="card">
        <div style={{ overflowX: "auto" }}>
          <table className="ledger">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Reading</th>
                <th>Verdict</th>
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
                    <span className={`badge ${row.badge.severity}`}>
                      {row.badge.text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="disclaimer">
          The soil-probe registers use a generic manual's scaling, so treat
          them as research values. The MQ-6 numbers are hints, not gas
          concentrations. Taken{" "}
          {fs.at ? `${Math.max(0, Math.round((now - fs.at) / 1000))}s before now` : "—"}.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Do things from here</h2>
          <span className="hint">one pump · 3 seconds max · 10 s cool-off</span>
        </div>
        <p className="quiet" style={{ marginTop: -6, marginBottom: 16 }}>
          If the unit is busy protecting itself, your request politely waits —
          its own safety calls always win.
        </p>
        <div className="cta-row">
          <button
            className="pill-btn ghost"
            disabled={!fs.canCommand || anyPending || busy}
            onClick={() => void trigger("PING")}
          >
            <IconSignal size={15} /> Give it a shout
          </button>
          <button
            className="pill-btn ghost"
            disabled={!fs.canCommand || anyPending || busy}
            onClick={() => void trigger("TEST_FIRE_PUMP")}
          >
            <IconFire size={15} /> Fire pump — quick burst
          </button>
          <button
            className="pill-btn ghost"
            disabled={!fs.canCommand || anyPending || busy}
            onClick={() => void trigger("TEST_HYDRATION_PUMP")}
          >
            <IconDroplet size={15} /> Water pump — quick burst
          </button>
          <button
            className="pill-btn danger"
            disabled={!fs.canCommand || anyPending || busy}
            onClick={() => void trigger("STOP_PUMP_TEST")}
          >
            Stop everything
          </button>
        </div>
        <p
          className="quiet"
          role="status"
          style={{
            marginTop: 14,
            color:
              note.tone === "ok"
                ? "var(--green)"
                : note.tone === "err"
                  ? "var(--red)"
                  : "var(--ink-3)",
          }}
        >
          {note.text}
        </p>
      </section>
    </div>
  );
}
