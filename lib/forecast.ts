// Combines Kp forecast, cloud forecast and darkness into hourly scores and per-night summaries.
import { auroraFactor, darknessFactor, OULU, SPOTS, sunAltitude, visibilityScore, type Spot } from "./oulu";
import type { KpBin, Point } from "./parse";

const HOUR = 3600000;

export function kpAt(bins: KpBin[], t: Date): number | null {
  const ms = t.getTime();
  const bin = bins.find((b) => ms >= Date.parse(b.start) && ms < Date.parse(b.start) + 3 * HOUR);
  return bin?.kp ?? null;
}

export type Hour = { time: string; kp: number; sunAlt: number; spotId: string; score: number; cloud: number | null };

export function buildHours(p: {
  from: Date;
  count: number;
  kpBins: KpBin[];
  spots: Spot[];
  clouds: Record<string, Point[]>;
}): Hour[] {
  const start = Math.floor(p.from.getTime() / HOUR) * HOUR;
  const hours: Hour[] = [];
  for (let i = 0; i < p.count; i++) {
    const t = new Date(start + i * HOUR);
    const kp = kpAt(p.kpBins, t);
    if (kp === null) continue;
    const iso = t.toISOString().replace(".000", "");
    const sunAlt = sunAltitude(t, OULU.lat, OULU.lon);
    let best: Hour | null = null;
    for (const spot of p.spots) {
      const cloud = p.clouds[spot.id]?.find((c) => c.time === iso)?.value ?? null;
      const score = visibilityScore({ kp, minKp: spot.minKp, cloud, sunAlt });
      if (!best || score > best.score) best = { time: iso, kp, sunAlt, spotId: spot.id, score, cloud };
    }
    if (best) hours.push(best);
  }
  return hours;
}

export type Night = {
  /** Local (Helsinki) date of the evening the night starts. */
  date: string;
  peak: number;
  start: string;
  end: string;
  spotId: string;
  kp: number;
  cloud: number | null;
  /** What holds the night back most. */
  limit: "clouds" | "activity";
};

const nightKey = new Intl.DateTimeFormat("en-CA", { timeZone: OULU.tz });
/** Which night (local evening date) an hour belongs to. */
export const nightOf = (iso: string) => nightKey.format(new Date(Date.parse(iso) - 12 * HOUR));
const DARKEST_MIN_KP = Math.min(...SPOTS.map((s) => s.minKp));

export function summarizeNights(hours: Hour[]): Night[] {
  const groups = new Map<string, Hour[]>();
  for (const h of hours) {
    if (darknessFactor(h.sunAlt) === 0) continue;
    const key = nightOf(h.time);
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  return [...groups].map(([date, hs]) => {
    const peakIdx = hs.reduce((bi, h, i) => (h.score > hs[bi].score ? i : bi), 0);
    const peak = hs[peakIdx];
    let a = peakIdx;
    let b = peakIdx;
    const keep = (h?: Hour) => h && h.score >= peak.score * 0.7;
    while (keep(hs[a - 1])) a--;
    while (keep(hs[b + 1])) b++;
    const clear = 1 - (peak.cloud ?? 50) / 100;
    return {
      date,
      peak: peak.score,
      start: hs[a].time,
      end: new Date(Date.parse(hs[b].time) + HOUR).toISOString().replace(".000", ""),
      spotId: peak.spotId,
      kp: Math.max(...hs.map((h) => h.kp)),
      cloud: peak.cloud,
      limit: clear < auroraFactor(peak.kp, DARKEST_MIN_KP) ? "clouds" : "activity",
    };
  });
}

/** Current or next period with the sun below -12°, or null (light summer nights). */
export function darkWindow(now: Date): { start: string; end: string } | null {
  const STEP = 5 * 60000;
  const isDark = (ms: number) => sunAltitude(new Date(ms), OULU.lat, OULU.lon) < -12;
  let t = now.getTime();
  const limit = t + 36 * HOUR;
  while (t < limit && !isDark(t)) t += STEP;
  if (t >= limit) return null;
  const start = t;
  while (isDark(t)) t += STEP;
  return { start: new Date(start).toISOString(), end: new Date(t).toISOString() };
}

export type Verdict = "now" | "tonight" | "maybe" | "unlikely" | "bright";

/** The one-word answer for the hero: should I go out? */
export function verdict(p: { nowScore: number; sunAlt: number; tonight: Night | null }): Verdict {
  if (p.sunAlt < -6 && p.nowScore >= 35) return "now";
  if (!p.tonight) return "bright";
  if (p.tonight.peak >= 35) return "tonight";
  if (p.tonight.peak >= 15) return "maybe";
  return "unlikely";
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

/** Human label for a night; the "day" rolls over at 06:00 local, so 03:00 still counts as tonight. */
export function nightLabel(date: string, now: Date): string {
  const today = nightKey.format(new Date(now.getTime() - 6 * HOUR));
  const days = Math.round((Date.parse(date) - Date.parse(today)) / (24 * HOUR));
  if (days < 0) return "Before dawn";
  if (days === 0) return "Tonight";
  if (days === 1) return "Tomorrow night";
  return `${weekday.format(new Date(date))} night`;
}

/** Runs of consecutive Kp 4+ days from the 27-day outlook. */
export function outlookHighlights(days: { date: string; kp: number }[]) {
  const out: { from: string; to: string; kp: number }[] = [];
  for (const d of days) {
    if (d.kp < 4) continue;
    const last = out.at(-1);
    if (last && Date.parse(d.date) - Date.parse(last.to) === 24 * HOUR) {
      last.to = d.date;
      last.kp = Math.max(last.kp, d.kp);
    } else out.push({ from: d.date, to: d.date, kp: d.kp });
  }
  return out;
}
