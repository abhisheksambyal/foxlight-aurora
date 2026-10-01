// Visibility model tuned for Oulu (65.0°N, ~62° geomagnetic).
// Kp 2+ → auroras likely low in the north from dark spots; Kp 4+ → visible from the city centre.

export const OULU = { lat: 65.01, lon: 25.47, tz: "Europe/Helsinki" } as const;
/** Default starting point for distances: Oulu Market Square. */
export const CITY_CENTRE = { name: "Oulu city centre", lat: 65.0135, lon: 25.4637 } as const;

export type Spot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Kp needed for a good chance here (lower = darker sky). */
  minKp: number;
  note: string;
};

export const SPOTS: Spot[] = [
  { id: "sanginjoki", name: "Sanginjoki", lat: 64.965, lon: 25.879, minKp: 2, note: "Dark countryside east of the city. Fields with open northern sky." },
  { id: "virpiniemi", name: "Virpiniemi", lat: 65.134, lon: 25.251, minKp: 2, note: "Dark seaside north of the city — wide view over the bay." },
  { id: "hailuoto", name: "Hailuoto · Marjaniemi", lat: 65.04, lon: 24.562, minKp: 2, note: "The darkest sky near Oulu. Free ferry from Oulunsalo (~1 h)." },
  { id: "letonniemi", name: "Hietasaari · Letonniemi", lat: 65.06, lon: 25.399, minKp: 3, note: "Northern tip of Hietasaari dunes. Sea horizon to the north, little light." },
  { id: "nallikari", name: "Nallikari beach", lat: 65.03, lon: 25.412, minKp: 3, note: "Easy to reach by bus or bike. Walk onto the beach, away from the lamps." },
  { id: "kuusisaari", name: "Kuusisaari", lat: 65.022, lon: 25.459, minKp: 4, note: "City-centre island park. Works only for strong displays." },
];

export type KpAlert = "quiet" | "dark-sky" | "city";

export function kpAlert(kp: number): KpAlert {
  if (kp >= 4) return "city";
  if (kp >= 2) return "dark-sky";
  return "quiet";
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0.75 at the spot's minimum Kp, 1 half a step above, 0 at 1.5 below. */
export function auroraFactor(kp: number, minKp: number): number {
  return clamp01((kp - minKp + 1.5) / 2);
}

/** 0 above -6° (too bright), 1 below -12° (dark), linear in between. */
export function darknessFactor(sunAlt: number): number {
  return clamp01((-6 - sunAlt) / 6);
}

export function visibilityScore(p: { kp: number; minKp: number; cloud: number | null; sunAlt: number }): number {
  const clear = 1 - (p.cloud ?? 50) / 100;
  return Math.round(100 * auroraFactor(p.kp, p.minKp) * clear * darknessFactor(p.sunAlt));
}

export type Tone = "great" | "good" | "maybe" | "low";

export function scoreLabel(score: number): { label: string; tone: Tone } {
  if (score >= 60) return { label: "Great", tone: "great" };
  if (score >= 35) return { label: "Good", tone: "good" };
  if (score >= 15) return { label: "Possible", tone: "maybe" };
  return { label: "Unlikely", tone: "low" };
}

// K-index lower limits for a K9 = 1000 nT station (Oulujärvi/Ranua latitude).
const K_LIMITS = [0, 10, 20, 40, 80, 140, 240, 400, 660, 1000];

/** Approximate local K from a magnetometer's H-component range (nT). */
export function localK(rangeNt: number): number {
  return K_LIMITS.findLastIndex((limit) => rangeNt >= limit);
}

const RAD = Math.PI / 180;

/** Solar altitude in degrees (NOAA low-precision formulae, ~0.1° accuracy). */
export function sunAltitude(date: Date, lat: number, lon: number): number {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15; // degrees
  const ha = (gmst + lon) * RAD - ra;
  const φ = lat * RAD;
  return Math.asin(Math.sin(φ) * Math.sin(dec) + Math.cos(φ) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const h =
    Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type RankMode = "chance" | "nearest";

/** Adds distance from `origin` and sorts: best chance (then darker, nearer) or simply nearest. */
export function rankSpots<T extends { lat: number; lon: number; minKp: number; best: { peak: number } | null }>(
  spots: T[],
  origin: { lat: number; lon: number },
  mode: RankMode,
): (T & { distanceKm: number })[] {
  const withKm = spots.map((s) => ({ ...s, distanceKm: Math.round(distanceKm(origin, s)) }));
  return withKm.sort((a, b) =>
    mode === "nearest"
      ? a.distanceKm - b.distanceKm
      : (b.best?.peak ?? 0) - (a.best?.peak ?? 0) || a.minKp - b.minKp || a.distanceKm - b.distanceKm,
  );
}

type LatLon = { lat: number; lon: number };

/**
 * Google Maps route to exact coordinates (its text search can't find several spot names).
 * Without `from`, Maps starts from the viewer's current location.
 */
export function directionsUrl(from: LatLon | null, to: LatLon): string {
  const origin = from ? `&origin=${from.lat},${from.lon}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to.lat},${to.lon}`;
}
