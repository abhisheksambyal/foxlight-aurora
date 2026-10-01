import { getAuroraData } from "@/lib/data";

export const dynamic = "force-static";

/** The same aggregated NOAA + FMI data the page is built from, for your own tools. */
export async function GET() {
  return Response.json(await getAuroraData());
}
