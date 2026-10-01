// Pure parsers for NOAA SWPC and FMI open-data formats.

export type KpBin = { start: string; kp: number; kind: "observed" | "estimated" | "predicted"; scale: string | null };
export type Point = { time: string; value: number };
export type Series = { lat: number; lon: number; points: Point[] };

const utc = (tag: string) => (tag.endsWith("Z") ? tag : `${tag}Z`);

type KpRow = { time_tag: string; kp: number; observed: string; noaa_scale: string | null };

export function parseKpForecast(rows: KpRow[]): KpBin[] {
  return rows.map((r) => ({
    start: utc(r.time_tag),
    kp: r.kp,
    kind: r.observed as KpBin["kind"],
    scale: r.noaa_scale,
  }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parse27Day(text: string): { date: string; ap: number; kp: number }[] {
  const out = [];
  for (const m of text.matchAll(/^(\d{4}) (\w{3}) (\d{2})\s+\d+\s+(\d+)\s+(\d+)\s*$/gm)) {
    const month = String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0");
    out.push({ date: `${m[1]}-${month}-${m[3]}`, ap: Number(m[4]), kp: Number(m[5]) });
  }
  return out;
}

/** FMI WFS "simple" feature XML → one series per location, NaNs dropped. */
export function parseFmiSeries(xml: string): Series[] {
  const byPos = new Map<string, Series>();
  const re = /<gml:pos>([\d.-]+) ([\d.-]+)\s*<\/gml:pos>[\s\S]*?<BsWfs:Time>([^<]+)<\/BsWfs:Time>[\s\S]*?<BsWfs:ParameterValue>([^<]+)<\/BsWfs:ParameterValue>/g;
  for (const [, lat, lon, time, raw] of xml.matchAll(re)) {
    const key = `${lat} ${lon}`;
    let s = byPos.get(key);
    if (!s) byPos.set(key, (s = { lat: Number(lat), lon: Number(lon), points: [] }));
    const value = Number(raw);
    if (!Number.isNaN(value)) s.points.push({ time, value });
  }
  return [...byPos.values()];
}

export type Station = { id: string; name: string; lat: number; lon: number };

/** Max−min of each magnetometer station's series over the last `minutes`. */
export function stationRanges(series: Series[], stations: Station[], now: Date, minutes: number) {
  const since = now.getTime() - minutes * 60000;
  return stations.flatMap((st) => {
    const s = series.find((x) => Math.abs(x.lat - st.lat) < 0.01 && Math.abs(x.lon - st.lon) < 0.01);
    const pts = s?.points.filter((p) => Date.parse(p.time) >= since) ?? [];
    if (!pts.length) return [];
    const vals = pts.map((p) => p.value);
    const rangeNt = Math.round((Math.max(...vals) - Math.min(...vals)) * 10) / 10;
    return [{ id: st.id, name: st.name, rangeNt, latest: pts[pts.length - 1].time }];
  });
}

type RtswRow = { time_tag: string; active: boolean } & Record<string, unknown>;

/** NOAA real-time solar wind rows (newest-first, several spacecraft) → active spacecraft series, oldest-first. */
export function parseRtsw(rows: RtswRow[], field: string, now: Date, minutes: number): Point[] {
  const since = now.getTime() - minutes * 60000;
  return rows
    .filter((r) => r.active && typeof r[field] === "number" && Date.parse(utc(r.time_tag)) >= since)
    .map((r) => ({ time: utc(r.time_tag), value: r[field] as number }))
    .reverse();
}

/**
 * OVATION grid → aurora probability overhead and the max within sight to the north
 * (an aurora ~100 km up is visible low on the horizon from ~4° of latitude away).
 */
export function ovationNear(grid: { coordinates: number[][] }, lon: number, lat: number) {
  const lo = Math.round(lon);
  const la = Math.round(lat);
  let overhead = 0;
  let inView = 0;
  for (const [x, y, p] of grid.coordinates) {
    if (Math.abs(x - lo) > 1 || y < la || y > la + 4) continue;
    if (x === lo && y === la) overhead = p;
    inView = Math.max(inView, p);
  }
  return { overhead, inView };
}
