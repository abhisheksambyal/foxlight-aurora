import type { AuroraData } from "@/lib/data";
import { nightLabel, nightOf } from "@/lib/forecast";
import { day } from "@/lib/format";
import { NightColumns, type NightView } from "./NightColumns";
import { Section } from "./ui";

export function Nights({ data }: { data: AuroraData }) {
  const now = new Date(data.generatedAt);
  const spotName = (id: string) => data.spots.find((s) => s.id === id)?.name ?? id;

  const nights: NightView[] = data.nights.slice(0, 3).map((n) => {
    const hours = data.hours.filter((h) => nightOf(h.time) === n.date && h.sunAlt < -6);
    return {
      ...n,
      label: nightLabel(n.date, now).replace(/ night$/, ""),
      day: day(hours[0]?.time ?? n.start),
      spot: spotName(n.spotId),
      hours: hours.map((h) => ({ time: h.time, score: h.score, kp: h.kp, cloud: h.cloud, spot: spotName(h.spotId) })),
    };
  });
  if (!nights.length) return null;

  return (
    <Section id="nights" title="Next nights" hint="Hourly chance · Kp forecast × clouds × darkness">
      <NightColumns nights={nights} />
    </Section>
  );
}
