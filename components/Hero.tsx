import type { AuroraData } from "@/lib/data";
import { nightLabel, outlookHighlights, verdict, type Verdict } from "@/lib/forecast";
import { date, day, kp, time, TONE } from "@/lib/format";
import { directionsUrl } from "@/lib/oulu";
import { Score } from "./ui";
import { Term } from "./Term";

const TITLE: Record<Verdict, string> = {
  now: "Go out now",
  tonight: "Good chance tonight",
  maybe: "Maybe tonight",
  unlikely: "Unlikely tonight",
  bright: "Too bright for auroras",
};

const HEAD_COLOR: Record<Verdict, string> = {
  now: "text-great",
  tonight: "text-great",
  maybe: "text-maybe",
  unlikely: "text-ink",
  bright: "text-ink",
};

const ALERT = {
  city: { text: "Visible from the city centre", tone: "great" },
  "dark-sky": { text: "High probability at dark spots around Oulu", tone: "good" },
  quiet: { text: "Quiet — auroras rarely reach Oulu at this level", tone: "low" },
} as const;

export function Hero({ data }: { data: AuroraData }) {
  const now = new Date(data.generatedAt);
  const tonight = data.nights.find((n) => nightLabel(n.date, now) === "Tonight") ?? data.nights[0] ?? null;
  const bestNow = data.spots.reduce((a, b) => (b.now > a.now ? b : a));
  const v = verdict({ nowScore: bestNow.now, sunAlt: data.now.sunAlt, tonight });
  const spotOf = (id: string) => data.spots.find((s) => s.id === id)!;

  const later = data.nights.find((n) => n !== tonight && n.peak >= 15);
  // The window the When/Where/Chance row describes: now, tonight, or the next good night.
  const target = v === "now" ? null : tonight && tonight.peak >= 15 ? tonight : (later ?? null);
  const where = v === "now" ? bestNow : target ? spotOf(target.spotId) : null;
  const score = v === "now" ? bestNow.now : (target ?? tonight)?.peak ?? 0;
  const when =
    v === "now"
      ? { date: day(data.generatedAt), time: `Now – ${data.now.dark ? time(data.now.dark.end) : "dawn"}` }
      : target
        ? {
            date: day(target.start),
            // A window starting after midnight belongs to the previous evening's night (as in "Next nights").
            time: `${time(target.start)}–${time(target.end)}${day(target.start) !== date(target.date) ? ` · ${date(target.date).split(" ")[0]} night` : ""}`,
          }
        : null;
  // Kp and clouds behind the chance figure.
  const basis = v === "now" ? { kp: data.now.effectiveKp, cloud: bestNow.cloud } : (target ?? tonight);
  const sub = "mt-0.5 block text-xs font-normal text-muted";
  const nextActive = outlookHighlights(data.outlook)[0];
  const alert = ALERT[data.now.alert];

  let detail: React.ReactNode;
  if (v === "now") {
    detail = <>Auroras are likely right now. Head to <b className="font-medium text-ink">{bestNow.name}</b> and look north.</>;
  } else if (v === "bright") {
    detail = <>Oulu nights are too light right now. Aurora season runs from late August to mid-April.</>;
  } else if (tonight && (v === "tonight" || v === "maybe")) {
    detail = (
      <>Best between <b className="font-medium text-ink">{time(tonight.start)}</b> and <b className="font-medium text-ink">{time(tonight.end)}</b> at{" "}
        <b className="font-medium text-ink">{where?.name}</b>. Expected <Term k="kp">Kp</Term> {kp(tonight.kp)}, clouds {tonight.cloud === null ? "?" : Math.round(tonight.cloud)}%.</>
    );
  } else {
    const why = tonight?.limit === "clouds" ? "Clouds will cover the sky" : "Solar activity is too low to reach Oulu";
    detail = (
      <>{why}.{" "}
        {later ? <>Better chance <b className="font-medium text-ink">{nightLabel(later.date, now).toLowerCase()}</b>, {time(later.start)}–{time(later.end)}.</>
          : nextActive ? <>Next active days expected around <b className="font-medium text-ink">{date(nextActive.from)}</b> (Kp {nextActive.kp}).</>
          : null}
      </>
    );
  }

  return (
    <header className="pt-10 sm:pt-16">
      <h1 className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
        Foxlight Aurora <span className="text-faint">· Northern lights forecast for Oulu</span>
      </h1>
      <p role="status" className={`mt-4 text-5xl font-semibold tracking-tight text-balance sm:text-6xl ${HEAD_COLOR[v]}`}>
        {TITLE[v]}
      </p>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{detail}</p>

      {target && target !== tonight && <p className="mt-8 mb-2 text-xs text-faint">Next good window</p>}
      <dl className={`${target && target !== tonight ? "" : "mt-8"} grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/70`}>
        {[
          ["When", "When", when ? <>{when.date}<span className={sub}>{when.time}</span></> : "–"],
          ["Where", "Where", where ? (
            <>
              {where.name.split(" · ")[0]}
              <a href={directionsUrl(null, where)} target="_blank" rel="noopener noreferrer"
                className="mt-0.5 block text-xs font-normal text-great/90 underline-offset-4 hover:underline">
                Directions →
              </a>
            </>
          ) : "–"],
          ["Chance", <Term key="t" k="chance">Chance</Term>, <>
            <Score value={score} />
            {basis && <span className={sub}><Term k="kp">Kp</Term> {kp(basis.kp)} · clouds {basis.cloud === null ? "?" : Math.round(basis.cloud)}%</span>}
          </>],
        ].map(([key, label, val]) => (
          <div key={key as string} className="min-w-0 px-4 py-4 sm:px-5">
            <dt className="text-xs text-faint">{label}</dt>
            <dd className="mt-1 text-sm leading-snug font-medium sm:text-base">{val}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-muted">
        <span className={`size-1.5 rounded-full ${TONE[alert.tone].dot}`} />
        <Term k="kp" icon><span className="font-mono text-ink tabular-nums">Kp {kp(data.now.effectiveKp)}</span></Term>
        {alert.text}
        {data.now.sunAlt > -6 && alert.tone !== "low" && <span className="text-faint">(once dark)</span>}
      </p>
    </header>
  );
}
