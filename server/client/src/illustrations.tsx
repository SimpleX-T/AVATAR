// Faux-3D isometric illustration sprites, hand-built to match the
// cockpit palette. Layered gradients + soft ground shadows give the
// depth; everything is inline SVG so it renders instantly offline.

export function GreenhouseScene({ width = 440 }: { width?: number }) {
  return (
    <svg
      width={width}
      viewBox="0 0 520 360"
      fill="none"
      role="img"
      aria-label="Isometric greenhouse with planted beds, a sensor probe and the field controller"
    >
      <defs>
        <linearGradient id="gh-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9f2e2" />
          <stop offset="1" stopColor="#a8dcc0" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="gh-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2c5a44" />
          <stop offset="1" stopColor="#1d4a38" />
        </linearGradient>
        <linearGradient id="gh-bed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a36" />
          <stop offset="1" stopColor="#6e4327" />
        </linearGradient>
        <linearGradient id="gh-plant" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd66a" />
          <stop offset="1" stopColor="#2e9e4f" />
        </linearGradient>
        <linearGradient id="gh-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6e50" />
          <stop offset="1" stopColor="#1b3f2f" />
        </linearGradient>
        <linearGradient id="gh-stake" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8eef0" />
          <stop offset="1" stopColor="#b9cdd2" />
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="258" cy="312" rx="228" ry="34" fill="#14352a" opacity="0.12" />

      {/* bed base — isometric slab */}
      <path d="M120 250 L300 316 L452 246 L272 182 Z" fill="#5c3b22" />
      <path d="M120 250 L300 316 L300 334 L120 268 Z" fill="#4a2f1b" />
      <path d="M300 316 L452 246 L452 264 L300 334 Z" fill="#3e2815" />
      <path d="M132 248 L300 312 L440 248 L272 186 Z" fill="url(#gh-bed)" />

      {/* plants */}
      {[
        [180, 246],
        [232, 266],
        [284, 286],
        [336, 264],
        [388, 244],
      ].map(([x, y], i) => (
        <g key={i}>
          <path
            d={`M${x} ${y} c -3 -16 -14 -22 -20 -24 c 10 -2 18 4 20 10 c 2 -12 10 -18 22 -20 c -6 10 -8 16 -8 24 z`}
            fill="url(#gh-plant)"
          />
          <circle cx={x - 12} cy={y - 18} r="7" fill="#5fc163" />
          <circle cx={x + 8} cy={y - 22} r="9" fill="#4cb857" />
        </g>
      ))}

      {/* glass house frame over the right half */}
      <g>
        <path d="M300 210 L394 130 L488 210 L488 264 L300 264 Z" fill="url(#gh-glass)" opacity="0.82" />
        <path d="M300 210 L394 130 L488 210" stroke="#2c5a44" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M300 210 L488 210" stroke="#2c5a44" strokeWidth="6" strokeLinecap="round" />
        <path d="M300 210 L300 264 M488 210 L488 264" stroke="#2c5a44" strokeWidth="6" strokeLinecap="round" />
        <path d="M394 130 L394 168 M348 190 L348 264 M440 190 L440 264 M300 238 L488 238" stroke="#ffffff" strokeWidth="3.4" opacity="0.75" />
        {/* sheen */}
        <path d="M310 205 L380 140 L404 140 L322 214 Z" fill="#ffffff" opacity="0.4" />
      </g>

      {/* sensor stake */}
      <g>
        <rect x="236" y="180" width="7" height="72" rx="3.5" fill="url(#gh-stake)" />
        <circle cx="239.5" cy="176" r="9" fill="#1eaa54" />
        <circle cx="239.5" cy="176" r="4" fill="#a8e063" />
        <path d="M243 210 c 12 -4 20 -12 24 -24" stroke="#8a9484" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="1 6" />
      </g>

      {/* controller box */}
      <g>
        <path d="M96 236 L140 220 L184 236 L184 268 L140 286 L96 268 Z" fill="url(#gh-box)" />
        <path d="M96 236 L140 252 L140 286 L96 268 Z" fill="#142e22" />
        <path d="M140 252 L184 236 L184 268 L140 286 Z" fill="#244f3a" />
        <circle cx="118" cy="252" r="3.4" fill="#7fe08d">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="130" cy="247" r="3.4" fill="#a8e063" />
        <rect x="146" y="248" width="26" height="6" rx="3" fill="#7fd66a" opacity="0.5" />
        {/* cable */}
        <path d="M140 270 c 22 10 34 8 44 2" stroke="#a8e063" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      </g>

      {/* floating droplet + flame chips */}
      <g>
        <circle cx="470" cy="88" r="26" fill="#ffffff" opacity="0.9" />
        <path d="M470 74 c 8 9 12 13 12 19 a 12 12 0 1 1 -24 0 c 0 -6 4 -10 12 -19z" fill="#3d8fbc" />
        <circle cx="470" cy="94" r="5" fill="#ffffff" opacity="0.7" />
      </g>
      <g>
        <circle cx="64" cy="96" r="24" fill="#ffffff" opacity="0.9" />
        <path
          d="M64 82 c 7 6 10 10 10 15 a 10 10 0 1 1 -20 0 c 0 -5 3 -9 10 -15z"
          fill="#e5484d"
          transform="rotate(8 64 96)"
        />
      </g>
    </svg>
  );
}

