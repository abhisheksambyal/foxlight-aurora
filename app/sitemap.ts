import type { MetadataRoute } from "next";
import { loadAuroraData } from "@/lib/load";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // The page is rebuilt with fresh data many times a day; lastModified tells crawlers it is current.
  return [{ url: `${SITE_URL}/`, lastModified: loadAuroraData().generatedAt, changeFrequency: "hourly", priority: 1 }];
}
