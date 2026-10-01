// End-to-end tests of the data pipeline against fake versions of every API, including outages,
// outdated products and stalled feeds. The rule under test: never present a confident wrong answer.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuroraData } from "./data";
import { SPOTS } from "./oulu";

vi.mock("./retry", () => ({ withRetry: (fn: () => unknown) => fn() })); // no real waiting between retries

const NOW = new Date("2026-12-10T21:30:00Z"); // a dark December evening in Oulu
const iso = (ms: number) => new Date(ms).toISOString().replace(".000", "");
const minAgo = (m: number) => NOW.getTime() - m * 60000;

type Fake = Record<string, (() => unknown) | "down">;

function healthy(): Fake {
  const H = 3600000;
  const start = Math.floor(NOW.getTime() / (3 * H)) * 3 * H - 24 * H;
  return {
    "noaa-planetary-k-index-forecast": () =>
      Array.from({ length: 32 }, (_, i) => ({
        time_tag: iso(start + i * 3 * H).replace("Z", ""),
        kp: 1,
        observed: i < 8 ? "observed" : i === 8 ? "estimated" : "predicted",
        noaa_scale: null,
      })),
    "fmi::forecast": () =>
      SPOTS.map((s) =>
        Array.from({ length: 72 }, (_, i) => `
          <BsWfs:BsWfsElement><gml:pos>${s.lat.toFixed(5)} ${s.lon.toFixed(5)} </gml:pos>
          <BsWfs:Time>${iso(Math.ceil(NOW.getTime() / H) * H + i * H)}</BsWfs:Time>
          <BsWfs:ParameterName>TotalCloudCover</BsWfs:ParameterName><BsWfs:ParameterValue>10</BsWfs:ParameterValue></BsWfs:BsWfsElement>`).join(""),
      ).join(""),
    "r-index/api": () => rIndexFig(20, minAgo(5)),
    rtsw_wind: () => [{ time_tag: iso(minAgo(3)).replace("Z", ""), active: true, proton_speed: 420 }],
    rtsw_mag: () => [{ time_tag: iso(minAgo(3)).replace("Z", ""), active: true, bz_gsm: -2 }],
    ovation: () => ({ "Forecast Time": iso(minAgo(10)), coordinates: [[25, 65, 4], [25, 67, 12]] }),
    "27-day": () => "2026 Dec 10     100           5          2\n2026 Dec 11     100          12          4\n",
  };
}

function rIndexFig(r: number | null, time: number) {
  return {
    data: [{ x: [iso(time)], customdata: [["No activity", r]] }],
    layout: { shapes: [{ type: "line", y0: 68 }, { type: "line", y0: 200 }] },
  };
}

function serve(fake: Fake) {
  vi.stubGlobal("fetch", async (url: string) => {
    const key = Object.keys(fake).find((k) => url.includes(k));
    const handler = key ? fake[key] : "down";
    if (handler === "down") return new Response("unavailable", { status: 503 });
    const body = handler();
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });
  });
}

const status = (d: Awaited<ReturnType<typeof getAuroraData>>, id: string) => d.sources.find((s) => s.id === id)?.status;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getAuroraData", () => {
  it("builds a complete snapshot when every source is up", async () => {
    serve(healthy());
    const d = await getAuroraData();
    expect(d.sources.every((s) => s.status === "ok")).toBe(true);
    expect(d.now).toMatchObject({ kp: 1, speed: 420, bz: -2, driver: "kp" });
    expect(d.spots).toHaveLength(SPOTS.length);
    expect(d.nights.length).toBeGreaterThanOrEqual(2);
  });

  describe("critical sources: fail the build so the last correct site stays online", () => {
    it("Kp forecast down", async () => {
      serve({ ...healthy(), "noaa-planetary-k-index-forecast": "down" });
      await expect(getAuroraData()).rejects.toThrow(/Critical: Kp/);
    });
    it("Kp forecast outdated (doesn't cover now)", async () => {
      const old = healthy()["noaa-planetary-k-index-forecast"] as () => { time_tag: string }[];
      serve({ ...healthy(), "noaa-planetary-k-index-forecast": () => old().slice(0, 4) });
      await expect(getAuroraData()).rejects.toThrow(/Critical: Kp/);
    });
    it("Kp forecast in an unexpected format", async () => {
      serve({ ...healthy(), "noaa-planetary-k-index-forecast": () => [["time_tag", "kp"], ["2026-12-10 21:00:00", "1"]] });
      await expect(getAuroraData()).rejects.toThrow(/Critical: Kp/);
    });
    it("cloud forecast down", async () => {
      serve({ ...healthy(), "fmi::forecast": "down" });
      await expect(getAuroraData()).rejects.toThrow(/Critical: cloud/);
    });
    it("cloud forecast missing a viewing spot", async () => {
      const all = healthy()["fmi::forecast"] as () => string;
      serve({ ...healthy(), "fmi::forecast": () => all().replaceAll(`${SPOTS[0].lat.toFixed(5)} `, "60.00000 ") });
      await expect(getAuroraData()).rejects.toThrow(/Critical: cloud/);
    });
  });

  describe("optional sources: shown as unavailable or delayed, never as calm", () => {
    it("solar wind down → failed, no value", async () => {
      serve({ ...healthy(), rtsw_wind: "down" });
      const d = await getAuroraData();
      expect(status(d, "wind")).toBe("failed");
      expect(d.now.speed).toBeNull();
    });
    it("solar wind feed stalled (last reading 2 h old) → delayed, not shown as now", async () => {
      serve({ ...healthy(), rtsw_wind: () => [{ time_tag: iso(minAgo(120)).replace("Z", ""), active: true, proton_speed: 700 }] });
      const d = await getAuroraData();
      expect(status(d, "wind")).toBe("stale");
      expect(d.now.speed).toBeNull();
    });
    it("OVATION model run 5 h old → delayed", async () => {
      serve({ ...healthy(), ovation: () => ({ "Forecast Time": iso(minAgo(300)), coordinates: [[25, 65, 4]] }) });
      const d = await getAuroraData();
      expect(status(d, "ovation")).toBe("stale");
      expect(d.now.ovation).toBeNull();
    });
  });

  describe("FMI R-index nowcast", () => {
    it("raises the nowcast when FMI measures activity that the global Kp misses", async () => {
      serve({ ...healthy(), "r-index/api": () => rIndexFig(134, minAgo(5)) });
      const d = await getAuroraData();
      expect(d.now.kp).toBe(1);
      expect(d.now.effectiveKp).toBeCloseTo(4, 1);
      expect(d.now).toMatchObject({ driver: "fmi", alert: "city", activity: { level: "medium" } });
    });
    it("ignores a delayed R-index (45 min old)", async () => {
      serve({ ...healthy(), "r-index/api": () => rIndexFig(250, minAgo(45)) });
      const d = await getAuroraData();
      expect(status(d, "rindex")).toBe("stale");
      expect(d.now).toMatchObject({ activity: null, effectiveKp: 1, driver: "kp" });
    });
    it("treats an empty FMI reply as a failure, not as 'no activity'", async () => {
      serve({ ...healthy(), "r-index/api": () => rIndexFig(null, minAgo(5)) });
      const d = await getAuroraData();
      expect(status(d, "rindex")).toBe("failed");
      expect(d.now.activity).toBeNull();
    });
  });
});
