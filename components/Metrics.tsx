import type { AuroraData } from "@/lib/data";
import { kp, time, TONE } from "@/lib/format";
import type { Tone } from "@/lib/oulu";
import { Card, Section } from "./ui";

type Metric = { label: string; value: string; unit?: string; tone: Tone; status: string; meaning: string };

const LEVEL = { none: ["None", "low", "No auroral activity"], medium: ["Medium", "good", "Auroras likely (weak)"], high: ["High", "great", "Strong auroras likely"] } as const;

export function Metrics({ data }: { data: AuroraData }) {
  const n = data.now;
  const a = n.activity;
  // Why a value is missing: the source failed, or its latest reading was too old to show as "now".
  const missing = (id: string) => (data.sources.find((s) => s.id === id)?.status === "stale" ? "Data delayed" : "Unavailable");
  const metrics: Metric[] = [
    {
      label: "Kp index",
      value: kp(n.kp),
      unit: "/ 9",
      tone: (n.kp ?? 0) >= 4 ? "great" : (n.kp ?? 0) >= 2 ? "good" : "low",
      status: (n.kp ?? 0) >= 4 ? "Strong for Oulu" : (n.kp ?? 0) >= 2 ? "Enough for dark spots" : "Too quiet",
      meaning: "Global aurora activity on a 0–9 scale; higher means auroras reach further south. Oulu needs ~2 at dark spots, 4+ in town.",
    },
    {
      label: "Clouds over Oulu",
      value: n.cloudCity === null ? "–" : String(Math.round(n.cloudCity)),
      unit: "%",
      tone: n.cloudCity === null ? "low" : n.cloudCity < 30 ? "great" : n.cloudCity < 60 ? "maybe" : "low",
      status: n.cloudCity === null ? "Unavailable" : n.cloudCity < 30 ? "Mostly clear" : n.cloudCity < 60 ? "Partly cloudy" : "Cloudy",
      meaning: "Auroras are ~100 km up, far above the clouds. You need clear sky.",
    },
    {
      label: "Darkness",
      value: n.sunAlt < -12 ? "Dark" : n.dark ? time(n.dark.start) : "–",
      tone: n.sunAlt < -12 ? "great" : n.sunAlt < -6 ? "maybe" : "low",
      status: n.sunAlt < -12 ? `Until ${n.dark ? time(n.dark.end) : "dawn"}` : n.dark ? "Dark from" : "No dark nights",
      meaning: "The sky is dark enough once the sun is 12° below the horizon.",
    },
    {
      label: "Solar wind",
      value: n.speed === null ? "–" : String(Math.round(n.speed)),
      unit: "km/s",
      tone: n.speed === null ? "low" : n.speed >= 600 ? "great" : n.speed >= 450 ? "good" : "low",
      status: n.speed === null ? missing("wind") : n.speed >= 600 ? "Fast" : n.speed >= 450 ? "Elevated" : "Calm",
      meaning: "Particles streaming from the Sun. Faster than ~450 km/s powers stronger auroras.",
    },
    {
      label: "Bz (magnetic field)",
      value: n.bz === null ? "–" : n.bz.toFixed(1),
      unit: "nT",
      tone: n.bz === null ? "low" : n.bz <= -5 ? "great" : n.bz < 0 ? "good" : "low",
      status: n.bz === null ? missing("mag") : n.bz <= -5 ? "Strongly south" : n.bz < 0 ? "South" : "North",
      meaning: "Direction of the Sun's magnetic field. Negative (south) lets solar energy in; below −5 often means auroras within an hour.",
    },
    {
      label: "Auroral activity near Oulu",
      value: a ? LEVEL[a.level][0] : "–",
      tone: a ? LEVEL[a.level][1] : "low",
      status: a ? LEVEL[a.level][2] : missing("rindex"),
      meaning: `FMI's R-index from magnetometers at Oulujärvi and Ranua${a ? `, measured ${time(a.time)}` : ""} — the most direct sign of auroras over Finland right now.`,
    },
  ];

  return (
    <Section id="now" title="Right now, explained" hint="What forecasters look at">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label} className="p-5">
            <p className="text-xs text-faint">{m.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{m.value}</span>
              {m.unit && <span className="text-sm text-faint">{m.unit}</span>}
            </p>
            <p className={`mt-2 inline-flex items-center gap-2 text-sm ${TONE[m.tone].text}`}>
              <span className={`size-1.5 rounded-full ${TONE[m.tone].dot}`} />
              {m.status}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{m.meaning}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
