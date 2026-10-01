import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import RegisterServiceWorker from "./RegisterServiceWorker";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.qrturnover.com"),
  title: {
    default: "QRTurnover — Cleaning Verification for STR Hosts",
    template: "%s | QRTurnover",
  },
  description: "See exactly what got cleaned, zone by zone, without calling anyone.",
  openGraph: {
    type: "website",
    siteName: "QRTurnover",
    title: "QRTurnover — Cleaning Verification for STR Hosts",
    description: "Track short-term rental cleaning live with room QR codes, checklists, and photo proof.",
    images: [{ url: "/brand-logo-dark.png", width: 1200, height: 400, alt: "QRTurnover" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QRTurnover — Cleaning Verification for STR Hosts",
    description: "Track short-term rental cleaning live with room QR codes, checklists, and photo proof.",
    images: ["/brand-logo-dark.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QRTurnover",
  },
  icons: {
    icon: [
      { url: "/brand-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/brand-apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <RegisterServiceWorker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
