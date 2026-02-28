'use client'

import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [isPending, startTransition] = useTransition()

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      if (value.trim().length >= 2) {
        startTransition(() => {
          router.push(`/?q=${encodeURIComponent(value.trim())}`)
        })
      }
    },
    [router]
  )

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Input
        type="search"
        placeholder="Search for artists, songs, albums..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="h-14 text-lg px-6 rounded-full"
      />
      {isPending && (
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Searching...
        </p>
      )}
    </div>
  )
}
