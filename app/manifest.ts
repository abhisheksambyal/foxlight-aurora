import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · Oulu northern lights forecast`,
    short_name: "Foxlight",
    description: SITE_DESCRIPTION,
    start_url: `${BASE}/`,
    display: "standalone",
    background_color: "#05080d",
    theme_color: "#05080d",
    icons: [
      { src: `${BASE}/icon.svg`, sizes: "any", type: "image/svg+xml" },
      { src: `${BASE}/apple-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  };
}
