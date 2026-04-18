import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Instrument_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Drift OS | AI Advisor Platform",
  description: "Elite AI Operating System for financial firms",
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-app-serif",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased light ${GeistSans.variable} ${GeistMono.variable} ${dmSans.variable} ${dmMono.variable} ${instrumentSerif.variable}`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] selection:bg-brand-500/30">
        {/* External file avoids React 19 warning about inline script nodes in the component tree */}
        <Script
          id="drift-theme-script"
          src="/drift-theme.js"
          strategy="beforeInteractive"
        />
        {children}
        <Toaster position="top-right" theme="light" closeButton richColors />
      </body>
    </html>
  );
}
