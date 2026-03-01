'use client'

import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (value.trim().length >= 2) {
        debounceRef.current = setTimeout(() => {
          startTransition(() => {
            router.push(`/?q=${encodeURIComponent(value.trim())}`)
          })
        }, 300)
      }
    },
    [router]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <Input
          type="search"
          placeholder="Search for artists, songs, albums..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-14 text-lg pl-14 pr-6 rounded-full border-2 focus:border-primary/50 transition-all"
        />
      </div>
      {isPending && (
        <div className="mt-8 w-full max-w-3xl space-y-6">
          {/* Artist skeleton */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2.5 p-4">
                <div className="w-24 h-24 rounded-full bg-white/5 animate-pulse" />
                <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Song skeletons */}
          <div className="rounded-xl border border-white/5 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                <div className="w-5" />
                <div className="w-11 h-11 rounded-md bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 bg-white/5 rounded animate-pulse" />
                  <div className="h-2.5 w-28 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
