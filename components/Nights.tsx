import type { AuroraData } from "@/lib/data";
import { nightLabel, nightOf } from "@/lib/forecast";
import { day, hour, kp, time, TONE } from "@/lib/format";
import { scoreLabel } from "@/lib/oulu";
import { Card, Score, Section } from "./ui";

export function Nights({ data }: { data: AuroraData }) {
  const now = new Date(data.generatedAt);
  const nights = data.nights.slice(0, 3);
  if (!nights.length) return null;

  return (
    <Section id="nights" title="Next nights" hint="Hourly chance · Kp forecast × clouds × darkness">
      <div className="space-y-3">
        {nights.map((n) => {
          const hours = data.hours.filter((h) => nightOf(h.time) === n.date && h.sunAlt < -6);
          const spot = data.spots.find((s) => s.id === n.spotId)!;
          return (
            <Card key={n.date} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">
                  {nightLabel(n.date, now)} <span className="ml-1 text-sm text-faint">{day(hours[0]?.time ?? n.start)}</span>
                </h3>
                <Score value={n.peak} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {n.peak >= 15
                  ? <>Best {time(n.start)}–{time(n.end)} at {spot.name} · Kp {kp(n.kp)}</>
                  : n.limit === "clouds"
                    ? <>Cloudy{n.cloud !== null && <> ({Math.round(n.cloud)}%)</>} — auroras hide behind clouds</>
                    : <>Low activity (Kp {kp(n.kp)}) — Oulu needs about Kp 2 or more</>}
              </p>

              <div className="mt-4 flex h-14 items-end gap-[3px]" role="img"
                aria-label={`Hourly chance from ${hour(hours[0]?.time ?? n.start)}:00, peak ${n.peak} of 100`}>
                {hours.map((h) => (
                  <div key={h.time} className="group relative flex h-full flex-1 items-end">
                    <div
                      className={`w-full rounded-sm ${h.score > 0 ? TONE[scoreLabel(h.score).tone].bg : "bg-line"}`}
                      style={{ height: `${Math.max(6, h.score)}%` }}
                      title={`${time(h.time)} · chance ${h.score} · Kp ${kp(h.kp)} · clouds ${h.cloud === null ? "?" : Math.round(h.cloud)}%`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-[3px] font-mono text-[10px] text-faint">
                {hours.map((h, i) => (
                  <span key={h.time} className="flex-1 text-center">{i % 3 === 0 ? hour(h.time) : ""}</span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
