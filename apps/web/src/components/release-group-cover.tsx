'use client'

import Link from 'next/link'
import { GeneratedAvatar } from '@/lib/avatar'

interface ReleaseGroupCoverProps {
  rg: {
    id: string
    title: string
    'primary-type'?: string | null
    'first-release-date'?: string | null
  }
  genres: string[]
}

export function ReleaseGroupCover({ rg, genres }: ReleaseGroupCoverProps) {
  const coverUrl = `https://coverartarchive.org/release-group/${rg.id}/front-250`
  const year = rg['first-release-date']?.slice(0, 4) || null

  return (
    <Link
      href={`/release-group/${rg.id}`}
      className="group flex flex-col gap-2"
    >
      <div className="relative w-full aspect-square overflow-hidden rounded-md bg-neutral-800 shadow-md group-hover:shadow-lg card-hover">
        <img
          src={coverUrl}
          alt={rg.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        {/* Fallback avatar — hidden by default, shown via JS onError */}
        <div
          className="absolute inset-0 items-center justify-center"
          style={{ display: 'none' }}
          aria-hidden="true"
        >
          <GeneratedAvatar id={rg.id} name={rg.title} genres={genres} size={200} />
        </div>
      </div>
      <div className="space-y-0.5 px-0.5">
        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {rg.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {[year, rg['primary-type']].filter(Boolean).join(' · ') || 'Unknown'}
        </p>
      </div>
    </Link>
  )
}
