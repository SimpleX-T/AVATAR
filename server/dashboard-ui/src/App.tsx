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
  IconSun,
  IconMoon,
  IconRefresh,
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

function route(): ViewKey {
  const hash = window.location.hash.replace("#", "") as ViewKey;
  return VIEWS.includes(hash) ? hash : "overview";
}

export default function App() {
  const live = useLive();
  const [view, setView] = useState<ViewKey>(route);
  const [accent, setAccent] = useState<"night" | "day">(
    () =>
      (localStorage.getItem("avatar-accent") as "night" | "day") || "night",
  );

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    localStorage.setItem("avatar-accent", accent);
  }, [accent]);

  useEffect(() => {
    const onHash = () => setView(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: ViewKey) => {
    window.location.hash = v;
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    try {
      await api("/api/auth/session", { method: "DELETE" });
    } catch {
      /* clearing anyway */
    }
    window.location.href = "/auth/?logout=1";
  };

  // Ticker content: telemetry as ambience.
  const ticks: string[] = [];
  if (live.latest) {
    ticks.push(`DEVICE ${live.latest.deviceId}`);
    ticks.push(`PROFILE ${live.latest.hardwareProfile?.toUpperCase() || "—"}`);
    if (Number.isFinite(live.latest.wifiRssi))
      ticks.push(`RSSI ${live.latest.wifiRssi} dBm`);
    if (live.fs.soilRaw !== null)
      ticks.push(`SOIL ${live.fs.soilRaw} ADC`);
    if (Number.isFinite(live.latest.readings?.temperatureC))
      ticks.push(`AIR ${live.latest.readings!.temperatureC!.toFixed(1)}°C`);
    ticks.push(
      `FIRE ${live.fs.fire[0].toUpperCase()} · WATER ${live.fs.water[0].toUpperCase()}`,
    );
    if (live.fs.outputs.lastEvent && live.fs.outputs.lastEvent !== "BOOT")
      ticks.push(`EVENT ${live.fs.outputs.lastEvent.replaceAll("_", " ")}`);
  }
  ticks.push(
    live.connected ? "STREAM CONNECTED" : "STREAM RECONNECTING",
  );
  const tickerLine = ticks.join("   ·   ");
  const setupIncomplete = live.farm && !live.farm.deviceSyncedAt;

  return (
    <>
      <div className="aurora" aria-hidden />

      <header className="masthead">
        <a className="wordmark" href="#overview" onClick={() => go("overview")}>
          <span className="glyph">
            <BrandGlyph />
          </span>
          <span>
            <span className="word">AVATAR</span>
            <span className="tag">Field observatory</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          {VIEWS.map((key, i) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => go(key)}
            >
              <span className="idx">
                {String(i + 1).padStart(2, "0")}
              </span>
              {LABELS[key]}
              {key === "setup" && setupIncomplete && " ·"}
            </button>
          ))}
        </nav>

        <div className="mast-right">
          <span className={`beacon ${live.fs.fresh && live.connected ? "live" : ""}`}>
            <span className="dot" />
            {live.fs.fresh ? (live.connected ? "LIVE" : "FRESH") : "STALE"}
          </span>
          <button
            className="icon-btn"
            onClick={() => void live.refresh()}
            aria-label="Refresh"
          >
            <IconRefresh size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={() =>
              setAccent(accent === "night" ? "day" : "night")
            }
            aria-label="Toggle theme"
          >
            {accent === "night" ? <IconSun size={15} /> : <IconMoon size={15} />}
          </button>
          <button className="link-btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="stage">
        <div className="view" key={view}>
          {view === "overview" && <Overview live={live} onNavigate={go} />}
          {view === "readings" && <Readings live={live} />}
          {view === "activity" && <Activity live={live} />}
          {view === "reports" && <Reports live={live} />}
          {view === "setup" && <Setup live={live} />}
        </div>
      </main>

      <footer className="ticker" aria-hidden>
        <span className="tick-label">Field telemetry</span>
        <div className="tick-track">
          <span>{tickerLine}</span>
          <span>{tickerLine}</span>
        </div>
      </footer>
    </>
  );
}
