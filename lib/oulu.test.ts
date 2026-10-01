import { describe, expect, it } from "vitest";
import {
  auroraFactor,
  darknessFactor,
  kpAlert,
  localK,
  scoreLabel,
  sunAltitude,
  visibilityScore,
  OULU,
  CITY_CENTRE,
  rankSpots,
  directionsUrl,
  distanceKm,
} from "./oulu";

describe("sunAltitude (Oulu 65.01°N)", () => {
  it("is ~48° at summer-solstice solar noon", () => {
    expect(sunAltitude(new Date("2026-06-21T10:20:00Z"), OULU.lat, OULU.lon)).toBeCloseTo(48.4, 0);
  });
  it("barely clears the horizon at winter-solstice solar noon", () => {
    expect(sunAltitude(new Date("2026-12-21T10:20:00Z"), OULU.lat, OULU.lon)).toBeCloseTo(1.5, 0);
  });
  it("is ~-48° at winter-solstice solar midnight", () => {
    expect(sunAltitude(new Date("2026-12-21T22:20:00Z"), OULU.lat, OULU.lon)).toBeCloseTo(-48.4, 0);
  });
});

describe("kpAlert — Oulu thresholds", () => {
  it("is quiet below Kp 2", () => expect(kpAlert(1.67)).toBe("quiet"));
  it("flags dark spots at Kp 2+", () => {
    expect(kpAlert(2)).toBe("dark-sky");
    expect(kpAlert(3.67)).toBe("dark-sky");
  });
  it("flags the city centre at Kp 4+", () => {
    expect(kpAlert(4)).toBe("city");
    expect(kpAlert(7)).toBe("city");
  });
});

describe("auroraFactor", () => {
  it("is high (0.75) exactly at a spot's minimum Kp", () => expect(auroraFactor(2, 2)).toBe(0.75));
  it("saturates at 1 half a Kp above", () => expect(auroraFactor(4.5, 4)).toBe(1));
  it("is 0 well below the minimum", () => expect(auroraFactor(0.33, 2)).toBe(0));
});

describe("darknessFactor", () => {
  it("is 0 in daylight and civil twilight", () => {
    expect(darknessFactor(10)).toBe(0);
    expect(darknessFactor(-6)).toBe(0);
  });
  it("is 1 once the sun is 12° below the horizon", () => expect(darknessFactor(-15)).toBe(1));
  it("ramps linearly in between", () => expect(darknessFactor(-9)).toBe(0.5));
});

describe("visibilityScore", () => {
  it("is 0 when fully overcast", () =>
    expect(visibilityScore({ kp: 6, minKp: 2, cloud: 100, sunAlt: -30 })).toBe(0));
  it("is 0 in daylight", () =>
    expect(visibilityScore({ kp: 6, minKp: 2, cloud: 0, sunAlt: 5 })).toBe(0));
  it("is 100 for a strong storm, clear dark sky", () =>
    expect(visibilityScore({ kp: 6, minKp: 2, cloud: 0, sunAlt: -30 })).toBe(100));
  it("combines factors multiplicatively", () =>
    expect(visibilityScore({ kp: 2, minKp: 2, cloud: 40, sunAlt: -30 })).toBe(45));
  it("treats unknown cloud cover as 50%", () =>
    expect(visibilityScore({ kp: 6, minKp: 2, cloud: null, sunAlt: -30 })).toBe(50));
});

describe("scoreLabel", () => {
  it.each([
    [80, "Great"],
    [45, "Good"],
    [20, "Possible"],
    [5, "Unlikely"],
  ])("%i → %s", (s, label) => expect(scoreLabel(s).label).toBe(label));
});

describe("localK (1-hour H-range, K9 = 1000 nT)", () => {
  it.each([
    [5, 0],
    [15, 1],
    [45, 3],
    [100, 4],
    [250, 6],
    [1200, 9],
  ])("%i nT → K%i", (range, k) => expect(localK(range)).toBe(k));
});

describe("distanceKm", () => {
  it("measures Oulu city centre → Hailuoto Marjaniemi (~42 km)", () => {
    expect(distanceKm(CITY_CENTRE, { lat: 65.04, lon: 24.562 })).toBeCloseTo(42.4, 0);
  });
});

describe("rankSpots", () => {
  const spots = [
    { id: "far-dark", lat: 65.04, lon: 24.562, minKp: 2, best: { peak: 60 } },
    { id: "near-city", lat: 65.022, lon: 25.459, minKp: 4, best: { peak: 30 } },
    { id: "mid-dark", lat: 64.965, lon: 25.879, minKp: 2, best: { peak: 60 } },
    { id: "none", lat: 65.03, lon: 25.412, minKp: 3, best: null },
  ];

  it("adds rounded distances from the chosen origin", () => {
    const r = rankSpots(spots, CITY_CENTRE, "chance");
    expect(r.find((s) => s.id === "far-dark")!.distanceKm).toBe(42);
  });
  it("by chance: best peak first, then darker sky, then nearer", () => {
    expect(rankSpots(spots, CITY_CENTRE, "chance").map((s) => s.id)).toEqual(["mid-dark", "far-dark", "near-city", "none"]);
  });
  it("by distance: nearest first", () => {
    expect(rankSpots(spots, CITY_CENTRE, "nearest").map((s) => s.id)).toEqual(["near-city", "none", "mid-dark", "far-dark"]);
  });
  it("re-ranks for a different origin", () => {
    const hailuoto = { lat: 65.0, lon: 24.7 };
    expect(rankSpots(spots, hailuoto, "nearest")[0].id).toBe("far-dark");
  });
});

describe("directionsUrl", () => {
  it("routes between exact coordinates, which Google Maps always resolves", () => {
    expect(directionsUrl(CITY_CENTRE, { lat: 65.03, lon: 25.412 })).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=65.0135,25.4637&destination=65.03,25.412",
    );
  });
});

describe("directionsUrl without an origin", () => {
  it("lets Google Maps start from the viewer's current location", () => {
    expect(directionsUrl(null, { lat: 65.03, lon: 25.412 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=65.03,25.412",
    );
  });
});
