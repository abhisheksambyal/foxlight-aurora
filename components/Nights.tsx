import type { AuroraData } from "@/lib/data";
import { nightLabel, nightOf } from "@/lib/forecast";
import { date } from "@/lib/format";
import { NightColumns, type NightView } from "./NightColumns";
import { Section } from "./ui";
import { Term } from "./Term";

export function Nights({ data }: { data: AuroraData }) {
  const now = new Date(data.generatedAt);
  const spotName = (id: string) => data.spots.find((s) => s.id === id)?.name ?? id;

  const nights: NightView[] = data.nights.slice(0, 3).map((n) => {
    const hours = data.hours.filter((h) => nightOf(h.time) === n.date && h.sunAlt < -6);
    return {
      ...n,
      label: nightLabel(n.date, now).replace(/ night$/, ""),
      // The evening the night starts on (after midnight, "Tonight" is still the previous evening's night).
      day: date(n.date),
      spot: spotName(n.spotId),
      hours: hours.map((h) => ({ time: h.time, score: h.score, kp: h.kp, cloud: h.cloud, spot: spotName(h.spotId) })),
    };
  });
  if (!nights.length) return null;

  return (
    <Section id="nights" title="Next nights" hint={<><Term k="chance">Hourly chance</Term> · <Term k="kp">Kp</Term> forecast × clouds × darkness</>}>
      <NightColumns nights={nights} />
    </Section>
  );
}