export function WaitingGrove({ width = 220 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 240 200" fill="none" role="img" aria-label="A young sprout waiting for its first reading">
      <defs>
        <linearGradient id="wg-leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fdf74" />
          <stop offset="1" stopColor="#2e9e4f" />
        </linearGradient>
        <linearGradient id="wg-pot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9a06a" />
          <stop offset="1" stopColor="#a3764a" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="176" rx="74" ry="14" fill="#14352a" opacity="0.12" />
      <path d="M84 128 h72 l-8 46 a 8 8 0 0 1 -8 7 h-40 a 8 8 0 0 1 -8 -7 z" fill="url(#wg-pot)" />
      <rect x="78" y="120" width="84" height="14" rx="7" fill="#b98955" />
      <path d="M120 122 c 0 -30 -2 -44 -22 -58 c 20 -4 34 6 38 22 c 2 -16 14 -26 30 -28 c -10 14 -14 24 -14 40 c 0 10 0 18 -2 24 z" fill="url(#wg-leaf)" />
      <circle cx="96" cy="56" r="5" fill="#a8e063" opacity="0.8" />
      <circle cx="152" cy="44" r="7" fill="#7fd66a" opacity="0.7" />
      <circle cx="184" cy="66" r="4" fill="#c2eda4" />
      <g className="wiggle-slow">
        <circle cx="120" cy="30" r="4" fill="#8a9484" opacity="0.7" />
        <circle cx="136" cy="24" r="4" fill="#8a9484" opacity="0.5" />
        <circle cx="152" cy="20" r="4" fill="#8a9484" opacity="0.3" />
      </g>
    </svg>
  );
}

export function QuietField({ width = 240 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 260 200" fill="none" role="img" aria-label="The field controller asleep, waiting to reconnect">
      <defs>
        <linearGradient id="qf-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f6e50" />
          <stop offset="1" stopColor="#1b3f2f" />
        </linearGradient>
      </defs>
      <ellipse cx="130" cy="170" rx="86" ry="14" fill="#14352a" opacity="0.12" />
      <path d="M70 130 L130 106 L190 130 L190 156 L130 182 L70 156 Z" fill="url(#qf-box)" />
      <path d="M70 130 L130 154 L130 182 L70 156 Z" fill="#142e22" />
      <path d="M130 154 L190 130 L190 156 L130 182 Z" fill="#244f3a" />
      <circle cx="104" cy="146" r="4" fill="#5c6f61" />
      <circle cx="118" cy="141" r="4" fill="#5c6f61" />
      {/* sleeping cable */}
      <path d="M130 168 c 26 12 44 6 52 -6 c 6 -10 -2 -16 -10 -12" stroke="#8a9484" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* zzz */}
      <g fill="#8a9484" fontFamily="var(--font-mono)" fontWeight="600">
        <text x="196" y="84" fontSize="18" opacity="0.75">z</text>
        <text x="212" y="66" fontSize="24" opacity="0.55">z</text>
        <text x="232" y="46" fontSize="30" opacity="0.35">z</text>
      </g>
      <circle cx="58" cy="70" r="16" fill="#ffffff" opacity="0.85" />
      <path d="M52 70 h12 M58 64 v12" stroke="#a8b8a6" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function ProbeHiccup({ width = 230 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 250 200" fill="none" role="img" aria-label="A probe cable that came loose">
      <defs>
        <linearGradient id="ph-probe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8eef0" />
          <stop offset="1" stopColor="#b9cdd2" />
        </linearGradient>
      </defs>
      <ellipse cx="125" cy="172" rx="82" ry="13" fill="#14352a" opacity="0.12" />
      <rect x="66" y="70" width="10" height="86" rx="5" fill="url(#ph-probe)" />
      <circle cx="71" cy="64" r="12" fill="#e5484d" />
      <circle cx="71" cy="64" r="5" fill="#ffd6d2" />
      {/* loose end */}
      <path d="M76 140 c 30 22 52 18 66 4 c 10 -10 4 -22 -8 -20" stroke="#8a9484" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <circle cx="140" cy="122" r="7" fill="none" stroke="#d99a06" strokeWidth="3" />
      <g stroke="#d99a06" strokeWidth="2.6" strokeLinecap="round">
        <path d="M152 106 l6 -8" />
        <path d="M160 118 l10 -4" />
        <path d="M158 132 l8 6" />
      </g>
      <path d="M60 156 h-24 m8 8 h-14" stroke="#c2d1c4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
