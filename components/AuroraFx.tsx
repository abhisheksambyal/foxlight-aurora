/** Kp → aurora strength: faint when quiet, vivid in a storm. */
const strength = (kp: number) => Math.min(1, 0.3 + kp * 0.12);

// Deterministic star field: one element per layer, stars as box-shadows.
const stars = (n: number, seed: number) => {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () =>
    `${Math.round(rnd() * 2000)}px ${Math.round(rnd() * 900)}px rgb(255 255 255 / ${(0.15 + rnd() * 0.45).toFixed(2)})`,
  ).join(",");
};
const STARS_SMALL = stars(110, 7);
const STARS_BIG = stars(45, 99);

const TAU = Math.PI * 2;
const P = 1200; // wave period in SVG units; each curtain is 2 periods wide and slides by 1 for a seamless loop

/**
 * A soft curtain: stacked bands that follow a slow wave, bright mint at the lower edge fading up to violet.
 * The SVG is static and blurred once; only the element's transform/opacity animate (compositor-only, no repaint).
 */
function Curtain({ base, amp, height, phase, colors, className }: {
  base: number; amp: number; height: number; phase: number; colors: string[]; className: string;
}) {
  const edge = (x: number) => base + Math.sin((x / P) * TAU * 2 + phase) * amp + Math.sin((x / P) * TAU + phase) * amp * 0.6;
  const fold = (x: number) => 0.7 + 0.3 * Math.sin((x / P) * TAU * 3 + phase);
  const xs = Array.from({ length: (2 * P) / 20 + 1 }, (_, i) => i * 20);
  const band = (k: number) => {
    const h = height / colors.length;
    const bottom = xs.map((x) => `${x},${(edge(x) - k * h * fold(x)).toFixed(1)}`);
    const top = xs.map((x) => `${x},${(edge(x) - (k + 1) * h * fold(x)).toFixed(1)}`).reverse();
    return `M${bottom.join(" L")} L${top.join(" L")} Z`;
  };
  return (
    <svg className={`fx-curtain ${className}`} viewBox={`0 0 ${2 * P} 300`} preserveAspectRatio="none" aria-hidden>
      {colors.map((c, k) => <path key={k} d={band(k)} fill={c} />)}
      <path d={`M${xs.map((x) => `${x},${edge(x).toFixed(1)}`).join(" L")}`} fill="none" stroke="#c8ffe9" strokeOpacity="0.55" strokeWidth="5" />
    </svg>
  );
}

/** Night sky behind the page: static stars plus an aurora curtain whose brightness follows the current Kp. */
export function AuroraFx({ kp }: { kp: number }) {
  return (
    <div className="fx-layer" aria-hidden>
      <span className="fx-stars" style={{ boxShadow: STARS_SMALL }} />
      <span className="fx-stars fx-stars-big" style={{ boxShadow: STARS_BIG }} />
      <div className="fx-aurora" style={{ opacity: strength(kp) }}>
        {kp >= 5 && <span className="fx-red" />}
        <Curtain className="fx-curtain-b" base={95} amp={18} height={70} phase={1.7}
          colors={["rgb(45 212 191 / 0.22)", "rgb(34 211 238 / 0.12)", "rgb(99 102 241 / 0.06)"]} />
        <Curtain className="fx-curtain-a" base={130} amp={26} height={110} phase={0}
          colors={["rgb(62 230 168 / 0.32)", "rgb(62 230 168 / 0.18)", "rgb(45 212 191 / 0.1)", "rgb(139 92 246 / 0.08)", "rgb(168 85 247 / 0.04)"]} />
      </div>
    </div>
  );
}
