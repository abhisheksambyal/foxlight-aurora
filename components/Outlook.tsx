import type { AuroraData } from "@/lib/data";
import { outlookHighlights } from "@/lib/forecast";
import { date } from "@/lib/format";
import { Card, Section } from "./ui";

const CELL: Record<number, string> = {
  0: "text-faint", 1: "text-faint", 2: "text-muted",
  3: "bg-maybe/10 text-maybe", 4: "bg-good/15 text-good", 5: "bg-great/20 text-great",
};

export function Outlook({ data }: { data: AuroraData }) {
  const days = data.outlook;
  if (!days.length) return null;
  const highlights = outlookHighlights(days);
  const lead = (new Date(days[0].date).getUTCDay() + 6) % 7; // Monday-first calendar

  return (
    <Section id="outlook" title="Coming weeks" hint="NOAA 27-day outlook · max Kp per day">
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-muted">
          {highlights.length ? (
            <>Mark your calendar: {highlights.map((h, i) => (
              <span key={h.from}>
                {i > 0 && ", "}
                <b className="font-medium text-ink">{date(h.from)}{h.to !== h.from && ` – ${date(h.to)}`}</b> (Kp {h.kp})
              </span>
            ))}. Long-range outlooks follow the Sun&apos;s 27-day rotation, so treat them as hints and check clouds on the day.</>
          ) : (
            <>No stormy days expected in the next four weeks. Kp 2–3 nights can still deliver from dark spots.</>
          )}
        </p>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="pb-1 text-[10px] text-faint">{d}</span>
          ))}
          {Array.from({ length: lead }, (_, i) => <span key={`pad${i}`} />)}
          {days.map((d) => (
            <div key={d.date} title={`${date(d.date)} · Kp ${d.kp}`}
              className={`rounded-lg py-2 ${CELL[Math.min(d.kp, 5)]}`}>
              <span className="block text-xs">{Number(d.date.slice(8))}</span>
              <span className="block font-mono text-[10px] opacity-70">{d.kp}</span>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
}
