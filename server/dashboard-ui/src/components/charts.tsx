// Hand-rolled SVG charts: sparkline, trend area with min/max band,
// radial gauge, and horizontal NPK bars. No chart library — full
// control over the instrument look.

import { useMemo } from "react";

interface Point {
  at: number;
  value: number;
}

function path(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}
type Pt = { x: number; y: number };

function useCssVar(name: string, fallback: string): string {
  return useMemo(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v.trim() || fallback;
    // recompute on theme change via key remount in parent
  }, [name]);
}

const VIEW_W = 100;
const VIEW_H = 40;

export function Sparkline({
  points,
  id,
}: {
  points: Point[];
  id: string;
}) {
  const stroke = useCssVar("--chart-line", "#6fe3a5");
  const d = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pts: Pt[] = points.map((p, i) => ({
      x: (i / (points.length - 1)) * VIEW_W,
      y: VIEW_H - 4 - ((p.value - min) / span) * (VIEW_H - 8),
    }));
    return path(pts);
  }, [points]);

  if (!d) return <div style={{ height: 34 }} />;
  return (
    <svg
      className="spark-svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 34, display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`} fill={`url(#spark-${id})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TrendChart({
  points,
  unit,
  height = 220,
  label,
}: {
  points: Point[];
  unit: string;
  height?: number;
  label: string;
}) {
  const stroke = useCssVar("--chart-line", "#6fe3a5");
  const grid = useCssVar("--chart-grid", "rgba(233,241,232,0.07)");
  const W = 640;
  const H = 240;
  const PAD = { l: 44, r: 14, t: 18, b: 26 };

  const model = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.18;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const span = max - min || 1;
    const x = (i: number) =>
      PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) =>
      H - PAD.b - ((v - min) / span) * (H - PAD.t - PAD.b);
    const pts: Pt[] = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
    return {
      pts,
      line: path(pts),
      min,
      max,
      rawMin,
      rawMax,
      yMin: y(min),
      yMax: y(max),
      midY: y((min + max) / 2),
      first: points[0],
      last: points[points.length - 1],
      xLast: x(points.length - 1),
      xFirst: x(0),
    };
  }, [points]);

  if (!model)
    return (
      <div className="skip-note" style={{ height }}>
        Two or more recorded observations draw the {label} trend. Missing
        values are never estimated.
      </div>
    );

  const fmt = (v: number) =>
    Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(1);
  const time = (at: number) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height, display: "block" }}
      role="img"
      aria-label={`${label} trend`}
    >
      <defs>
        <linearGradient id={`trend-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.30" />
          <stop offset="1" stopColor={stroke} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* gridlines */}
      {[model.yMax, model.midY, model.yMin].map((gy, i) => (
        <g key={i}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={gy}
            y2={gy}
            stroke={grid}
            strokeWidth="1"
          />
          <text
            x={PAD.l - 8}
            y={gy + 3.5}
            textAnchor="end"
            fontSize="10.5"
            fill="var(--ink-muted)"
            fontFamily="var(--font-mono)"
          >
            {fmt(i === 0 ? model.max : i === 1 ? (model.min + model.max) / 2 : model.min)}
            {unit}
          </text>
        </g>
      ))}

      <path
        d={`${model.line} L${model.xLast},${H - PAD.b} L${model.xFirst},${H - PAD.b} Z`}
        fill={`url(#trend-${label})`}
      />
      <path
        d={model.line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* live endpoint */}
      <circle cx={model.xLast} cy={model.pts[model.pts.length - 1].y} r="4" fill={stroke} />
      <circle
        cx={model.xLast}
        cy={model.pts[model.pts.length - 1].y}
        r="4"
        fill="none"
        stroke={stroke}
        opacity="0.45"
      >
        <animate attributeName="r" values="4;9" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite" />
      </circle>

      <text
        x={model.xFirst}
        y={H - 8}
        fontSize="10.5"
        fill="var(--ink-muted)"
        fontFamily="var(--font-mono)"
      >
        {time(model.first.at)}
      </text>
      <text
        x={model.xLast}
        y={H - 8}
        textAnchor="end"
        fontSize="10.5"
        fill="var(--ink-muted)"
        fontFamily="var(--font-mono)"
      >
        {time(model.last.at)}
      </text>
    </svg>
  );
}

export function RadialGauge({
  value,
  max = 100,
  label,
  sub,
  severity = "good",
  size = 190,
}: {
  value: number;
  max?: number;
  label: string;
  sub: string;
  severity?: "good" | "warning" | "danger";
  size?: number;
}) {
  const R = 78;
  const CIRC = 2 * Math.PI * R;
  const GAP = 0.22; // fraction of circumference left open at the bottom
  const ARC = CIRC * (1 - GAP);
  const clamped = Math.min(Math.max(value / max, 0), 1);
  const color =
    severity === "danger"
      ? "var(--danger)"
      : severity === "warning"
        ? "var(--gold)"
        : "var(--accent)";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        margin: "0 auto",
      }}
    >
      <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%" }}>
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="var(--line)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRC}`}
          transform={`rotate(${135 + (GAP * 360) / 2} 100 100)`}
        />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${ARC * clamped} ${CIRC}`}
          transform={`rotate(${135 + (GAP * 360) / 2} 100 100)`}
          style={{ transition: "stroke-dasharray 700ms var(--ease-out), stroke 300ms" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeContent: "center",
          textAlign: "center",
        }}
      >
        <div
          className="num"
          style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.03em" }}
        >
          {Math.round(value)}
          <span style={{ fontSize: 16, color: "var(--ink-muted)" }}>/ {max}</span>
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-muted)", maxWidth: 120 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

export function BarRow({
  name,
  value,
  max,
  unit,
  tint = "var(--accent)",
}: {
  name: string;
  value: number | null;
  max: number;
  unit?: string;
  tint?: string;
}) {
  const pct = value === null ? 0 : Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12.5,
        }}
      >
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span className="num" style={{ color: "var(--ink-secondary)" }}>
          {value === null ? "—" : `${value}${unit || ""}`}
        </span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: "var(--inset)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: tint,
            opacity: value === null ? 0.25 : 1,
            transition: "width 600ms var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
