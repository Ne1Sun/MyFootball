import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { RouteTransitionBar } from "./components/layout/RouteTransitionBar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f141c" },
    { media: "(prefers-color-scheme: light)", color: "#f1f4f9" },
  ],
};

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MyFootball Bharat | The Digital Backbone for Indian Football",
  description:
    "India's premier digital football tournament operations platform. Run professional tournaments, pitch-side live match consoles, 2D tactical lineups, knockout brackets, and club rosters.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('myfootball-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()` }} />
      </head>
      <body
        className={`${plusJakarta.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <RouteTransitionBar />
        {children}
      </body>
    </html>
  );
}
