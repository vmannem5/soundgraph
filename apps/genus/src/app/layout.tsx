import type { Metadata } from "next"
import { Cormorant_Garamond, Syne, Space_Mono } from "next/font/google"
import "./globals.css"
import Link from "next/link"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
})

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
})

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-custom",
})

export const metadata: Metadata = {
  title: "GENUS — Music Classification",
  description: "Every sound has a lineage. Classify artists. Trace the strain.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${syne.variable} ${spaceMono.variable}`}>
        <nav style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 32px',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg)',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'baseline', gap: '10px', textDecoration: 'none' }}>
            <span style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 700,
              fontSize: '1.4rem',
              letterSpacing: '0.14em',
              color: 'var(--gold)',
            }}>
              GENUS
            </span>
            <span style={{
              fontSize: '0.6rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--fg-muted)',
              fontWeight: 600,
              fontFamily: 'var(--font-syne)',
            }}>
              Sound Classification
            </span>
          </Link>
          <Link href="/search" style={{
            fontSize: '0.68rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--fg-muted)',
            textDecoration: 'none',
            fontFamily: 'var(--font-syne)',
            fontWeight: 600,
          }}>
            Search
          </Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
