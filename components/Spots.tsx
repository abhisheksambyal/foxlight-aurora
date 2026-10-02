"use client";

import { useState, useSyncExternalStore } from "react";
import type { AuroraData } from "@/lib/data";
import { date, time } from "@/lib/format";
import { CITY_CENTRE, directionsUrl, rankSpots, type RankMode } from "@/lib/oulu";
import { Card, Score, Section } from "./ui";
import { Term } from "./Term";

type Origin = { name: string; lat: number; lon: number };

const SKY: Record<number, string> = { 2: "Dark sky · Kp 2+", 3: "Semi-dark · Kp 3+", 4: "City lights · Kp 4+" };
const STORE = "foxlight:origin";

async function geocode(q: string): Promise<Origin | null> {
  // OpenStreetMap Nominatim, biased to the Oulu region. One request per search, as their policy asks.
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fi&viewbox=24.4,65.4,26.3,64.7&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error(String(res.status));
  const [hit] = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return hit ? { name: hit.display_name.split(",").slice(0, 2).join(","), lat: Number(hit.lat), lon: Number(hit.lon) } : null;
}

const noSubscribe = () => () => {};
const readSaved = () => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
};

export function Spots({ spots, dark }: { spots: AuroraData["spots"]; dark: boolean }) {
  // Origin remembered from a previous visit (read after hydration; the server always renders the city centre).
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const [picked, setPicked] = useState<Origin | null>(null);
  const origin: Origin = picked ?? (saved ? JSON.parse(saved) : CITY_CENTRE);
  const [mode, setMode] = useState<RankMode>("chance");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = (o: Origin | null) => {
    const next = o ?? CITY_CENTRE;
    setPicked(next);
    setMsg(null);
    try {
      if (o) localStorage.setItem(STORE, JSON.stringify(o));
      else localStorage.removeItem(STORE);
    } catch {}
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMsg("Searching…");
    try {
      const hit = await geocode(query);
      if (hit) {
        choose(hit);
        setMode("nearest");
      } else setMsg("Couldn't find that place. Try an area or landmark, e.g. “Nallikari” or “Tuira”.");
    } catch {
      setMsg("Place search is unavailable right now.");
    }
    setBusy(false);
  };

  const locate = () => {
    if (!navigator.geolocation) return setMsg("Location isn't available in this browser.");
    setMsg("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        choose({ name: "Your location", lat: p.coords.latitude, lon: p.coords.longitude });
        setMode("nearest");
      },
      () => setMsg("Couldn't get your location. Check the browser's permission."),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const ranked = rankSpots(spots, origin, mode);
  const isDefault = origin.name === CITY_CENTRE.name;

  return (
    <Section id="spots" title="Where to go" hint="Always face north">
      <Card className="mb-3 p-4 sm:p-5">
        <form onSubmit={search} className="flex gap-2">
          <label htmlFor="addr" className="sr-only">Starting point</label>
          <input
            id="addr"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Area, e.g. Tuira"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm placeholder:text-faint focus:border-great/50 focus:outline-none"
          />
          <button type="submit" disabled={busy}
            className="rounded-xl border border-line px-4 text-sm hover:border-great/50 disabled:opacity-50">
            Find
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
          <p className="text-muted">
            From <span className="text-ink">{origin.name}</span>
            {!isDefault && (
              <button onClick={() => choose(null)} className="ml-2 text-faint underline underline-offset-4 hover:text-muted">
                reset
              </button>
            )}
            <span className="mx-2 text-faint">·</span>
            <button onClick={locate} className="text-great/90 underline-offset-4 hover:underline">Use my location</button>
          </p>
          <div role="radiogroup" aria-label="Sort spots" className="flex rounded-lg border border-line p-0.5">
            {(["chance", "nearest"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-line text-ink" : "text-faint hover:text-muted"}`}>
                {m === "chance" ? "Best chance" : "Nearest"}
              </button>
            ))}
          </div>
        </div>
        {msg && <p className="mt-2 text-xs text-maybe" aria-live="polite">{msg}</p>}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {ranked.map((s, i) => (
          <Card key={s.id} className={`flex flex-col p-5 ${i === 0 && mode === "chance" ? "border-great/30" : ""}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-medium">{s.name}</h3>
              <span className="shrink-0 font-mono text-xs text-faint tabular-nums">{s.distanceKm} km</span>
            </div>
            <p className="mt-1 text-xs text-faint"><Term k="spotKp">{SKY[s.minKp]}</Term></p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{s.note}</p>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-xs">
              <div>
                <dt className="text-faint">Now</dt>
                <dd className="mt-1">{dark ? <Score value={s.now} /> : <span className="text-muted">Daylight</span>}</dd>
              </div>
              <div>
                <dt className="text-faint">Best, 3 nights</dt>
                <dd className="mt-1">
                  {s.best ? <Score value={s.best.peak} /> : "–"}
                  {s.best && s.best.peak >= 15 && (
                    <span className="mt-0.5 block font-mono text-[11px] text-faint">
                      {date(s.best.date).split(" ")[0]} {time(s.best.start)}–{time(s.best.end)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-faint">Clouds</dt>
                <dd className="mt-1 font-mono text-sm text-muted tabular-nums">{s.cloud === null ? "–" : `${Math.round(s.cloud)}%`}</dd>
              </div>
            </dl>

            <a href={directionsUrl(origin, s)} target="_blank" rel="noopener noreferrer"
              className="mt-4 self-start text-sm text-great/90 underline-offset-4 hover:underline">
              Directions →
            </a>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">
        Place search by OpenStreetMap. Your starting point is only kept in this browser.
      </p>
    </Section>
  );
}
