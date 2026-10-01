import { describe, expect, it } from "vitest";
import {
  ovationNear,
  parse27Day,
  parseFmiSeries,
  parseKpForecast,
  parseRtsw,
  stationRanges,
} from "./parse";

describe("parseKpForecast", () => {
  it("maps NOAA rows to typed 3-hour bins", () => {
    const rows = [
      { time_tag: "2026-10-01T18:00:00", kp: 1.67, observed: "estimated", noaa_scale: null },
      { time_tag: "2026-10-02T15:00:00", kp: 4.67, observed: "predicted", noaa_scale: "G1" },
    ];
    expect(parseKpForecast(rows)).toEqual([
      { start: "2026-10-01T18:00:00Z", kp: 1.67, kind: "estimated", scale: null },
      { start: "2026-10-02T15:00:00Z", kp: 4.67, kind: "predicted", scale: "G1" },
    ]);
  });
});

describe("parse27Day", () => {
  it("reads the outlook table and skips comments", () => {
    const txt = `:Product: 27-day Space Weather Outlook Table 27DO.txt
#   UTC      Radio Flux   Planetary   Largest
#  Date       10.7 cm      A Index    Kp Index
2026 Sep 28      98           5          2
2026 Oct 04      90          12          4
`;
    expect(parse27Day(txt)).toEqual([
      { date: "2026-09-28", ap: 5, kp: 2 },
      { date: "2026-10-04", ap: 12, kp: 4 },
    ]);
  });
});

describe("parseFmiSeries", () => {
  const el = (pos: string, time: string, value: string) => `
    <BsWfs:BsWfsElement gml:id="x">
      <BsWfs:Location><gml:Point><gml:pos>${pos} </gml:pos></gml:Point></BsWfs:Location>
      <BsWfs:Time>${time}</BsWfs:Time>
      <BsWfs:ParameterName>TotalCloudCover</BsWfs:ParameterName>
      <BsWfs:ParameterValue>${value}</BsWfs:ParameterValue>
    </BsWfs:BsWfsElement>`;

  it("groups simple-feature values by location and drops NaN", () => {
    const xml = el("65.03000 25.41000", "2026-10-01T19:00:00Z", "99.7") +
      el("65.03000 25.41000", "2026-10-01T20:00:00Z", "NaN") +
      el("65.00000 24.70000", "2026-10-01T19:00:00Z", "12");
    expect(parseFmiSeries(xml)).toEqual([
      { lat: 65.03, lon: 25.41, points: [{ time: "2026-10-01T19:00:00Z", value: 99.7 }] },
      { lat: 65, lon: 24.7, points: [{ time: "2026-10-01T19:00:00Z", value: 12 }] },
    ]);
  });
});

describe("stationRanges", () => {
  it("returns max-min of each station's series within the window", () => {
    const series = [
      { lat: 64.5107, lon: 27.2267, points: [
        { time: "2026-10-01T17:00:00Z", value: -500 }, // outside window
        { time: "2026-10-01T17:30:00Z", value: -60 },
        { time: "2026-10-01T18:00:00Z", value: -95 },
      ] },
    ];
    const ranges = stationRanges(series, [{ id: "OUJ", name: "Oulujärvi", lat: 64.5107, lon: 27.2267 }], new Date("2026-10-01T18:05:00Z"), 60);
    expect(ranges).toEqual([{ id: "OUJ", name: "Oulujärvi", rangeNt: 35, latest: "2026-10-01T18:00:00Z" }]);
  });
});

describe("parseRtsw", () => {
  it("keeps only the active spacecraft, oldest-first, within the window", () => {
    const rows = [
      { time_tag: "2026-10-01T18:14:00", active: true, proton_speed: 310 },
      { time_tag: "2026-10-01T18:14:00", active: false, proton_speed: 999 },
      { time_tag: "2026-10-01T18:13:00", active: true, proton_speed: null },
      { time_tag: "2026-10-01T18:12:00", active: true, proton_speed: 300 },
      { time_tag: "2026-10-01T15:00:00", active: true, proton_speed: 280 },
    ];
    expect(parseRtsw(rows, "proton_speed", new Date("2026-10-01T18:15:00Z"), 120)).toEqual([
      { time: "2026-10-01T18:12:00Z", value: 300 },
      { time: "2026-10-01T18:14:00Z", value: 310 },
    ]);
  });
});

describe("ovationNear", () => {
  it("reads overhead probability and the max within view to the north", () => {
    const coords = [
      [25, 64, 1], [25, 65, 3], [25, 66, 8], [25, 67, 20], [26, 68, 30], [25, 72, 90],
    ];
    expect(ovationNear({ coordinates: coords }, 25.47, 65.01)).toEqual({ overhead: 3, inView: 30 });
  });
});
