import { LiveState } from "../lib/useLive";
import { WaitingGrove } from "../components/illustrations";

function kindOf(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("fire")) return "fire";
  if (t.includes("water") || t.includes("pump") || t.includes("hydration"))
    return "water";
  if (t.includes("command") || t.includes("applied") || t.includes("timed out"))
    return "command";
  return "";
}

export default function Activity({ live }: { live: LiveState }) {
  const copyTsv = () => {
    const tsv = live.feed
      .map((e) => `${new Date(e.at).toISOString()}\t${e.text}`)
      .join("\n");
    void navigator.clipboard?.writeText(tsv);
  };
  const downloadCsv = () => {
    const csv = [
      "received_at,event",
      ...live.feed.map(
        (e) => `${new Date(e.at).toISOString()},"${e.text.replaceAll('"', '""')}"`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "AVATAR-field-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stagger">
      <div className="topbar" style={{ padding: 0 }}>
        <div className="greeting">
          <h1>The story so far</h1>
          <p>
            Every burst, alert and answered command, newest first. The book
            opens when you do and closes when you leave.
          </p>
        </div>
        <div className="actions">
          <button className="pill-btn ghost" onClick={copyTsv}>
            Copy
          </button>
          <button className="pill-btn solid" onClick={downloadCsv}>
            Take the CSV
          </button>
        </div>
      </div>

      <section className="card" style={{ padding: "22px 24px" }}>
        {live.feed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0 10px" }}>
            <WaitingGrove width={190} />
            <p style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 4px" }}>
              Crickets. Nothing has happened yet.
            </p>
            <p className="quiet" style={{ maxWidth: 380, margin: "0 auto" }}>
              The moment a pump kicks, a flame shows up, or the unit answers a
              command, it lands on this line.
            </p>
          </div>
        ) : (
          <div className="timeline">
            {live.feed.map((entry, i) => (
              <div className={`tl-item ${kindOf(entry.text)}`} key={`${entry.at}-${i}`}>
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
        )}
      </section>
    </div>
  );
}
