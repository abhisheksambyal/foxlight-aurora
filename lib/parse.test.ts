import { describe, expect, it } from "vitest";
import {
  ovationNear,
  parse27Day,
  parseFmiSeries,
  parseKpForecast,
  parseRtsw,
  parseRIndex,
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

describe("parseRIndex (FMI R-index Plotly JSON)", () => {
  const fig = (bars: [string, number | null][], lines = [68, 200]) => ({
    data: [
      { name: "No activity", x: bars.map((b) => b[0]), customdata: bars.map((b) => ["No activity", b[1]]) },
      { name: undefined, x: ["2026-10-01T00:00:00+00:00"] }, // "no data" helper trace without customdata
    ],
    layout: { title: { text: "Oulujärvi (OUJ 64.52&deg; N 27.23&deg; E)" }, shapes: [
      ...lines.map((y) => ({ type: "line", y0: y, y1: y })),
      { type: "rect", y0: 0, y1: 1 },
    ] },
  });

  it("reads thresholds and the strongest R in the latest 15 minutes", () => {
    const r = parseRIndex(fig([
      ["2026-10-01T20:30:00+00:00", 150], // older than 15 min before the latest → ignored
      ["2026-10-01T20:50:00+00:00", 99],
      ["2026-10-01T20:55:00+00:00", 120],
      ["2026-10-01T21:00:00+00:00", 80],
    ]));
    expect(r).toEqual({ yellow: 68, red: 200, r: 120, time: "2026-10-01T21:00:00Z" });
  });
  it("skips data gaps (null) instead of reading them as zero", () => {
    const r = parseRIndex(fig([["2026-10-01T20:55:00+00:00", 90], ["2026-10-01T21:00:00+00:00", null]]));
    expect(r).toMatchObject({ r: 90, time: "2026-10-01T20:55:00Z" });
  });
  it("throws when there is no data at all", () =>
    expect(() => parseRIndex(fig([["2026-10-01T21:00:00+00:00", null]]))).toThrow());
  it("throws when the thresholds are missing (format changed)", () =>
    expect(() => parseRIndex(fig([["2026-10-01T21:00:00+00:00", 5]], []))).toThrow());
});

describe("schema validation — a changed API format must fail loudly, not produce wrong numbers", () => {
  it("rejects NOAA's old array-of-arrays Kp format", () =>
    expect(() => parseKpForecast([["time_tag", "kp"], ["2026-10-01 00:00:00", "2.33"]] as never)).toThrow());
  it("rejects Kp rows without a numeric kp", () =>
    expect(() => parseKpForecast([{ time_tag: "2026-10-01T00:00:00", kp: null, observed: "predicted", noaa_scale: null }] as never)).toThrow());
  it("rejects an empty Kp forecast", () => expect(() => parseKpForecast([])).toThrow());
  it("rejects a 27-day outlook with no rows", () => expect(() => parse27Day("<html>maintenance</html>")).toThrow());
  it("rejects an OVATION grid without the Oulu cell", () =>
    expect(() => ovationNear({ coordinates: [[0, 0, 1]] }, 25.47, 65.01)).toThrow());
});
