import { LiveState } from "../lib/useLive";
import { QuietField } from "../components/illustrations";

function view(live: LiveState) {
  const { farm, fs, report } = live;
  if (!farm)
    return {
      state: "Not started yet",
      severity: "warning",
      copy: "Once your greenhouse has a name and the unit confirms it, the 12-hour record starts ticking.",
      canOpen: false,
    };
  if (!farm.deviceSyncedAt)
    return {
      state: "One foot in the door",
      severity: "warning",
      copy: "The unit hasn't confirmed your profile yet. Keep it powered and online and it'll click into place.",
      canOpen: false,
    };
  if (fs.usbOnly)
    return {
      state: "Still on the bench",
      severity: "warning",
      copy: "The unit is running its bench build right now, so a report would tell us about the cable, not the crops.",
      canOpen: false,
    };
  if (report && Object.keys(report).length > 0)
    return {
      state: "Your record is ready",
      severity: "good",
      copy: "Twelve hours have passed and the numbers are in. Open the printable version whenever you like.",
      canOpen: true,
    };
  return {
    state: "Watching and writing",
    severity: "good",
    copy: "The record's clock is running. Come back when twelve hours have passed and it'll be waiting.",
    canOpen: false,
  };
}

export default function Reports({ live }: { live: LiveState }) {
  const v = view(live);
  const farm = live.farm;

  return (
    <div className="stagger">
      <div className="topbar" style={{ padding: 0 }}>
        <div className="greeting">
          <h1>The twelve-hour record</h1>
          <p>
            Real observations only — if the sensors blinked, the record says
            so instead of filling the blanks.
          </p>
        </div>
      </div>

      <section className="card" style={{ overflow: "hidden", padding: 0 }}>
        <div
          style={{
            background: "linear-gradient(140deg, var(--deep-2), var(--deep) 80%)",
            color: "#eaf6e4",
            padding: "clamp(26px, 4vw, 44px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(168,224,99,.3), transparent 70%)",
              top: -80,
              right: -50,
            }}
          />
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: "#a8e063" }}>
            Field research report
          </p>
          <div style={{ fontSize: "clamp(26px, 3.4vw, 40px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {farm?.name || "Your greenhouse"}
          </div>
          <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: 14 }}>
            {farm?.farmerName ? `Kept by ${farm.farmerName}` : "Your field, on paper"}
            {farm?.crop ? ` · growing ${farm.crop}` : ""}
          </p>
        </div>

        <div style={{ padding: "clamp(22px, 3vw, 36px)" }}>
          <span className={`badge ${v.severity}`}>{v.state}</span>
          <p style={{ color: "var(--ink-2)", marginTop: 14, fontSize: 15 }}>
            {v.copy}
          </p>
          <div className="cta-row" style={{ marginTop: 20 }}>
            <button
              className="pill-btn solid"
              disabled={!v.canOpen}
              onClick={() => window.open("/report/", "_blank")}
            >
              Show me the record
            </button>
            {!v.canOpen && (
              <span className="quiet" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <QuietField width={40} /> It'll be worth the wait.
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
