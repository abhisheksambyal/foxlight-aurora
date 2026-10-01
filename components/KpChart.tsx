"use client";

import { useState } from "react";
import { day, hour, kp, time } from "@/lib/format";
import type { KpBin } from "@/lib/parse";

const H = 9; // Kp scale
const end = (b: KpBin) => new Date(Date.parse(b.start) + 3 * 3600000).toISOString();
const fill = (v: number) => (v >= 4 ? "fill-great" : v >= 2 ? "fill-good" : "fill-low");

/** Kp bars, one per 3-hour block. Hover or tap a bar to read its time window. */
export function KpChart({ bins, now }: { bins: KpBin[]; now: number }) {
  const nowIdx = bins.findIndex((b) => Date.parse(end(b)) > now);
  const [active, setActive] = useState<number | null>(null);
  const shown = bins[active ?? nowIdx] ?? bins[0];
  if (!shown) return null;

  return (
    <div>
      <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm" aria-live="polite">
        <span className="text-faint">{active === null ? "Now" : "Selected"}</span>
        <span>{day(shown.start)}, {time(shown.start)}–{time(end(shown))}</span>
        <span className="font-mono">Kp {kp(shown.kp)}</span>
        <span className="text-xs text-faint">{shown.kind}</span>
      </p>

      <div className="relative h-36" onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}>
        <svg viewBox={`0 0 ${bins.length} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {[2, 4].map((t) => (
            <line key={t} x1={0} x2={bins.length} y1={H - t} y2={H - t} className="stroke-ink/40" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}
          {bins.map((b, i) => (
            <rect key={b.start} x={i + 0.1} width={0.8} y={H - Math.max(b.kp, 0.08)} height={Math.max(b.kp, 0.08)}
              className={`${fill(b.kp)} transition-opacity`}
              opacity={active === null ? (b.kind === "predicted" ? 0.45 : 0.95) : active === i ? 1 : 0.3} />
          ))}
          {nowIdx >= 0 && (
            <line x1={nowIdx} x2={nowIdx} y1={0} y2={H} className="stroke-ink" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <span className="pointer-events-none absolute left-1 text-[10px] text-muted" style={{ top: `calc(${((H - 4) / H) * 100}% - 15px)` }}>Kp 4 · city</span>
        <span className="pointer-events-none absolute left-1 text-[10px] text-muted" style={{ top: `calc(${((H - 2) / H) * 100}% - 15px)` }}>Kp 2 · dark spots</span>

        {/* Hit areas: one per bar, full height, so thin bars are easy to hover or tap. */}
        <div className="absolute inset-0 flex">
          {bins.map((b, i) => (
            <button key={b.start} type="button" className="flex-1 focus:outline-none focus-visible:bg-ink/5"
              aria-label={`${day(b.start)} ${time(b.start)} to ${time(end(b))}, Kp ${kp(b.kp)}, ${b.kind}`}
              onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)} />
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex font-mono text-[10px] text-faint" aria-hidden>
        {bins.map((b, i) => (
          <span key={b.start} className="flex-1 text-center">{i % 2 === 0 ? hour(b.start) : ""}</span>
        ))}
      </div>
      <div className="mt-1 flex text-[10px] text-muted" aria-hidden>
        {bins.map((b, i) => (
          <span key={b.start} className="relative flex-1">
            {(i === 0 || day(b.start) !== day(bins[i - 1].start)) && (
              <span className="absolute left-0 border-l border-line pl-1 whitespace-nowrap">{day(b.start)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
