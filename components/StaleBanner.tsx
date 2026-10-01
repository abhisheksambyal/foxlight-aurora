"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 60000);
  return () => clearInterval(id);
};
const minuteNow = () => Math.floor(Date.now() / 60000);

/**
 * Warns when the page itself is old: normally it is rebuilt every 10 minutes, so an old page means the scheduled
 * update stopped or a critical data source is down. Computed in the browser, so it works when nothing else does.
 */
export function StaleBanner({ generatedAt }: { generatedAt: string }) {
  const now = useSyncExternalStore(subscribe, minuteNow, () => null);
  if (now === null) return null;
  const age = now - Math.floor(Date.parse(generatedAt) / 60000);
  if (age < 75) return null;
  const ago = age >= 120 ? `${Math.round(age / 60)} hours` : `${age} minutes`;
  return (
    <div role="alert" className="mt-6 rounded-2xl border border-maybe/40 bg-maybe/10 p-4 text-sm leading-relaxed text-maybe">
      This forecast was last updated {ago} ago, so live conditions may have changed. For the latest, check{" "}
      <a href="https://en.ilmatieteenlaitos.fi/northern-lights" className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
        FMI&apos;s northern lights page
      </a>.
    </div>
  );
}
