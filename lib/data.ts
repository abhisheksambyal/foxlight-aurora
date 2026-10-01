import { buildHours, darkWindow, kpAt, summarizeNights, type Hour, type Night } from "./forecast";
import { kpAlert, OULU, rIndexKp, SPOTS, sunAltitude, visibilityScore } from "./oulu";
import { ovationNear, parse27Day, parseFmiSeries, parseKpForecast, parseRIndex, parseRtsw, type Point } from "./parse";
import { withRetry } from "./retry";

const SWPC = "https://services.swpc.noaa.gov";
const FMI = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=";
const R_INDEX = "https://space.fmi.fi/image/realtime/SSA/r-index/api";

// FMI R-index stations either side of Oulu.
const R_STATIONS = [
  { id: "OUJ", name: "Oulujärvi" },
  { id: "RAN", name: "Ranua" },
];

export const SOURCES = {
  kp: { name: "NOAA SWPC · Kp 3-day forecast", url: `${SWPC}/products/noaa-planetary-k-index-forecast.json` },
  cloud: { name: "FMI · cloud cover forecast", url: `${FMI}fmi::forecast::edited::weather::scandinavia::point::simple` },
  rindex: { name: "FMI · R-index auroral activity (Oulujärvi, Ranua)", url: R_INDEX },
  wind: { name: "NOAA SWPC · real-time solar wind", url: `${SWPC}/json/rtsw/rtsw_wind_1m.json` },
  mag: { name: "NOAA SWPC · interplanetary magnetic field", url: `${SWPC}/json/rtsw/rtsw_mag_1m.json` },
  ovation: { name: "NOAA SWPC · OVATION aurora model", url: `${SWPC}/json/ovation_aurora_latest.json` },
  outlook: { name: "NOAA SWPC · 27-day outlook", url: `${SWPC}/text/27-day-outlook.txt` },
} as const;

type SourceId = keyof typeof SOURCES;
export type SourceStatus = "ok" | "stale" | "failed";

// Live readings older than this are not presented as "now".
const MAX_AGE = { wind: 30, mag: 30, rindex: 30, ovation: 180 } as const; // minutes

async function get<T>(url: string, as: "json" | "text"): Promise<T> {
  // Transient blips (timeouts, 5xx, empty replies) are common; retry twice before giving up.
  return withRetry(async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (as === "json" ? res.json() : res.text()) as Promise<T>;
  }, [2000, 5000]);
}

/** A failing optional source shows as "unavailable" instead of taking the page down. */
async function safe<T>(id: SourceId, fn: () => Promise<T>, status: Record<string, SourceStatus>): Promise<T | null> {
  try {
    const v = await fn();
    status[id] = "ok";
    return v;
  } catch (e) {
    console.error(`[aurora] ${id} failed:`, e);
    status[id] = "failed";
    return null;
  }
}

const hourIso = (ms: number) => new Date(Math.floor(ms / 3600000) * 3600000).toISOString().replace(".000", "");
const every = (pts: Point[], n: number) => pts.filter((_, i) => i % n === 0 || i === pts.length - 1);
const ageMin = (time: string, now: Date) => (now.getTime() - Date.parse(time)) / 60000;
const LEVELS = ["none", "medium", "high"] as const;
const level = (r: number, yellow: number, red: number): (typeof LEVELS)[number] => (r >= red ? "high" : r >= yellow ? "medium" : "none");

export type AuroraData = Awaited<ReturnType<typeof getAuroraData>>;

/**
 * Fetches every source in parallel and computes the forecast. Runs before each build (scripts/fetch-data.mts).
 * Throws if a critical source (Kp forecast, cloud forecast) is missing or incomplete: the build then fails and the
 * previous, correct deployment stays online (with its age shown) instead of publishing a misleading page.
 */
