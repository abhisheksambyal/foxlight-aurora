import type { AuroraData } from "@/lib/data";
import { kp, time } from "@/lib/format";
import type { Point } from "@/lib/parse";
import { KpChart } from "./KpChart";
import { Section } from "./ui";
import { Term } from "./Term";

function Spark({ pts, name, label, unit, zero }: { pts: Point[]; name: string; label: React.ReactNode; unit: string; zero?: boolean }) {
  if (pts.length < 2) return <p className="text-sm text-faint">{name}: no data</p>;
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
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-16 w-full" preserveAspectRatio="none" role="img" aria-label={`${name}, last 2 hours`}>
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
  const rows: [string, React.ReactNode, string][] = [
    ["kp", <><Term k="kp">Kp</Term> (NOAA, latest 3 h)</>, kp(n.kp)],
    ["nowcast", <><Term k="nowcast">Nowcast Kp</Term> (max of Kp and FMI R-index)</>, kp(n.effectiveKp)],
    ...n.stations.map((s): [string, React.ReactNode, string] => [
      s.id,
      <>{s.name} <Term k="rIndex">R-index</Term> (yellow {s.yellow} / red {s.red})</>,
      `${s.r} at ${time(s.time)}${s.stale ? " · delayed" : ""}`,
    ]),
    ["ov1", <><Term k="ovation">OVATION</Term> probability overhead</>, n.ovation ? `${n.ovation.overhead}%` : "–"],
    ["ov2", <><Term k="ovation">OVATION</Term> max within view (north)</>, n.ovation ? `${n.ovation.inView}%` : "–"],
    ["sun", <Term key="s" k="sunAlt">Sun altitude</Term>, `${n.sunAlt.toFixed(1)}°`],
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
            <p className="mb-3 text-xs text-faint"><Term k="kp">Kp</Term> per 3-hour block — past 24 h (solid) and NOAA forecast (faded), Oulu time. Hover or tap a bar.</p>
            <KpChart bins={data.kpBins} now={Date.parse(data.generatedAt)} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Spark pts={data.wind.speed} name="Solar wind speed" label={<><Term k="solarWind">Solar wind speed</Term> · 2 h</>} unit="km/s" />
            <Spark pts={data.wind.bz} name="Bz" label={<><Term k="bz">Bz</Term> (GSM) · 2 h</>} unit="nT" zero />
          </div>

          <dl className="divide-y divide-line text-sm">
            {rows.map(([key, k, v]) => (
              <div key={key} className="flex justify-between gap-4 py-2">
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
              −12°. For &ldquo;now&rdquo;, Kp is raised by FMI&apos;s R-index at Oulujärvi and Ranua (yellow line ≈ Kp 3,
              red line ≈ Kp 5), because local substorms show up there minutes after they start — long before the
              global 3-hour Kp. Live readings older than 30 minutes are never shown as &ldquo;now&rdquo;.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm text-ink">Data sources</p>
            <ul className="space-y-1 text-sm">
              {data.sources.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-muted">
                  <span className={`size-1.5 shrink-0 rounded-full ${s.status === "ok" ? "bg-great" : s.status === "stale" ? "bg-maybe" : "bg-red-400"}`} />
                  {s.name}
                  {s.status === "stale" && <span className="text-faint">— latest reading too old, not shown as live</span>}
                  {s.status === "failed" && <span className="text-faint">— unavailable</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">
              JSON for your own tools: <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data.json`} className="text-muted underline underline-offset-4">data.json</a> · rebuilt several times an hour
            </p>
          </div>
        </div>
      </details>
    </Section>
  );
}
