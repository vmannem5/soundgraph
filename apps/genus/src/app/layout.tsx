import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "GENUS",
  description: "Classify music. Trace lineage. Read the sound.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <header className="border-b border-border px-6 py-4 flex items-center gap-3">
          <span className="text-xl font-bold tracking-wider" style={{ color: 'var(--genus-gold)' }}>
            GENUS
          </span>
          <span className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
            Sound Classification
          </span>
        </header>
        {children}
      </body>
    </html>
  );
}
