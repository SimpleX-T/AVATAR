import { LiveState } from "../lib/useLive";

function view(live: LiveState) {
  const { farm, fs, report } = live;
  if (!farm)
    return {
      state: "Setup needed",
      severity: "warning",
      copy: "Name your greenhouse and verify the field unit to start the 12-hour recording window.",
      canOpen: false,
    };
  if (!farm.deviceSyncedAt)
    return {
      state: "Waiting for the field unit",
      severity: "warning",
      copy: "The field unit has not acknowledged your greenhouse profile yet. Keep it powered and connected.",
      canOpen: false,
    };
  if (fs.usbOnly)
    return {
      state: "Sensors not connected",
      severity: "warning",
      copy: "The field unit is on the bench build; a cloud report would verify the link, not the greenhouse.",
      canOpen: false,
    };
  if (report && Object.keys(report).length > 0)
    return {
      state: "Time window complete",
      severity: "good",
      copy: "Your 12-hour recording window is complete. Open the printable research report.",
      canOpen: true,
    };
  return {
    state: "Observing your greenhouse",
    severity: "good",
    copy: "The recording window is running. The report unlocks 12 hours after the field unit confirmed your profile.",
    canOpen: false,
  };
}

export default function Reports({ live }: { live: LiveState }) {
  const v = view(live);
  const farm = live.farm;

  return (
    <>
      <p className="kicker">Reports</p>
      <h1 className="headline">
        A record you can <em>follow.</em>
      </h1>
      <p className="sub">
        Twelve hours of observed field data, drawn only from recorded
        observations. Missing values remain missing.
      </p>

      <section className="section">
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "clamp(28px, 4vw, 48px)",
              background:
                "linear-gradient(150deg, var(--mint-veil), transparent 60%)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <p className="kicker" style={{ marginBottom: 10 }}>
              Field research report · 12-hour window
            </p>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px, 4vw, 46px)",
                fontWeight: 300,
                lineHeight: 1.05,
              }}
            >
              {farm?.name || "Your greenhouse"}
            </div>
            <p className="quiet" style={{ marginTop: 8 }}>
              {farm?.farmerName ? `Operator ${farm.farmerName}` : "Field operator"}
              {farm?.crop ? ` · crop: ${farm.crop}` : ""}
            </p>
          </div>

          <div style={{ padding: "clamp(24px, 3vw, 40px)" }}>
            <span className={`badge ${v.severity}`}>{v.state}</span>
            <p style={{ color: "var(--ink-2)", fontSize: 15, marginTop: 14 }}>
              {v.copy}
            </p>
            <div className="cta-row" style={{ marginTop: 22 }}>
              <button
                className="cta cta-solid"
                disabled={!v.canOpen}
                onClick={() => window.open("/report/", "_blank")}
              >
                Open my report
              </button>
            </div>
            <p className="disclaimer">
              Charts contain actual recorded observations only. Missing values
              are never filled in or estimated.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
