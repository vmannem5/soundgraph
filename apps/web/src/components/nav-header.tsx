'use client'

import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'

export function NavHeader() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
          SoundGraph
        </Link>
        <nav className="flex gap-4 items-center text-sm text-muted-foreground">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full border flex items-center justify-center hover:bg-accent transition-all hover:scale-105"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  )
}
