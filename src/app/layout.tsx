import type { Metadata } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased dark ${GeistSans.variable} ${GeistMono.variable} ${dmSans.variable} ${dmMono.variable}`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var stored = localStorage.getItem('drift-theme');
                var isDark = stored ? stored === 'dark' : true;
                document.documentElement.classList.toggle('light', !isDark);
                document.documentElement.classList.toggle('dark', isDark);
                document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
              })()
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] selection:bg-emerald-500/30">
        {children}
        <Toaster position="top-right" theme="dark" closeButton richColors />
      </body>
    </html>
  );
}
