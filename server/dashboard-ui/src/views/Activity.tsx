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
      <p className="kicker">Activity</p>
      <h1 className="headline">
        What happened <em>in the field.</em>
      </h1>
      <p className="sub">
        Readings, connection changes, and acknowledged actions — newest first.
        This session log begins when the page opens.
      </p>

      <section className="section">
        <div className="section-head">
          <h2>
            <span className="index">⌁</span>Event log
          </h2>
          <div className="cta-row">
            <button className="link-btn" onClick={copyTsv}>
              Copy
            </button>
            <button className="link-btn" onClick={downloadCsv}>
              Download CSV
            </button>
          </div>
        </div>
        <div className="panel">
          {live.feed.length === 0 ? (
            <p className="empty">
              Nothing logged yet. Field events, alerts, and command
              acknowledgements appear here as the session runs.
            </p>
          ) : (
            <div className="feed">
              {live.feed.map((entry, i) => (
                <div className="feed-line" key={`${entry.at}-${i}`}>
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
        </div>
      </section>
    </>
  );
}
