import { Advanced } from "@/components/Advanced";
import { AuroraFx } from "@/components/AuroraFx";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Hero } from "@/components/Hero";
import { Metrics } from "@/components/Metrics";
import { Nights } from "@/components/Nights";
import { Outlook } from "@/components/Outlook";
import { Spots } from "@/components/Spots";
import { Section } from "@/components/ui";
import { getAuroraData } from "@/lib/data";
import { day, time } from "@/lib/format";

const TIPS = [
  ["Look north", "In Oulu the aurora usually starts as a pale arc low on the northern horizon."],
  ["Give it 20 minutes", "Eyes need time to adapt. Avoid your phone screen — or set it to red/night mode."],
  ["Use your camera", "Phones in night mode see faint aurora as green before your eyes do."],
  ["Peak hours", "Activity over Finland usually peaks between 22:00 and 02:00, but can flare up any time it's dark."],
  ["Dress for −20 °C", "Waiting is part of it. Layers, a hat, and something warm to drink."],
];

export default async function Home() {
  const data = await getAuroraData();
  return (
    <>
    <AuroraFx kp={data.now.effectiveKp} />
    <main className="relative z-[1] mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <AutoRefresh generatedAt={data.generatedAt} />
      <Hero data={data} />
      <Nights data={data} />
      <Spots spots={data.spots} dark={data.now.sunAlt < -6} />
      <Metrics data={data} />
      <Outlook data={data} />

      <Section id="tips" title="First time?">
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {TIPS.map(([t, d]) => (
            <li key={t}>
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Advanced data={data} />

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-faint">
        <p className="mb-3 text-muted">
          Why Foxlight? In Finnish the aurora is <i lang="fi">revontulet</i> — &ldquo;fox fires&rdquo; — after the Arctic fox
          whose tail sweeps sparks from the snow into the sky.
        </p>
        <p>
          Updated {day(data.generatedAt)} {time(data.generatedAt)} (Oulu time) · updated about every 30 minutes.
        </p>
        <p className="mt-1">
          Data:{" "}
          <a className="underline underline-offset-4 hover:text-muted" href="https://en.ilmatieteenlaitos.fi/auroras-in-finland">FMI</a>,{" "}
          <a className="underline underline-offset-4 hover:text-muted" href="https://rwc-finland.fmi.fi/">RWC Finland</a>,{" "}
          <a className="underline underline-offset-4 hover:text-muted" href="https://www.swpc.noaa.gov/">NOAA SWPC</a>.
          A forecast, not a promise — the aurora is famously unpredictable.
        </p>
      </footer>
    </main>
    </>
  );
}
