import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Still Here — ADHD Body Doubling",
  description:
    "Virtual co-working sessions for people with ADHD. Focus together, stay accountable, and get things done with body doubling.",
  keywords: ["ADHD", "body doubling", "focus", "co-working", "accountability", "productivity"],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
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
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
