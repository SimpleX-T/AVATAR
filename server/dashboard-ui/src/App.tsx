import { useEffect, useState } from "react";
import { useLive } from "./lib/useLive";
import Overview from "./views/Overview";
import Readings from "./views/Readings";
import Activity from "./views/Activity";
import Reports from "./views/Reports";
import Setup from "./views/Setup";
import {
  BrandGlyph,
  IconOverview,
  IconReadings,
  IconActivity,
  IconReports,
  IconSetup,
  IconRefresh,
  IconLogout,
  IconSun,
  IconMoon,
} from "./components/icons";
import { api } from "./lib/api";

const VIEWS = {
  overview: { label: "Overview", icon: <IconOverview /> },
  readings: { label: "Readings", icon: <IconReadings /> },
  activity: { label: "Activity", icon: <IconActivity /> },
  reports: { label: "Reports", icon: <IconReports /> },
  setup: { label: "Setup", icon: <IconSetup /> },
} as const;

type ViewKey = keyof typeof VIEWS;

function route(): ViewKey {
  const hash = window.location.hash.replace("#", "");
  return (Object.keys(VIEWS) as ViewKey[]).includes(hash as ViewKey)
    ? (hash as ViewKey)
    : "overview";
}

export default function App() {
  const live = useLive();
  const [view, setView] = useState<ViewKey>(route);
  const [theme, setTheme] = useState<"dark" | "light">(
    () =>
      (localStorage.getItem("avatar-theme") as "dark" | "light") || "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("avatar-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onHash = () => setView(route());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (hash: string) => {
    window.location.hash = hash;
    setView(route());
  };

  const signOut = async () => {
    try {
      await api("/api/auth/session", { method: "DELETE" });
    } catch {
      /* clearing anyway */
    }
    window.location.href = "/auth/?logout=1";
  };

  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const off = () => setOffline(true);
    const on = () => setOffline(false);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);

  const go = (v: ViewKey) => navigate(`#${v}`);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-glyph">
            <BrandGlyph />
          </span>
          <span>
            <span className="brand-name">AVATAR</span>
            <span className="brand-sub">Greenhouse intelligence</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
            <a
              key={key}
              href={`#${key}`}
              className={view === key ? "active" : ""}
              onClick={() => go(key)}
            >
              {VIEWS[key].icon}
              {VIEWS[key].label}
              {key === "setup" && !live.farm?.deviceSyncedAt && (
                <span className="nav-dot" aria-label="setup incomplete" />
              )}
            </a>
          ))}
        </nav>

        <div className="side-foot">
          <p className="side-note">
            Protection stays in the field. If the network drops, the ESP32
            keeps enforcing fire and irrigation limits on its own.
          </p>
          <button
            className="theme-toggle"
            onClick={() =>
              setTheme(theme === "dark" ? "light" : "dark")
            }
          >
            {theme === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
            {theme === "dark" ? "Daylight" : "Nightgrow"}
          </button>
          <button className="signout" onClick={() => void signOut()}>
            <IconLogout size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="breadcrumb">
            AVATAR&nbsp;/&nbsp;{VIEWS[view].label}
          </span>
          <span className="topbar-spacer" />
          <span
            className={`live-chip ${live.fs.fresh && live.connected ? "is-live" : ""}`}
          >
            <span className="pulse" />
            {offline
              ? "You are offline"
              : live.fs.fresh
                ? live.connected
                  ? "Live stream"
                  : "Field data fresh"
                : "Stale · reconnecting"}
          </span>
          <button
            className="ghost-btn"
            onClick={() => void live.refresh()}
            aria-label="Refresh"
          >
            <IconRefresh /> Refresh
          </button>
        </header>

        <main className="content">
          {view === "overview" && <Overview live={live} onNavigate={navigate} />}
          {view === "readings" && <Readings live={live} />}
          {view === "activity" && <Activity live={live} />}
          {view === "reports" && <Reports live={live} />}
          {view === "setup" && <Setup live={live} />}
        </main>
      </div>

      {false && <div className="toast" />}
    </div>
  );
}
