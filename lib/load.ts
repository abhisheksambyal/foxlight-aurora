import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuroraData } from "./data";

/** The snapshot written by scripts/fetch-data.mts (run before every build and dev start). */
export function loadAuroraData(): AuroraData {
  return JSON.parse(readFileSync(join(process.cwd(), "data/aurora.json"), "utf8"));
}
