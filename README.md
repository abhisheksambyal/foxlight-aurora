# Foxlight Aurora

*Northern lights forecast for Oulu · Revontulet Oulussa*

Answers **"Should I go out tonight, when, and where?"** for aurora hunting around Oulu, Finland (65°N).
Enter your address (or use your location) to rank the viewing spots by distance from you.

Built with Next.js 16 (static export), Tailwind CSS 4 and TypeScript. No UI libraries; charts are inline SVG.
Hosted on GitHub Pages and rebuilt with fresh data every 10 minutes by GitHub Actions.

```bash
npm install
npm test         # vitest — the visibility model, parsers and forecast logic
npm run dev      # http://localhost:3000
npm run build    # static site in ./out (set BASE_PATH=/repo-name for a project page)
```

## How it works

- **Build-time aggregator** — `lib/data.ts#getAuroraData` fetches every source in parallel, trims the payloads
  (~5 MB raw → ~16 KB) and computes the forecast. The page and `data.json` are both generated from it.
  Every fetch is retried, every parser validates the format and throws on anything unexpected.
- **Never a confident wrong answer** — if a critical source (Kp forecast, FMI cloud forecast) is missing or incomplete,
  the build fails and the previous correct deployment stays online. Optional sources show as "unavailable", and live
  readings older than 30 min show as "delayed" instead of "now". If the page itself is over 75 min old, visitors see a
  warning banner (computed in the browser, so it works even if the update pipeline stops).
- **Scheduled rebuilds** — `.github/workflows/deploy.yml` runs tests, builds and deploys on every push and every 10 minutes.
  Open pages check `data.json` and reload when a newer build is live.
- **Visibility model** — `lib/oulu.ts`:
  `chance = 100 × activity(Kp − spot.minKp) × (1 − clouds) × darkness(sun altitude)`.
  Spots need Kp 2 (dark sky), 3 (semi-dark shore) or 4 (city lights). Alerts: Kp 2+ → "High probability at dark spots",
  Kp 4+ → "Visible from the city centre".
- **Nowcast** — Kp is raised by FMI's R-index from Oulujärvi and Ranua (either side of Oulu), FMI's own 5-minute
  auroral activity index with per-station thresholds (yellow = 50% chance of weak auroras ≈ Kp 3, red = 50% chance
  of strong auroras ≈ Kp 5). It catches local substorms the global 3-hour Kp misses.
- **Forecast** — `lib/forecast.ts` scores 72 hours per spot, groups them into nights and finds each night's best window.
- **Your location** — address search uses OpenStreetMap Nominatim from the browser; the chosen point is kept only in
  `localStorage`. Distances default to Oulu Market Square.

## Data sources

| What | Source |
| --- | --- |
| Kp observed + 3-day forecast | NOAA SWPC `noaa-planetary-k-index-forecast.json` |
| Solar wind speed, Bz | NOAA SWPC real-time solar wind (`json/rtsw/*`) |
| 27-day outlook | NOAA SWPC `27-day-outlook.txt` |
| OVATION aurora probability | NOAA SWPC `ovation_aurora_latest.json` |
| Cloud cover forecast per spot | FMI open data (meteorologist-edited forecast) |
| Auroral activity now | FMI R-index ([space.fmi.fi](https://space.fmi.fi/image/realtime/SSA/r-index/)), Oulujärvi + Ranua |

Note: GitHub pauses scheduled workflows after 60 days without repository activity — re-enable it from the Actions tab if that happens.
