import { LiveState } from "../lib/useLive";

type ReportView = {
  state: string;
  severity: "good" | "warning" | "danger" | "neutral";
  copy: string;
  canOpen: boolean;
};

function reportView(live: LiveState): ReportView {
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
  const eligible = Boolean(report && Object.keys(report).length > 0);
  if (eligible)
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
  const view = reportView(live);
  const farm = live.farm;

  return (
    <>
      <header className="page-head rise">
        <p className="eyebrow">Reports</p>
        <h1>
          A record you can <em>follow.</em>
        </h1>
        <p className="lede">
          Readings, connection changes, and acknowledged actions, drawn only
          from recorded observations.
        </p>
      </header>

      <section className="panel rise">
        <div className="report-cover">
          <p className="report-kicker">Field research report · 12-hour window</p>
          <h2>{farm?.name || "Your greenhouse"}</h2>
          <p>
            {farm?.farmerName ? `Operator ${farm.farmerName}` : "Field operator"}
            {farm?.crop ? ` · crop: ${farm.crop}` : ""}
          </p>
        </div>

        <p style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`pill ${view.severity}`}>{view.state}</span>
        </p>
        <p style={{ color: "var(--ink-secondary)", fontSize: 14 }}>{view.copy}</p>

        <div className="row-actions" style={{ marginTop: 18 }}>
          <button
            className="btn btn-primary"
            disabled={!view.canOpen}
            onClick={() => window.open("/report/", "_blank")}
          >
            Open my report
          </button>
        </div>
        <p className="disclaimer">
          Charts contain actual recorded observations only. Missing values
          remain missing and are never filled in or estimated.
        </p>
      </section>
    </>
  );
}
