import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · Oulu northern lights forecast`,
    short_name: "Foxlight",
    description: SITE_DESCRIPTION,
    id: `${BASE}/`,
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: "standalone",
    background_color: "#05080d",
    theme_color: "#05080d",
    categories: ["weather"],
    // Installable as an app: Chrome wants 192 and 512 px PNGs; Android crops "maskable" icons to its own shape.
    icons: [
      { src: `${BASE}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE}/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${BASE}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${BASE}/icon.svg`, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
