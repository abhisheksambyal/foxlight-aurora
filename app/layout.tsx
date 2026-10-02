import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "northern lights Oulu", "aurora forecast Oulu", "aurora borealis Finland", "revontulet Oulu",
    "revontuliennuste", "Kp index", "northern lights tonight", "where to see northern lights in Oulu",
  ],
  alternates: { canonical: "/" },
  verification: { google: "PWzsl5iJmBS-BFo1mwHvX3XZCzAYZ5Ce8vorhV1oGY0" },
  openGraph: {
    title: `${SITE_NAME} · Northern lights forecast for Oulu`,
    description: "Tonight’s aurora chance in Oulu, the best time, and where to go.",
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · Northern lights forecast for Oulu`,
    description: "Tonight’s aurora chance in Oulu, the best time, and where to go.",
  },
};

export const viewport: Viewport = { themeColor: "#05080d", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
