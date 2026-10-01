import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Foxlight Aurora — Northern Lights Forecast for Oulu, Finland",
  description:
    "When and where to see the aurora (revontulet) in Oulu tonight. Live Kp index, solar wind, FMI cloud cover and the best dark-sky spots near Oulu.",
  applicationName: "Foxlight Aurora",
  openGraph: {
    title: "Foxlight Aurora — Northern Lights Forecast for Oulu",
    description: "Tonight’s aurora chance in Oulu, the best time, and where to go.",
    type: "website",
    locale: "en_GB",
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
