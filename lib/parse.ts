// Pure parsers for NOAA SWPC and FMI open-data formats.
// They validate what they read and throw on anything unexpected: a changed API format must fail loudly
// (the source shows as unavailable) instead of silently producing wrong numbers.

export type KpBin = { start: string; kp: number; kind: "observed" | "estimated" | "predicted"; scale: string | null };
export type Point = { time: string; value: number };
export type Series = { lat: number; lon: number; points: Point[] };

const utc = (tag: string) => (tag.endsWith("Z") ? tag : `${tag}Z`);
const iso = (ms: number) => new Date(ms).toISOString().replace(".000", "");
const KINDS = ["observed", "estimated", "predicted"];

type KpRow = { time_tag: string; kp: number; observed: string; noaa_scale: string | null };

export function parseKpForecast(rows: KpRow[]): KpBin[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Kp forecast: empty or not a list");
  for (const r of rows) {
    if (typeof r?.time_tag !== "string" || typeof r.kp !== "number" || !KINDS.includes(r.observed))
      throw new Error(`Kp forecast: unexpected row ${JSON.stringify(r)}`);
  }
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
  if (!out.length) throw new Error("27-day outlook: no rows found");
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
  let overhead: number | null = null;
  let inView = 0;
  for (const [x, y, p] of grid?.coordinates ?? []) {
    if (Math.abs(x - lo) > 1 || y < la || y > la + 4) continue;
    if (x === lo && y === la) overhead = p;
    inView = Math.max(inView, p);
  }
  if (overhead === null) throw new Error("OVATION: grid has no cell for Oulu");
  return { overhead, inView };
}

type RIndexFig = {
  data: { x?: string[]; customdata?: (string | number | null)[][] }[];
  layout?: { shapes?: { type: string; y0: number }[] };
};

/**
 * FMI R-index station JSON (a Plotly figure: 5-min bars, threshold lines) → the station's thresholds and
 * the strongest R in the latest 15 minutes. Data gaps (null) are skipped, never read as zero.
 */
export function parseRIndex(fig: RIndexFig) {
  const [yellow, red] = (fig?.layout?.shapes ?? []).filter((s) => s.type === "line").map((s) => s.y0).sort((a, b) => a - b);
  if (!(yellow > 0 && red > yellow)) throw new Error("R-index: threshold lines missing");
  const pts = (fig.data ?? [])
    .flatMap((t) => (t.customdata ?? []).map((c, i) => ({ time: Date.parse(t.x?.[i] ?? ""), r: c?.[1] })))
    .filter((p): p is { time: number; r: number } => typeof p.r === "number" && !Number.isNaN(p.time))
    .sort((a, b) => a.time - b.time);
  if (!pts.length) throw new Error("R-index: no data");
  const latest = pts[pts.length - 1].time;
  const r = Math.max(...pts.filter((p) => p.time > latest - 15 * 60000).map((p) => p.r));
  return { yellow, red, r: Math.round(r), time: iso(latest) };
}