export async function getAuroraData() {
  const now = new Date();
  const status: Record<string, SourceStatus> = {};
  const cloudQuery = SPOTS.map((s) => `latlon=${s.lat},${s.lon}`).join("&");

  const [kpBins, cloudSeries, rIndex, speed, bz, ovation, outlook] = await Promise.all([
    safe("kp", async () => parseKpForecast(await get(SOURCES.kp.url, "json")), status),
    safe("cloud", async () => parseFmiSeries(await get(`${SOURCES.cloud.url}&${cloudQuery}&parameters=TotalCloudCover`, "text")), status),
    safe("rindex", () => Promise.all(R_STATIONS.map(async (st) => ({ ...st, ...parseRIndex(await get(`${R_INDEX}/${st.id}_en.json`, "json")) }))), status),
    safe("wind", async () => parseRtsw(await get(SOURCES.wind.url, "json"), "proton_speed", now, 120), status),
    safe("mag", async () => parseRtsw(await get(SOURCES.mag.url, "json"), "bz_gsm", now, 120), status),
    safe("ovation", async () => {
      const grid = await get<{ "Forecast Time": string; coordinates: number[][] }>(SOURCES.ovation.url, "json");
      return { ...ovationNear(grid, OULU.lon, OULU.lat), time: grid["Forecast Time"] };
    }, status),
    safe("outlook", async () => parse27Day(await get(SOURCES.outlook.url, "text")), status),
  ]);

  // ── Critical sources ───────────────────────────────────────────────────────────
  const kpNow = kpBins ? kpAt(kpBins, now) : null;
  if (!kpBins || kpNow === null) throw new Error("Critical: Kp forecast unavailable or does not cover the current time");

  // FMI's forecast starts at the next full hour; reuse it for the current hour.
  const clouds: Record<string, Point[]> = {};
  for (const spot of SPOTS) {
    const s = cloudSeries?.find((x) => Math.abs(x.lat - spot.lat) < 0.01 && Math.abs(x.lon - spot.lon) < 0.01);
    if (!s || s.points.length < 24) throw new Error(`Critical: cloud forecast missing or short for ${spot.name}`);
    clouds[spot.id] = [{ time: hourIso(now.getTime()), value: s.points[0].value }, ...s.points];
  }
  const cloudNow = (id: string) => clouds[id][0].value;

  // ── Live readings: only used as "now" when fresh ───────────────────────────────
  const fresh = (id: keyof typeof MAX_AGE, time: string | undefined) => {
    if (!time || ageMin(time, now) > MAX_AGE[id]) status[id] = "stale";
    return status[id] === "ok";
  };
  const speedNow = speed && fresh("wind", speed.at(-1)?.time) ? speed.at(-1)!.value : null;
  const bzNow = bz && fresh("mag", bz.at(-1)?.time) ? bz.at(-1)!.value : null;
  const ovationNow = ovation && fresh("ovation", ovation.time) ? ovation : null;

  const stations = (rIndex ?? []).map((s) => ({
    ...s,
    level: level(s.r, s.yellow, s.red),
    stale: ageMin(s.time, now) > MAX_AGE.rindex,
  }));
  const live = stations.filter((s) => !s.stale);
  if (rIndex && !live.length) status.rindex = "stale";
  const activity = live.length
    ? {
        level: LEVELS[Math.max(...live.map((s) => LEVELS.indexOf(s.level)))],
        kp: Math.max(...live.map((s) => rIndexKp(s.r, s.yellow, s.red))),
        time: live.map((s) => s.time).sort()[0],
      }
    : null;

  // Nowcast: global Kp, raised when FMI measures auroral activity right next to Oulu.
  const effectiveKp = Math.max(kpNow, activity?.kp ?? 0);
  const sunAlt = sunAltitude(now, OULU.lat, OULU.lon);

  const hours: Hour[] = buildHours({ from: now, count: 72, kpBins, spots: SPOTS, clouds });
  const nights: Night[] = summarizeNights(hours);

  const spots = SPOTS.map((spot) => ({
    ...spot,
    cloud: cloudNow(spot.id),
    now: visibilityScore({ kp: effectiveKp, minKp: spot.minKp, cloud: cloudNow(spot.id), sunAlt }),
    // This spot's best window over the next 3 nights.
    best: summarizeNights(buildHours({ from: now, count: 72, kpBins, spots: [spot], clouds }))
      .reduce<Night | null>((a, n) => (!a || n.peak > a.peak ? n : a), null),
  }));

  return {
    generatedAt: now.toISOString(),
    now: {
      kp: kpNow,
      effectiveKp,
      /** What sets the nowcast: the global Kp, or FMI's local measurement. */
      driver: activity && activity.kp > kpNow ? ("fmi" as const) : ("kp" as const),
      alert: kpAlert(effectiveKp),
      sunAlt,
      dark: darkWindow(now),
      speed: speedNow,
      bz: bzNow,
      cloudCity: cloudNow("kuusisaari"),
      activity,
      stations,
      ovation: ovationNow,
    },
    hours,
    nights,
    spots,
    kpBins: kpBins.filter((b) => Date.parse(b.start) > now.getTime() - 24 * 3600000),
    outlook: outlook?.filter((d) => d.date >= now.toISOString().slice(0, 10)) ?? [],
    wind: { speed: every(speed ?? [], 5), bz: every(bz ?? [], 5) },
    sources: (Object.keys(SOURCES) as SourceId[]).map((id) => ({ id, ...SOURCES[id], status: status[id] ?? "failed" })),
  };
}
