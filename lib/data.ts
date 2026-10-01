import "server-only";
import { buildHours, darkWindow, kpAt, summarizeNights, type Hour, type Night } from "./forecast";
import { kpAlert, localK, OULU, SPOTS, sunAltitude, visibilityScore } from "./oulu";
import {
  ovationNear,
  parse27Day,
  parseFmiSeries,
  parseKpForecast,
  parseRtsw,
  stationRanges,
  type KpBin,
  type Point,
} from "./parse";

const SWPC = "https://services.swpc.noaa.gov";
const FMI = "https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=";

// FMI magnetometers either side of Oulu (Sodankylä is not in FMI open data).
const MAG_STATIONS = [
  { id: "OUJ", name: "Oulujärvi", lat: 64.5107, lon: 27.2267 },
  { id: "RAN", name: "Ranua", lat: 65.89567, lon: 26.40917 },
];

export const SOURCES = {
  kp: { name: "NOAA SWPC · Kp 3-day forecast", url: `${SWPC}/products/noaa-planetary-k-index-forecast.json` },
  wind: { name: "NOAA SWPC · real-time solar wind", url: `${SWPC}/json/rtsw/rtsw_wind_1m.json` },
  mag: { name: "NOAA SWPC · interplanetary magnetic field", url: `${SWPC}/json/rtsw/rtsw_mag_1m.json` },
  outlook: { name: "NOAA SWPC · 27-day outlook", url: `${SWPC}/text/27-day-outlook.txt` },
  ovation: { name: "NOAA SWPC · OVATION aurora model", url: `${SWPC}/json/ovation_aurora_latest.json` },
  cloud: { name: "FMI · cloud cover forecast", url: `${FMI}fmi::forecast::edited::weather::scandinavia::point::simple` },
  ground: { name: "FMI · magnetometers (Oulujärvi, Ranua)", url: `${FMI}fmi::observations::magnetometer::simple` },
} as const;

type SourceId = keyof typeof SOURCES;

async function get<T>(url: string, as: "json" | "text"): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (as === "json" ? res.json() : res.text()) as Promise<T>;
}

/** One failing source must not take the page down — it shows as "unavailable". */
async function safe<T>(id: SourceId, fn: () => Promise<T>, status: Record<string, boolean>): Promise<T | null> {
  try {
    const v = await fn();
    status[id] = true;
    return v;
  } catch (e) {
    console.error(`[aurora] ${id} failed:`, e);
    status[id] = false;
    return null;
  }
}

const hourIso = (ms: number) => new Date(Math.floor(ms / 3600000) * 3600000).toISOString().replace(".000", "");
const latest = (pts: Point[] | null) => pts?.at(-1)?.value ?? null;
const every = (pts: Point[], n: number) => pts.filter((_, i) => i % n === 0 || i === pts.length - 1);

export type AuroraData = Awaited<ReturnType<typeof getAuroraData>>;

/** Fetches every source in parallel and computes the forecast. Runs at build time (rebuilt every ~30 min). */
export async function getAuroraData() {
  const now = new Date();
  const status: Record<string, boolean> = {};
  const magStart = new Date(now.getTime() - 60 * 60000).toISOString().slice(0, 16) + ":00Z";
  const cloudQuery = SPOTS.map((s) => `latlon=${s.lat},${s.lon}`).join("&");

  const [kpBins, speed, bz, outlook, ovation, cloudSeries, ground] = await Promise.all([
    safe("kp", async () => parseKpForecast(await get(SOURCES.kp.url, "json")), status),
    safe("wind", async () => parseRtsw(await get(SOURCES.wind.url, "json"), "proton_speed", now, 120), status),
    safe("mag", async () => parseRtsw(await get(SOURCES.mag.url, "json"), "bz_gsm", now, 120), status),
    safe("outlook", async () => parse27Day(await get(SOURCES.outlook.url, "text")), status),
    safe("ovation", async () => ovationNear(await get(SOURCES.ovation.url, "json"), OULU.lon, OULU.lat), status),
    safe("cloud", async () => parseFmiSeries(await get(`${SOURCES.cloud.url}&${cloudQuery}&parameters=TotalCloudCover`, "text")), status),
    safe("ground", async () => {
      const xml = await get<string>(`${SOURCES.ground.url}&parameters=MAGNX_PT1M_AVG&timestep=1&starttime=${magStart}`, "text");
      return stationRanges(parseFmiSeries(xml), MAG_STATIONS, now, 60);
    }, status),
  ]);

  // Cloud series per spot. FMI's forecast starts at the next full hour; reuse it for the current hour.
  const clouds: Record<string, Point[]> = {};
  for (const spot of SPOTS) {
    const s = cloudSeries?.find((x) => Math.abs(x.lat - spot.lat) < 0.01 && Math.abs(x.lon - spot.lon) < 0.01);
    if (!s?.points.length) continue;
    clouds[spot.id] = [{ time: hourIso(now.getTime()), value: s.points[0].value }, ...s.points];
  }
  const cloudNow = (id: string) => clouds[id]?.[0].value ?? null;

  const bins: KpBin[] = kpBins ?? [];
  const kpNow = kpAt(bins, now);
  const groundK = ground?.length ? Math.max(...ground.map((g) => localK(g.rangeNt))) : null;
  // Nowcast: global Kp, raised if the magnetometers next to Oulu show local activity.
  const effectiveKp = Math.max(kpNow ?? 0, groundK ?? 0);
  const sunAlt = sunAltitude(now, OULU.lat, OULU.lon);

  const hours: Hour[] = buildHours({ from: now, count: 72, kpBins: bins, spots: SPOTS, clouds });
  const nights: Night[] = summarizeNights(hours);

  const spots = SPOTS.map((spot) => ({
    ...spot,
    cloud: cloudNow(spot.id),
    now: visibilityScore({ kp: effectiveKp, minKp: spot.minKp, cloud: cloudNow(spot.id), sunAlt }),
    // This spot's best window over the next 3 nights.
    best: summarizeNights(buildHours({ from: now, count: 72, kpBins: bins, spots: [spot], clouds }))
      .reduce<Night | null>((a, n) => (!a || n.peak > a.peak ? n : a), null),
  }));

  return {
    generatedAt: now.toISOString(),
    now: {
      kp: kpNow,
      effectiveKp,
      alert: kpAlert(effectiveKp),
      sunAlt,
      dark: darkWindow(now),
      speed: latest(speed),
      bz: latest(bz),
      cloudCity: cloudNow("kuusisaari"),
      groundK,
      ground: ground ?? [],
      ovation,
    },
    hours,
    nights,
    spots,
    kpBins: bins.filter((b) => Date.parse(b.start) > now.getTime() - 24 * 3600000),
    outlook: outlook?.filter((d) => d.date >= now.toISOString().slice(0, 10)) ?? [],
    wind: { speed: every(speed ?? [], 5), bz: every(bz ?? [], 5) },
    sources: (Object.keys(SOURCES) as SourceId[]).map((id) => ({ ...SOURCES[id], ok: status[id] ?? false })),
  };
}
