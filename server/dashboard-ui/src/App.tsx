import { useEffect, useState } from "react";
import { useLive } from "./lib/useLive";
import Overview from "./views/Overview";
import Readings from "./views/Readings";
import Activity from "./views/Activity";
import Reports from "./views/Reports";
import Setup from "./views/Setup";
import { api } from "./lib/api";
import {
  BrandGlyph,
  IconOverview,
  IconReadings,
  IconActivity,
  IconReports,
  IconSetup,
  IconRefresh,
  IconLogout,
  IconMoon,
  IconSun,
} from "./components/icons";

const VIEWS = ["overview", "readings", "activity", "reports", "setup"] as const;
type ViewKey = (typeof VIEWS)[number];

const LABELS: Record<ViewKey, string> = {
  overview: "Observatory",
  readings: "Readings",
  activity: "Activity",
  reports: "Reports",
  setup: "Setup",
};
const ICONS: Record<ViewKey, React.ReactNode> = {
  overview: <IconOverview />,
  readings: <IconReadings />,
  activity: <IconActivity />,
  reports: <IconReports />,
  setup: <IconSetup />,
};

function route(): ViewKey {
  const hash = window.location.hash.replace("#", "") as ViewKey;
  return VIEWS.includes(hash) ? hash : "overview";
}

export default function App() {
  const live = useLive();
  const [view, setView] = useState<ViewKey>(route);
  const [mode, setMode] = useState<"day" | "night">(
    () => (localStorage.getItem("avatar-mode") as "day" | "night") || "day",
  );

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem("avatar-mode", mode);
    document.documentElement.style.setProperty(
      "--bg",
      mode === "night" ? "#0d130f" : "#eef0e9",
    );
    document.documentElement.style.setProperty(
      "--card",
      mode === "night" ? "#15201a" : "#ffffff",
    );
    document.documentElement.style.setProperty(
      "--inset",
      mode === "night" ? "#1a2620" : "#f4f6ef",
    );
    document.documentElement.style.setProperty(
      "--ink",
      mode === "night" ? "#e7f1e5" : "#14231b",
    );
    document.documentElement.style.setProperty(
      "--ink-2",
      mode === "night" ? "#a9bba7" : "#4c584c",
    );
    document.documentElement.style.setProperty(
      "--ink-3",
      mode === "night" ? "#71826f" : "#8a9484",
    );
    document.documentElement.style.setProperty(
      "--line",
      mode === "night" ? "rgba(231,241,229,.08)" : "rgba(20,35,27,.08)",
    );
    document.documentElement.style.setProperty(
      "--line-2",
      mode === "night" ? "rgba(231,241,229,.18)" : "rgba(20,35,27,.16)",
    );
    document.documentElement.style.setProperty(
      "--shadow",
      mode === "night"
        ? "0 14px 40px rgba(0,0,0,.4)"
        : "0 14px 40px rgba(20,35,27,.08)",
    );
  }, [mode]);

  useEffect(() => {
    const onHash = () => setView(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: ViewKey) => {
    window.location.hash = v;
    setView(v);
  };

  const signOut = async () => {
    try {
      await api("/api/auth/session", { method: "DELETE" });
    } catch {
      /* clearing anyway */
    }
    window.location.href = "/auth/?logout=1";
  };

  const setupIncomplete = Boolean(live.farm && !live.farm.deviceSyncedAt);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => go("overview")}>
          <span className="glyph">
            <BrandGlyph />
          </span>
          <span>
            <span className="word">
              avatar<i>.</i>
            </span>
            <span className="tag">Your field, connected</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          <span className="nav-label">Menu</span>
          {VIEWS.map((key) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => go(key)}
            >
              {ICONS[key]}
              {LABELS[key]}
              {key === "setup" && setupIncomplete && (
                <span className="count">setup</span>
              )}
            </button>
          ))}
        </nav>

        <div className="side-card">
          <span className="sc-title">
            <span className="dot" />
            {live.fs.fresh && live.connected
              ? "Field unit live"
              : "Field unit quiet"}
          </span>
          <p>
            {live.fs.fresh && live.connected
              ? "Streaming observations over a secure WebSocket. Protection limits run locally either way."
              : "No fresh stream right now. The ESP32 keeps enforcing fire and irrigation limits on its own."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "0 4px" }}>
          <button
            className="round-btn"
            style={{ width: "100%", borderRadius: 13, gap: 8, display: "flex" }}
            onClick={() => setMode(mode === "day" ? "night" : "day")}
            aria-label="Toggle day/night"
          >
            {mode === "day" ? <IconMoon size={15} /> : <IconSun size={15} />}
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {mode === "day" ? "Night" : "Day"}
            </span>
          </button>
          <button
            className="round-btn"
            onClick={() => void signOut()}
            aria-label="Sign out"
          >
            <IconLogout size={15} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="quiet num" style={{ fontSize: 12 }}>
            {new Date(live.now).toLocaleDateString([], {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
          <span
            className={`badge ${live.fs.fresh && live.connected ? "good" : "neutral"}`}
            style={{ marginLeft: "auto" }}
          >
            {live.fs.fresh ? (live.connected ? "Live stream" : "Fresh") : "Stale"}
          </span>
          <button
            className="round-btn"
            onClick={() => void live.refresh()}
            aria-label="Refresh"
          >
            <IconRefresh size={15} />
          </button>
        </header>

        <main className="content" key={view}>
          {view === "overview" && <Overview live={live} onNavigate={go} />}
          {view === "readings" && <Readings live={live} />}
          {view === "activity" && <Activity live={live} />}
          {view === "reports" && <Reports live={live} />}
          {view === "setup" && <Setup live={live} />}
        </main>
      </div>
    </div>
  );
}
