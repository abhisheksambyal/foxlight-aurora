import type { AuroraData } from "@/lib/data";
import { day, kp, time } from "@/lib/format";
import type { Point } from "@/lib/parse";
import { Section } from "./ui";

function KpChart({ bins, now }: { bins: AuroraData["kpBins"]; now: number }) {
  const W = 640, H = 160, top = 8, bottom = 22;
  const bw = W / bins.length;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / 9);
  const nowIdx = bins.findIndex((b) => Date.parse(b.start) + 3 * 3600000 > now);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Kp, past 24 hours and 3-day forecast">
      {bins.map((b, i) => (
        <rect key={b.start} x={i * bw + 1} y={y(b.kp)} width={bw - 2} height={Math.max(1, y(0) - y(b.kp))} rx={2}
          className={b.kp >= 4 ? "fill-great" : b.kp >= 2 ? "fill-good" : "fill-low"}
          opacity={b.kind === "predicted" ? 0.45 : 0.95}>
          <title>{`${day(b.start)} ${time(b.start)} · Kp ${kp(b.kp)} (${b.kind})`}</title>
        </rect>
      ))}
      {[2, 4].map((t) => (
        <g key={t}>
          <line x1={0} x2={W} y1={y(t)} y2={y(t)} className="stroke-ink/40" strokeDasharray="3 4" strokeWidth={1} />
          <text x={4} y={y(t) - 4} paintOrder="stroke" strokeWidth={4} className="fill-muted stroke-bg text-[10px]">
            {t === 2 ? "Kp 2 · dark spots" : "Kp 4 · city"}
          </text>
        </g>
      ))}
      {nowIdx >= 0 && <line x1={nowIdx * bw} x2={nowIdx * bw} y1={top} y2={y(0)} className="stroke-ink" strokeWidth={1} />}
      {bins.map((b, i) =>
        i === 0 || day(b.start) !== day(bins[i - 1].start) ? (
          <text key={b.start} x={i * bw + 2} y={H - 6} className="fill-faint text-[10px]">{day(b.start)}</text>
        ) : null,
      )}
    </svg>
  );
}

function Spark({ pts, label, unit, zero }: { pts: Point[]; label: string; unit: string; zero?: boolean }) {
  if (pts.length < 2) return <p className="text-sm text-faint">{label}: no data</p>;
  const W = 300, H = 60;
  const vals = pts.map((p) => p.value);
  const m = Math.max(...vals.map(Math.abs), 1);
  const [lo, hi] = zero ? [-m, m] : [Math.min(...vals) - 10, Math.max(...vals) + 10];
  const t0 = Date.parse(pts[0].time), t1 = Date.parse(pts.at(-1)!.time);
  const x = (t: string) => ((Date.parse(t) - t0) / (t1 - t0 || 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  return (
    <div>
      <p className="flex justify-between text-xs text-faint">
        <span>{label}</span>
        <span className="font-mono text-ink tabular-nums">{vals.at(-1)!.toFixed(zero ? 1 : 0)} {unit}</span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-16 w-full" preserveAspectRatio="none" role="img" aria-label={`${label}, last 2 hours`}>
        {zero && <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-line" strokeWidth={1} />}
        <polyline fill="none" className="stroke-great" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
          points={pts.map((p) => `${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")} />
      </svg>
      <p className="mt-1 flex justify-between font-mono text-[10px] text-faint">
        <span>{time(pts[0].time)}</span><span>{time(pts.at(-1)!.time)}</span>
      </p>
    </div>
  );
}

export function Advanced({ data }: { data: AuroraData }) {
  const n = data.now;
  const rows: [string, string][] = [
    ["Kp (NOAA, latest 3 h)", kp(n.kp)],
    ["Nowcast Kp (max of Kp and local K)", kp(n.effectiveKp)],
    ...n.ground.map((g): [string, string] => [`${g.name} H-range, last 60 min`, `${g.rangeNt} nT`]),
    ["OVATION probability overhead", n.ovation ? `${n.ovation.overhead}%` : "–"],
    ["OVATION max within view (north)", n.ovation ? `${n.ovation.inView}%` : "–"],
    ["Sun altitude", `${n.sunAlt.toFixed(1)}°`],
  ];

  return (
    <Section id="advanced" title="For the nerds">
      <details className="group rounded-2xl border border-line bg-surface/70">
        <summary className="flex items-center justify-between p-5 text-sm">
          <span>Raw data, charts &amp; method</span>
          <span className="text-faint transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="space-y-8 border-t border-line p-5">
          <div>
            <p className="mb-3 text-xs text-faint">Kp — past 24 h (solid) and NOAA forecast (faded), Oulu time</p>
            <KpChart bins={data.kpBins} now={Date.parse(data.generatedAt)} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Spark pts={data.wind.speed} label="Solar wind speed · 2 h" unit="km/s" />
            <Spark pts={data.wind.bz} label="Bz (GSM) · 2 h" unit="nT" zero />
          </div>

          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-2 text-sm leading-relaxed text-muted">
            <p className="text-ink">How the chance is calculated</p>
            <p>
              Each spot has a minimum Kp: 2 for dark sky, 3 for semi-dark shores, 4 for city lights. Oulu sits at ~62°
              geomagnetic latitude, where the auroral oval&apos;s southern edge appears low in the north from about Kp 2.
            </p>
            <p className="font-mono text-xs text-faint">
              chance = 100 × activity(Kp − minKp) × (1 − clouds) × darkness(sun altitude)
            </p>
            <p>
              Activity is 0.75 at the spot&apos;s minimum Kp and saturates half a step above. Darkness ramps from 0 at −6° to 1 at
              −12°. For &ldquo;now&rdquo;, Kp is raised to the local K-index measured at Oulujärvi and Ranua (1-hour range,
              K9 = 1000 nT), because the ground sees substorms hours before the 3-hour Kp does.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm text-ink">Data sources</p>
            <ul className="space-y-1 text-sm">
              {data.sources.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-muted">
                  <span className={`size-1.5 rounded-full ${s.ok ? "bg-great" : "bg-red-400"}`} />
                  {s.name}
                  {!s.ok && <span className="text-faint">— unavailable</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">
              JSON for your own tools: <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data.json`} className="text-muted underline underline-offset-4">data.json</a> · rebuilt about every 30 minutes
            </p>
          </div>
        </div>
      </details>
    </Section>
  );
}
