import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import RegisterServiceWorker from "./RegisterServiceWorker";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "QRTurnover — cleaning verification for STR hosts",
  description: "See exactly what got cleaned, zone by zone, without calling anyone.",
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
      </body>
    </html>
  );
}
