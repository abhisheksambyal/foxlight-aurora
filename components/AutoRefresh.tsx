"use client";

import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const CHECK_EVERY = 5 * 60 * 1000;
// The page and data.json come from the same build, seconds apart; only a clearly newer build counts.
const NEWER_BY = 10 * 60 * 1000;

/** The site is rebuilt every ~30 min. Reload when a newer build is live (checked every 5 min and on tab focus). */
export function AutoRefresh({ generatedAt }: { generatedAt: string }) {
  useEffect(() => {
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < CHECK_EVERY) return;
      last = Date.now();
      try {
        const res = await fetch(`${BASE}/data.json`, { cache: "no-store" });
        const { generatedAt: latest } = await res.json();
        if (Date.parse(latest) - Date.parse(generatedAt) > NEWER_BY) location.reload();
      } catch {}
    };
    check();
    const id = setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [generatedAt]);
  return null;
}
