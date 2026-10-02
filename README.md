# Foxlight Aurora

*Northern lights forecast for Oulu · Revontulet Oulussa*

Answers **"Should I go out tonight, when, and where?"** for aurora hunting around Oulu, Finland (65°N).
Enter an area or landmark (or use your location) to rank the viewing spots by distance from you.

Built with Next.js 16 (static export), Tailwind CSS 4 and TypeScript. No UI libraries; charts are inline SVG.
Hosted on GitHub Pages and rebuilt with fresh data by GitHub Actions: every 10 minutes while it can be dark, hourly in daylight.

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
- **Scheduled rebuilds** — `.github/workflows/deploy.yml` runs tests, builds and deploys on every push, every 10 min
  from 13:00 to 05:59 UTC (when it can be dark in Oulu) and hourly otherwise. GitHub runs schedules late or skips
  them, so an external timer triggers the same workflow on the same pattern (see [Reliable refresh](#reliable-refresh)).
  Open pages check `data.json` and reload when a newer build is live.
- **Visibility model** — `lib/oulu.ts`:
  `chance = 100 × activity(Kp − spot.minKp) × (1 − clouds) × darkness(sun altitude)`.
  Spots need Kp 2 (dark sky), 3 (semi-dark shore) or 4 (city lights). Alerts: Kp 2+ → "High probability at dark spots",
  Kp 4+ → "Visible from the city centre".
- **Nowcast** — Kp is raised by FMI's R-index from Oulujärvi and Ranua (either side of Oulu), FMI's own 5-minute
  auroral activity index with per-station thresholds (yellow = 50% chance of weak auroras ≈ Kp 3, red = 50% chance
  of strong auroras ≈ Kp 5). It catches local substorms the global 3-hour Kp misses.
- **Forecast** — `lib/forecast.ts` scores 72 hours per spot, groups them into nights and finds each night's best window.
- **Search engines** — `app/robots.ts`, `app/sitemap.ts` (lastmod = data time), `app/manifest.ts`, a static
  share image (`app/opengraph-image.png`, PNG so GitHub Pages serves it as an image), canonical URL and JSON-LD
  (WebSite, WebPage, FAQPage) in `app/page.tsx`. Site name, title and description live in `lib/site.ts`.
- **Your location** — place search uses OpenStreetMap Nominatim from the browser; the chosen point is kept only in
  `localStorage`. Distances default to Oulu Market Square.

## Reliable refresh

GitHub's `schedule:` trigger is best effort (runs are often hours late), so [cron-job.org](https://cron-job.org)
calls the workflow's `workflow_dispatch` on time. Two jobs, timezone UTC, both `POST`ing to
`https://api.github.com/repos/foxlight-aurora/foxlight-aurora.github.io/actions/workflows/deploy.yml/dispatches`
with body `{"ref":"main"}`:

| Job | Minutes | Hours (UTC) |
|---|---|---|
| Night | 0, 10, 20, 30, 40, 50 | 13–23, 0–5 |
| Day | 0 | 6–12 |

Headers: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2026-03-10`,
`Authorization: Bearer <token>`. The token is a fine-grained personal access token scoped to this repository only,
with **Actions: Read and write** and nothing else. A successful call returns `200` with the run details (`204` on the older `2022-11-28` API version). When the token expires,
create a new one and paste it into both jobs.

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
