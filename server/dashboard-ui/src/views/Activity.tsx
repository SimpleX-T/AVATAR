import { LiveState } from "../lib/useLive";

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
    <>
      <header className="page-head rise">
        <p className="eyebrow">Activity</p>
        <h1>
          What happened <em>in the field.</em>
        </h1>
        <p className="lede">
          Readings, connection changes, and acknowledged actions — newest
          first. This session log starts when the page opens.
        </p>
      </header>

      <section className="panel rise">
        <div className="panel-title">
          <h2>Field event log</h2>
          <div className="row-actions">
            <button className="ghost-btn" onClick={copyTsv}>
              Copy
            </button>
            <button className="ghost-btn" onClick={downloadCsv}>
              Download CSV
            </button>
          </div>
        </div>
        {live.feed.length === 0 ? (
          <p className="skip-note">
            Nothing logged yet. Field events, alerts, and command
            acknowledgements will appear here as the session runs.
          </p>
        ) : (
          <div className="feed">
            {live.feed.map((entry, i) => (
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
        )}
      </section>
    </>
  );
}
