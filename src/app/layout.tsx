import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Drift OS | AI Advisor Platform",
  description: "Elite AI Operating System for financial firms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full dark antialiased ${GeistSans.variable} ${GeistMono.variable}`} style={{ colorScheme: "dark" }}>
      <body className="min-h-full flex flex-col bg-[#09090b] selection:bg-emerald-500/30">
        {children}
        <Toaster position="top-right" theme="dark" closeButton richColors />
      </body>
    </html>
  );
}
