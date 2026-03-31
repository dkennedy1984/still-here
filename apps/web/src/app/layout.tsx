import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://sitwithyou.app"),
  title: {
    default: "Sit With You — Quiet body doubling for when starting is hard",
    template: "%s — Sit With You",
  },
  description:
    "Quiet company when you need it. Sit With You is a calm body doubling companion — call for gentle presence when starting feels hard. No pressure, no judgement.",
  keywords: [
    "body doubling",
    "ADHD",
    "executive function",
    "virtual body doubling",
    "focus",
    "neurodivergent",
    "quiet company",
    "task initiation",
  ],
  authors: [{ name: "Sit With You" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://sitwithyou.app",
    siteName: "Sit With You",
    title: "Sit With You — Quiet body doubling for when starting is hard",
    description:
      "Quiet company when you need it. Sit With You is a calm body doubling companion — call for gentle presence when starting feels hard. No pressure, no judgement.",
    images: [
      {
        url: "/branding/og-image.png",
        width: 1376,
        height: 768,
        alt: "Sit With You — quiet body doubling",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sit With You — Quiet body doubling for when starting is hard",
    description:
      "Quiet company when you need it. Sit With You is a calm body doubling companion — call for gentle presence when starting feels hard. No pressure, no judgement.",
    images: ["/branding/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://sitwithyou.app",
  },
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
        <script dangerouslySetInnerHTML={{ __html: `
          // Kill any lingering audio from previous page
          if (window.location.pathname !== '/call') {
            document.querySelectorAll('audio').forEach(function(a) { a.pause(); a.remove(); });
            var pa = document.getElementById('swy-presence-audio');
            if (pa) { pa.pause(); pa.remove(); }
            if (window.__presenceAudio) { window.__presenceAudio.pause(); window.__presenceAudio = null; }
          }
        `}} />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-950`}>
        {children}
      </body>
    </html>
  );
}
