// Downloads every source and writes one snapshot (data/aurora.json) that the page and data.json are built from.
// Runs in plain Node, outside Next.js, so no response is ever reused from an earlier build.
// Exits non-zero when a critical source is missing: the deploy is skipped and the last good site stays online.
import { mkdirSync, writeFileSync } from "node:fs";
import { getAuroraData } from "../lib/data";

const data = await getAuroraData();
mkdirSync("data", { recursive: true });
writeFileSync("data/aurora.json", JSON.stringify(data));

const n = data.now;
console.log(`[aurora] snapshot ${data.generatedAt} · Kp ${n.kp} · nowcast ${n.effectiveKp.toFixed(2)} (${n.driver}) · ${n.alert}`);
console.log(`[aurora] sources: ${data.sources.map((s) => `${s.id}=${s.status}`).join(" ")}`);
