// Minimal inline icon set (stroke = currentColor).
import React from "react";

type P = { size?: number };
const S = ({ size = 17, children }: P & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

export const IconOverview = (p: P) => (
  <S {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </S>
);

export const IconReadings = (p: P) => (
  <S {...p}>
    <path d="M4 19h16" />
    <path d="M7 16V9" />
    <path d="M12 16V5" />
    <path d="M17 16v-4" />
  </S>
);

export const IconActivity = (p: P) => (
  <S {...p}>
    <path d="M3 12h4l2.5-7 4 14 2.5-7h5" />
  </S>
);

export const IconReports = (p: P) => (
  <S {...p}>
    <path d="M7 3h8l4 4v14H7z" />
    <path d="M15 3v5h5" />
    <path d="M10 13h6M10 17h6" />
  </S>
);

export const IconSetup = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </S>
);

export const IconShield = (p: P) => (
  <S {...p}>
    <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
  </S>
);

export const IconFire = (p: P) => (
  <S {...p}>
    <path d="M12 3s5.5 4.5 5.5 9a5.5 5.5 0 0 1-11 0c0-2 1-3.8 2.2-5.2.4 1.4 1.3 2.2 2.3 2.2 1.4 0 2-1.6 1-6z" />
  </S>
);

export const IconDroplet = (p: P) => (
  <S {...p}>
    <path d="M12 3s6 6.2 6 10.2a6 6 0 0 1-12 0C6 9.2 12 3 12 3z" />
  </S>
);

export const IconWind = (p: P) => (
  <S {...p}>
    <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5" />
    <path d="M3 12h13a2.5 2.5 0 1 1-2.5 2.5" />
    <path d="M3 16h6" />
  </S>
);

export const IconThermometer = (p: P) => (
  <S {...p}>
    <path d="M10 4a2 2 0 1 1 4 0v9.3a4 4 0 1 1-4 0z" />
    <path d="M12 9v5" />
  </S>
);

export const IconSignal = (p: P) => (
  <S {...p}>
    <path d="M5 18v-3M10 18v-7M15 18V8M20 18V4" />
  </S>
);

export const IconLeaf = (p: P) => (
  <S {...p}>
    <path d="M4 20c0-9 5-14 16-16 1 11-4 16-12 16-1.5 0-3-.3-4-1z" />
    <path d="M4 20c3-6 7-9 12-11" />
  </S>
);

export const IconLogout = (p: P) => (
  <S {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </S>
);

export const IconRefresh = (p: P) => (
  <S {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </S>
);

export const IconAlert = (p: P) => (
  <S {...p}>
    <path d="M12 3 2.5 20h19z" />
    <path d="M12 10v4M12 17.5v.5" />
  </S>
);

export const IconSun = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </S>
);

export const IconMoon = (p: P) => (
  <S {...p}>
    <path d="M20 14A8.5 8.5 0 0 1 10 4a7.5 7.5 0 1 0 10 10z" />
  </S>
);

export const BrandGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20c0-9 5-14 16-16 1 11-4 16-12 16-1.5 0-3-.3-4-1z" />
    <path d="M4 20c3-6 7-9 12-11" />
  </svg>
);
