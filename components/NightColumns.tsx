"use client";

import { useState } from "react";
import type { Night } from "@/lib/forecast";
import { hour, kp, time, TONE } from "@/lib/format";
import { scoreLabel } from "@/lib/oulu";
import { Score } from "./ui";

type HourView = { time: string; score: number; kp: number; cloud: number | null; spot: string };
export type NightView = Night & { label: string; day: string; spot: string; hours: HourView[] };

const pct = (c: number | null) => (c === null ? "?" : Math.round(c));

/** Summary line for a whole night (shown until an hour is picked). */
function summary(n: NightView, full: boolean) {
  if (n.peak >= 15) return full ? `Best ${time(n.start)}–${time(n.end)} at ${n.spot} · Kp ${kp(n.kp)}` : `${time(n.start)}–${time(n.end)}`;
  if (n.limit === "clouds") return full ? `Cloudy (${pct(n.cloud)}%) — auroras hide behind clouds` : "Cloudy";
  return full ? `Low activity (Kp ${kp(n.kp)}) — Oulu needs about Kp 2+` : "Quiet";
}

/**
 * Three nights side by side. Hover (mouse) or tap a night to widen it; inside the wide one,
 * hover or tap an hour bar to read its chance, Kp, clouds and best spot.
 */
export function NightColumns({ nights }: { nights: NightView[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const reset = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setOpen(null);
    setPicked(null);
  };

  const openNight = (i: number) => {
    if (i !== open) setPicked(null);
    setOpen(i);
  };

  return (
    <div className="flex gap-2 sm:gap-3" onPointerLeave={reset}>
      {nights.map((n, i) => {
        const wide = open === i;
        const squeezed = open !== null && !wide;
        const h = wide && picked !== null ? n.hours[picked] : null;
        return (
          <div
            key={n.date}
            onPointerEnter={(e) => e.pointerType === "mouse" && openNight(i)}
            onClick={() => openNight(i)}
            className={`flex h-48 min-w-0 cursor-pointer flex-col rounded-2xl border bg-surface/70 p-3 transition-[flex-grow,border-color] duration-300 ease-out sm:p-4 ${
              wide ? "border-great/30" : "border-line"
            }`}
            style={{ flexGrow: wide ? 4 : 1, flexBasis: 0 }}
          >
            <button type="button" aria-expanded={wide} onFocus={() => openNight(i)}
              className="block w-full min-w-0 text-left focus:outline-none">
              <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span className="truncate font-medium">
                  {n.label}
                  {!squeezed && <span className="ml-1.5 hidden text-xs font-normal text-faint sm:inline">{n.day}</span>}
                </span>
                {squeezed ? (
                  <span className={`font-mono text-xs ${TONE[scoreLabel(n.peak).tone].text}`}>{n.peak}</span>
                ) : (
                  <Score value={n.peak} />
                )}
              </span>
            </button>

            <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted sm:text-sm sm:leading-5" aria-live={wide ? "polite" : undefined}>
              {squeezed ? " " : h
                ? `${time(h.time)} · ${scoreLabel(h.score).label} ${h.score} · Kp ${kp(h.kp)} · clouds ${pct(h.cloud)}% · ${h.spot}`
                : summary(n, wide)}
            </p>

            <div className="relative mt-auto h-14">
              <div className="absolute inset-0 flex items-end gap-px sm:gap-[3px]" aria-hidden>
                {n.hours.map((x, j) => (
                  <div key={x.time}
                    className={`flex-1 rounded-sm transition-opacity ${x.score > 0 ? TONE[scoreLabel(x.score).tone].bg : "bg-line"}`}
                    style={{ height: `${Math.max(6, x.score)}%`, opacity: wide && picked !== null && picked !== j ? 0.35 : 1 }} />
                ))}
              </div>
              {wide && (
                <div className="absolute inset-0 flex">
                  {n.hours.map((x, j) => (
                    <button key={x.time} type="button" className="flex-1 focus:outline-none focus-visible:bg-ink/5"
                      aria-label={`${time(x.time)}: chance ${x.score}, Kp ${kp(x.kp)}, clouds ${pct(x.cloud)}%, ${x.spot}`}
                      onPointerEnter={() => setPicked(j)} onFocus={() => setPicked(j)}
                      onClick={(e) => { e.stopPropagation(); setPicked(j); }} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-1.5 flex h-3 gap-px font-mono text-[10px] leading-3 text-faint sm:gap-[3px]" aria-hidden>
              {n.hours.map((x, j) => (
                <span key={x.time} className="flex-1 text-center">
                  {wide ? (j % 2 === 0 ? hour(x.time) : "") : !squeezed && (j === 0 || j === n.hours.length - 1) ? hour(x.time) : ""}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
