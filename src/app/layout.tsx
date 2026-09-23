import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { appUrl } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Plus Jakarta Sans is the display face: a clean, modern geometric sans with
 * enough weight contrast for headings without reading as decorative, keeping
 * the site feeling institutional and premium rather than like a generic
 * dashboard.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "One Button Studio by CARISCA: Podcast, Video and Content Studio in Kumasi",
    template: "%s : One Button Studio",
  },
  description:
    "Book One Button Studio, a creative content production space by CARISCA in Kumasi, for podcasts, interviews, educational content, research communication and social media. Professional audio and video, flexible hourly and daily packages, instant online booking.",
  applicationName: "One Button Studio",
  keywords: [
    "One Button Studio",
    "CARISCA studio",
    "content studio Kumasi",
    "podcast studio Kumasi",
    "video studio Kumasi",
    "content creation studio Ghana",
    "recording studio KNUST",
    "research communication studio",
  ],
  authors: [{ name: "CARISCA" }],
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: "One Button Studio",
    title: "One Button Studio by CARISCA: Create. Record. Share.",
    description:
      "A creative content production space by CARISCA in Kumasi, for podcasts, interviews, educational content, research communication and business content. Book online in minutes.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "One Button Studio by CARISCA: Create. Record. Share.",
    description:
      "Book a professional podcast, video and content studio in Kumasi. Flexible hourly and daily packages.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
  formatDetection: { telephone: true, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#0a2961",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GH"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
