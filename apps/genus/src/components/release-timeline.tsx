interface ReleaseGroup {
  id: string
  title: string
  'primary-type'?: string
  'secondary-types'?: string[]
  'first-release-date'?: string
}

interface Props {
  releaseGroups: ReleaseGroup[]
  familyHue: number
}

function isSkippable(rg: ReleaseGroup): boolean {
  const title = rg.title.toLowerCase()
  const secondaryTypes = (rg['secondary-types'] ?? []).map(t => t.toLowerCase())
  // Skip if bad secondary type
  if (secondaryTypes.some(t => ['remix', 'live', 'compilation', 'mixtape/street', 'demo', 'dj-mix'].includes(t))) return true
  // Skip if title suggests it's a variant
  if (/\b(remix|remixed|remixes|deluxe|remaster|remastered|anniversary|re-issue|reissue|live|bonus|expanded|edition|version)\b/i.test(title)) return true
  return false
}

export function ReleaseTimeline({ releaseGroups, familyHue }: Props) {
  const filtered = releaseGroups
    .filter(rg => !isSkippable(rg) && rg['first-release-date'])
    .sort((a, b) => (a['first-release-date'] ?? '').localeCompare(b['first-release-date'] ?? ''))

  if (filtered.length === 0) return null

  const years = filtered.map(rg => parseInt(rg['first-release-date']!.slice(0, 4)))
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years, minYear)
  const span = Math.max(maxYear - minYear, 1)

  // Group by year
  const byYear = new Map<number, ReleaseGroup[]>()
  for (const rg of filtered) {
    const y = parseInt(rg['first-release-date']!.slice(0, 4))
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(rg)
  }

  const typeColor = (type?: string) => {
    if (type === 'Album') return `oklch(68% 0.2 ${familyHue})`
    if (type === 'EP') return `oklch(68% 0.15 ${(familyHue + 30) % 360})`
    return `oklch(55% 0.1 ${familyHue})`
  }

  return (
    <div className="space-y-3">
      {/* Year labels + dots */}
      <div className="relative h-20 w-full overflow-x-auto">
        <div className="relative h-full" style={{ minWidth: `${Math.max(span * 28, 300)}px` }}>
          {/* Timeline base line */}
          <div
            className="absolute top-8 left-0 right-0 h-px"
            style={{ background: `oklch(65% 0.1 ${familyHue} / 0.3)` }}
          />

          {Array.from(byYear.entries()).map(([year, rgs]) => {
            const pct = span === 0 ? 50 : ((year - minYear) / span) * 100
            return (
              <div
                key={year}
                className="absolute flex flex-col items-center gap-1"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              >
                {/* Stacked dots for multiple releases in same year */}
                <div className="flex gap-0.5 items-end" style={{ marginTop: `${Math.max(0, 20 - rgs.length * 4)}px` }}>
                  {rgs.map(rg => (
                    <div
                      key={rg.id}
                      className="rounded-full transition-transform hover:scale-125"
                      title={`${rg.title} (${rg['first-release-date']?.slice(0, 4)})`}
                      style={{
                        width: rg['primary-type'] === 'Album' ? 12 : 8,
                        height: rg['primary-type'] === 'Album' ? 12 : 8,
                        background: typeColor(rg['primary-type']),
                        boxShadow: `0 0 6px ${typeColor(rg['primary-type'])}`,
                      }}
                    />
                  ))}
                </div>
                {/* Year label */}
                <div className="text-xs text-muted-foreground whitespace-nowrap" style={{ marginTop: '22px' }}>
                  {year}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: typeColor('Album') }} /> Album
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: typeColor('EP') }} /> EP / Single
        </span>
      </div>
    </div>
  )
}
