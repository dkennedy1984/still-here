import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sit With You — Quiet body doubling for when starting is hard",
  description:
    "Quiet company when you need it. Sit With You lets you call for presence and start gently — no pressure, no productivity talk.",
  alternates: { canonical: "https://sitwithyou.app" },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-950`}>
        {children}
      </body>
    </html>
  );
}
