'use client'

import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchResults {
  artists: any[]
  recordings: any[]
  spotifyTracks?: any[]
  spotifyArtists?: any[]
}

// Deterministic color backgrounds for fallback avatars
const FALLBACK_COLORS = [
  '#c4956a', '#8b9cc4', '#6ec4a0', '#c46a8b',
  '#9b8bc4', '#c4c46a', '#6aabb4', '#c47a3a',
  '#7a8b9c', '#c45a5a',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getFallbackColor(name: string): string {
  return FALLBACK_COLORS[hashString(name) % FALLBACK_COLORS.length]
}

function findSpotifyTrack(recording: any, spotifyTracks: any[]): any | null {
  const title = recording.title?.toLowerCase()
  if (!title) return null

  const dbArtists = (recording['artist-credit'] || [])
    .map((c: any) => (c.name || c.artist?.name)?.toLowerCase())
    .filter(Boolean)

  for (const st of spotifyTracks) {
    if (st.name?.toLowerCase() !== title) continue
    const spArtists = (st.artists || []).map((a: any) => a.name?.toLowerCase())
    if (dbArtists.some((da: string) => spArtists.some((sa: string) => sa.includes(da) || da.includes(sa)))) {
      return st
    }
  }
  return null
}

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [dropdownResults, setDropdownResults] = useState<SearchResults | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false)
  }, [])

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeDropdown])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const fetchDropdownResults = useCallback(async (value: string) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsFetching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, {
        signal: controller.signal,
      })
      if (!res.ok) return
      const data: SearchResults = await res.json()
      setDropdownResults(data)
      setIsDropdownOpen(true)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setDropdownResults(null)
      }
    } finally {
      setIsFetching(false)
    }
  }, [])

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (value.trim().length < 2) {
        setIsDropdownOpen(false)
        setDropdownResults(null)
        return
      }

      debounceRef.current = setTimeout(() => {
        fetchDropdownResults(value)
      }, 300)
    },
    [fetchDropdownResults]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        closeDropdown()
        return
      }
      if (e.key === 'Enter' && query.trim().length >= 2) {
        closeDropdown()
        router.push(`/?q=${encodeURIComponent(query.trim())}`)
      }
    },
    [query, router, closeDropdown]
  )

  const handleSeeAll = useCallback(() => {
    closeDropdown()
    router.push(`/?q=${encodeURIComponent(query.trim())}`)
  }, [query, router, closeDropdown])

  const spotifyArtists = dropdownResults?.spotifyArtists || []
  const spotifyTracks = dropdownResults?.spotifyTracks || []
  const topArtists = (dropdownResults?.artists || []).slice(0, 4)
  const topRecordings = (dropdownResults?.recordings || []).slice(0, 5)
  const hasDropdownContent = topArtists.length > 0 || topRecordings.length > 0

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        {/* Search icon */}
        <svg
          className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
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

        {/* Spinner when fetching */}
        {isFetching && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4">
            <svg className="animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}

        <Input
          type="search"
          placeholder="Search for artists, songs, albums..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (dropdownResults && query.trim().length >= 2) setIsDropdownOpen(true)
          }}
          className="h-14 text-lg pl-14 pr-6 rounded-full border-2 focus:border-primary/50 transition-all"
          autoComplete="off"
        />

        {/* Dropdown overlay */}
        {isDropdownOpen && hasDropdownContent && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-sm overflow-hidden"
            style={{ zIndex: 50 }}
          >
            {/* Artists section */}
            {topArtists.length > 0 && (
              <div className="px-3 pt-3 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
                  Artists
                </p>
                <div className="flex flex-wrap gap-2">
                  {topArtists.map((artist: any) => {
                    const spArtist = spotifyArtists.find(
                      (sa: any) => sa.name?.toLowerCase() === artist.name?.toLowerCase()
                    )
                    const imageUrl = spArtist?.images?.[1]?.url || spArtist?.images?.[0]?.url
                    const fallbackColor = getFallbackColor(artist.id || artist.name)
                    const initial = (artist.name || '?')[0].toUpperCase()

                    return (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => {
                          closeDropdown()
                          router.push(`/artist/${artist.id}`)
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-muted/40 hover:bg-muted/80 transition-colors max-w-[160px]"
                      >
                        {/* 32px circle */}
                        <div
                          className="shrink-0 rounded-full overflow-hidden"
                          style={{ width: 32, height: 32, minWidth: 32 }}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={artist.name}
                              style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: fallbackColor }}
                            >
                              {initial}
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{artist.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Divider if both sections present */}
            {topArtists.length > 0 && topRecordings.length > 0 && (
              <div className="mx-3 border-t border-border/50" />
            )}

            {/* Recordings section */}
            {topRecordings.length > 0 && (
              <div className="px-3 pt-2 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
                  Songs
                </p>
                <div className="space-y-0.5">
                  {topRecordings.map((recording: any) => {
                    const spTrack = findSpotifyTrack(recording, spotifyTracks)
                    const albumArt = spTrack?.album?.images?.[2]?.url || spTrack?.album?.images?.[1]?.url
                    const fallbackColor = getFallbackColor(recording.id || recording.title)
                    const artistNames = (recording['artist-credit'] || [])
                      .map((c: any) => c.name || c.artist?.name)
                      .filter(Boolean)
                      .join(', ')

                    return (
                      <button
                        key={recording.id}
                        type="button"
                        onClick={() => {
                          closeDropdown()
                          router.push(`/recording/${recording.id}`)
                        }}
                        className="flex items-center gap-3 w-full px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        {/* 40px album art square */}
                        <div
                          className="shrink-0 rounded-md overflow-hidden"
                          style={{ width: 40, height: 40, minWidth: 40 }}
                        >
                          {albumArt ? (
                            <img
                              src={albumArt}
                              alt={recording.title}
                              style={{ width: 40, height: 40, objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ background: fallbackColor }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate leading-tight">{recording.title}</p>
                          {artistNames && (
                            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                              {artistNames}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* See all results footer */}
            <div className="border-t border-border/50 mx-0">
              <button
                type="button"
                onClick={handleSeeAll}
                className="w-full px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors text-left flex items-center justify-between"
              >
                <span>See all results for &ldquo;{query}&rdquo;</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
