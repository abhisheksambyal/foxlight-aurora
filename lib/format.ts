import { OULU, type Tone } from "./oulu";

const tz = OULU.tz;
const hm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });
const hh = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "22:00" in Oulu time. */
export const time = (iso: string) => hm.format(new Date(iso));
/** "22" in Oulu time. */
export const hour = (iso: string) => hh.format(new Date(iso));
/** "Thu 1 Oct" in Oulu time. */
export const day = (iso: string) => dayFmt.format(new Date(iso));
/** "Sat 4 Oct" for a plain YYYY-MM-DD date. */
export const date = (ymd: string) => dateFmt.format(new Date(ymd));

export const kp = (v: number | null) => (v === null ? "–" : v.toFixed(1));

export const TONE: Record<Tone, { text: string; bg: string; dot: string }> = {
  great: { text: "text-great", bg: "bg-great", dot: "bg-great shadow-[0_0_10px] shadow-great/60" },
  good: { text: "text-good", bg: "bg-good", dot: "bg-good" },
  maybe: { text: "text-maybe", bg: "bg-maybe", dot: "bg-maybe" },
  low: { text: "text-muted", bg: "bg-low", dot: "bg-low" },
};
