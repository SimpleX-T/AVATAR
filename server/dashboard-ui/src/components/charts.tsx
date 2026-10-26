// Charts in the cockpit language: rounded bar chart with hatched gap
// bars, donut gauge, sparklines.

import { useMemo, useState } from "react";

interface Point {
  at: number;
  value: number;
}

export function Sparkline({
  points,
  id,
  height = 36,
}: {
  points: Point[];
  id: string;
  height?: number;
}) {
  const d = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * 100;
        const y = 30 - ((p.value - min) / span) * 26;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points]);

  if (!d) return <div style={{ height }} />;
  return (
    <svg
      viewBox="0 0 100 34"
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--green)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L100,34 L0,34 Z`} fill={`url(#spark-${id})`} />
      <path
        d={d}
        fill="none"
        stroke="var(--green)"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Rounded-bar chart with a hatched bar wherever a reading is missing —
// gaps are drawn, never skipped.
export function BarChart({
  points,
  unit,
  stale,
}: {
  points: Point[];
  unit: string;
  stale?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  void hover;
  const model = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.value);
    const max = Math.max(...values, 1);
    return { max: max * 1.15, points };
  }, [points]);

  if (!model)
    return (
      <div className="empty">
        Recordings land here as rounded bars — gaps appear hatched, never
        hidden.
      </div>
    );

  const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1));
  const slots: { value: number | null; at: number }[] = model.points.map(
    (p) => ({ value: p.value, at: p.at }),
  );
  if (stale) slots.push({ value: null, at: Date.now() });

  return (
    <div className="bar-chart" role="img" aria-label="observation chart">
      {slots.map((slot, i) => {
        const h =
          slot.value === null
            ? 30
            : Math.max((slot.value / model.max) * 100, 6);
        return (
          <div
            key={i}
            className={`bar-col ${slot.value === null ? "gap" : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className="bar"
              style={{ height: `${h}%` }}
            >
              <span className="bar-val">
                {slot.value === null
                  ? "no data"
                  : `${fmt(slot.value)}${unit}`}
              </span>
            </div>
            <span className="bar-x">
              {new Date(slot.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Donut gauge with center percentage and a legend underneath.
export function Donut({
  percent,
  caption,
  legend,
}: {
  percent: number;
  caption: string;
  legend: { label: string; color: string; count: number }[];
}) {
  const R = 80;
  const CIRC = 2 * Math.PI * R;
  const clamped = Math.min(Math.max(percent / 100, 0), 1);
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="var(--inset)"
            strokeWidth="22"
          />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="var(--green)"
            strokeWidth="22"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * clamped} ${CIRC}`}
            style={{ transition: "stroke-dasharray 700ms var(--ease)" }}
          />
          <circle
            cx="100"
            cy="100"
            r={R - 26}
            fill="none"
            stroke="var(--lime)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * 0.7 * clamped} ${CIRC}`}
            opacity="0.55"
            style={{ transition: "stroke-dasharray 900ms var(--ease)" }}
          />
        </svg>
        <div className="donut-center">
          <span className="pct">{Math.round(percent)}%</span>
          <span className="cap">{caption}</span>
        </div>
      </div>
      <div className="legend" style={{ maxWidth: 220 }}>
        {legend.map((l) => (
          <span className="lg-row" key={l.label}>
            <span className="swatch" style={{ background: l.color }} />
            {l.label}
            <span className="num" style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
              {l.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
