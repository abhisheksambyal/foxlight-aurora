import { describe, expect, it } from "vitest";
import { buildHours, darkWindow, kpAt, nightLabel, outlookHighlights, summarizeNights, verdict } from "./forecast";
import type { Spot } from "./oulu";

const bins = [
  { start: "2026-12-10T18:00:00Z", kp: 1, kind: "predicted" as const, scale: null },
  { start: "2026-12-10T21:00:00Z", kp: 4, kind: "predicted" as const, scale: null },
  { start: "2026-12-11T00:00:00Z", kp: 2, kind: "predicted" as const, scale: null },
];

describe("kpAt", () => {
  it("finds the 3-hour bin containing a time", () => {
    expect(kpAt(bins, new Date("2026-12-10T22:30:00Z"))).toBe(4);
  });
  it("returns null outside the forecast", () => {
    expect(kpAt(bins, new Date("2026-12-11T03:00:00Z"))).toBeNull();
  });
});

const spots: Spot[] = [
  { id: "city", name: "City", lat: 65.02, lon: 25.46, minKp: 4, note: "", query: "" },
  { id: "dark", name: "Dark", lat: 64.96, lon: 25.88, minKp: 2, note: "", query: "" },
];

describe("buildHours", () => {
  it("scores every hour and picks the best spot", () => {
    const hours = buildHours({
      from: new Date("2026-12-10T21:00:00Z"),
      count: 2,
      kpBins: bins,
      spots,
      clouds: { city: [{ time: "2026-12-10T21:00:00Z", value: 0 }], dark: [{ time: "2026-12-10T21:00:00Z", value: 50 }] },
    });
    expect(hours).toHaveLength(2);
    expect(hours[0]).toMatchObject({ time: "2026-12-10T21:00:00Z", kp: 4, spotId: "city", score: 75, cloud: 0 });
    // second hour has no cloud data → unknown (50%) everywhere, dark spot wins on Kp
    expect(hours[1]).toMatchObject({ spotId: "dark", score: 50, cloud: null });
  });
});

describe("summarizeNights", () => {
  it("groups hours into Helsinki-evening nights and finds the peak window", () => {
    const h = (time: string, score: number) => ({ time, kp: 4, sunAlt: -30, spotId: "dark", score, cloud: 10 });
    const nights = summarizeNights([
      h("2026-12-10T18:00:00Z", 10),
      h("2026-12-10T19:00:00Z", 60),
      h("2026-12-10T20:00:00Z", 70),
      h("2026-12-10T21:00:00Z", 20),
      h("2026-12-11T19:00:00Z", 0), // next evening
    ]);
    expect(nights).toHaveLength(2);
    expect(nights[0]).toMatchObject({
      date: "2026-12-10",
      peak: 70,
      start: "2026-12-10T19:00:00Z",
      end: "2026-12-10T21:00:00Z",
      spotId: "dark",
    });
    expect(nights[1]).toMatchObject({ date: "2026-12-11", peak: 0 });
  });

  it("explains a zero night: clouds vs. quiet activity", () => {
    const cloudy = summarizeNights([{ time: "2026-12-10T21:00:00Z", kp: 5, sunAlt: -30, spotId: "dark", score: 0, cloud: 100 }]);
    const quiet = summarizeNights([{ time: "2026-12-10T21:00:00Z", kp: 0.3, sunAlt: -30, spotId: "dark", score: 0, cloud: 0 }]);
    expect(cloudy[0].limit).toBe("clouds");
    expect(quiet[0].limit).toBe("activity");
  });
});

describe("darkWindow", () => {
  it("finds tonight's astronomical-ish darkness in Oulu (sun < -12°)", () => {
    const w = darkWindow(new Date("2026-12-10T12:00:00Z"))!;
    // December: dark by ~16:00 local (14:00Z) until ~07:30 local (05:30Z)
    expect(new Date(w.start).getUTCHours()).toBe(14);
    expect(new Date(w.end).getUTCHours()).toBe(5);
  });
  it("reports 'now' when already dark", () => {
    const now = new Date("2026-12-10T22:00:00Z");
    expect(darkWindow(now)!.start).toBe(now.toISOString());
  });
});

describe("verdict", () => {
  const night = (peak: number) => ({ date: "2026-12-10", peak, start: "", end: "", spotId: "dark", kp: 3, cloud: 10, limit: "clouds" as const });
  it("says go now when it's dark and the current score is good", () =>
    expect(verdict({ nowScore: 50, sunAlt: -20, tonight: night(10) })).toBe("now"));
  it("ignores a good 'now' score while it's still light", () =>
    expect(verdict({ nowScore: 50, sunAlt: 2, tonight: night(10) })).toBe("unlikely"));
  it("points to tonight when the forecast is good", () =>
    expect(verdict({ nowScore: 0, sunAlt: 10, tonight: night(40) })).toBe("tonight"));
  it("says maybe for a modest night", () =>
    expect(verdict({ nowScore: 0, sunAlt: 10, tonight: night(20) })).toBe("maybe"));
  it("says too bright when there is no darkness at all", () =>
    expect(verdict({ nowScore: 0, sunAlt: 10, tonight: null })).toBe("bright"));
});

describe("nightLabel", () => {
  const evening = new Date("2026-12-10T18:00:00Z");
  it("labels the current night 'Tonight', even after midnight", () => {
    expect(nightLabel("2026-12-10", evening)).toBe("Tonight");
    expect(nightLabel("2026-12-10", new Date("2026-12-11T01:00:00Z"))).toBe("Tonight");
  });
  it("calls the coming evening 'Tonight' in the morning", () =>
    expect(nightLabel("2026-12-11", new Date("2026-12-11T06:00:00Z"))).toBe("Tonight"));
  it("labels the last dark hours of an ending night 'Before dawn'", () =>
    expect(nightLabel("2026-12-10", new Date("2026-12-11T04:00:00Z"))).toBe("Before dawn"));
  it("labels the next one 'Tomorrow night'", () => expect(nightLabel("2026-12-11", evening)).toBe("Tomorrow night"));
  it("uses the weekday further out", () => expect(nightLabel("2026-12-12", evening)).toBe("Saturday night"));
});

describe("outlookHighlights", () => {
  it("merges consecutive Kp 4+ days into ranges", () => {
    const days = [
      { date: "2026-10-03", ap: 5, kp: 2 },
      { date: "2026-10-04", ap: 12, kp: 4 },
      { date: "2026-10-05", ap: 15, kp: 5 },
      { date: "2026-10-06", ap: 5, kp: 3 },
      { date: "2026-10-22", ap: 20, kp: 4 },
    ];
    expect(outlookHighlights(days)).toEqual([
      { from: "2026-10-04", to: "2026-10-05", kp: 5 },
      { from: "2026-10-22", to: "2026-10-22", kp: 4 },
    ]);
  });
});
