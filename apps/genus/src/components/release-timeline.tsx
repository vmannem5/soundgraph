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

export function isSkippable(rg: ReleaseGroup): boolean {
  const secondaryTypes = (rg['secondary-types'] ?? []).map(t => t.toLowerCase())
  if (secondaryTypes.some(t => ['remix', 'live', 'compilation', 'mixtape/street', 'demo', 'dj-mix'].includes(t))) return true
  if (/\b(remix|remixed|remixes|deluxe|remaster|remastered|anniversary|re-issue|reissue|live|bonus|expanded|edition|version)\b/i.test(rg.title)) return true
  return false
}

// Bar heights per release type (proxy for relative impact)
const BAR_HEIGHTS: Record<string, number> = {
  Album: 48,
  EP: 28,
  Single: 16,
  Other: 12,
}

function barHeight(type?: string): number {
  return BAR_HEIGHTS[type ?? 'Other'] ?? 12
}

export function ReleaseTimeline({ releaseGroups, familyHue }: Props) {
  const filtered = releaseGroups
    .filter(rg => !isSkippable(rg) && rg['first-release-date'])
    .sort((a, b) => (a['first-release-date'] ?? '').localeCompare(b['first-release-date'] ?? ''))

  if (filtered.length === 0) return null

  const years = filtered.map(rg => parseInt(rg['first-release-date']!.slice(0, 4)))
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  // Group by year, separated into Albums and EPs/Singles
  type YearBucket = { albums: ReleaseGroup[]; eps: ReleaseGroup[]; singles: ReleaseGroup[] }
  const byYear = new Map<number, YearBucket>()
  for (let y = minYear; y <= maxYear; y++) byYear.set(y, { albums: [], eps: [], singles: [] })
  for (const rg of filtered) {
    const y = parseInt(rg['first-release-date']!.slice(0, 4))
    const bucket = byYear.get(y)!
    const t = rg['primary-type'] ?? ''
    if (t === 'Album') bucket.albums.push(rg)
    else if (t === 'EP') bucket.eps.push(rg)
    else bucket.singles.push(rg)
  }

  // SVG layout
  const COL_W = 36        // width per year column
  const BAR_W = 20        // bar width
  const MAX_STACK = 120   // max stacked bar height
  const LABEL_H = 20      // year label area below bars
  const PAD_TOP = 8
  const SVG_H = MAX_STACK + LABEL_H + PAD_TOP
  const yearList = Array.from(byYear.keys()).sort((a, b) => a - b)
  const SVG_W = yearList.length * COL_W + 16

  // Colors
  const albumColor = `oklch(68% 0.22 ${familyHue})`
  const epColor = `oklch(58% 0.14 ${(familyHue + 40) % 360})`
  const singleColor = `oklch(48% 0.08 ${familyHue})`

  function stackedBars(year: number, bucket: YearBucket, x: number) {
    const bars: Array<{ rg: ReleaseGroup; color: string; h: number }> = [
      ...bucket.albums.map(rg => ({ rg, color: albumColor, h: BAR_HEIGHTS.Album })),
      ...bucket.eps.map(rg => ({ rg, color: epColor, h: BAR_HEIGHTS.EP })),
      ...bucket.singles.map(rg => ({ rg, color: singleColor, h: BAR_HEIGHTS.Single })),
    ]
    if (bars.length === 0) return null

    const totalH = Math.min(bars.reduce((s, b) => s + b.h, 0), MAX_STACK)
    const barX = x + (COL_W - BAR_W) / 2

    let currentY = PAD_TOP + MAX_STACK - totalH
    const rects: React.ReactNode[] = []

    for (const bar of bars) {
      const h = Math.min(bar.h, MAX_STACK - (currentY - PAD_TOP))
      if (h <= 0) break
      rects.push(
        <rect
          key={bar.rg.id}
          x={barX}
          y={currentY}
          width={BAR_W}
          height={h}
          fill={bar.color}
          rx={2}
          style={{ cursor: 'pointer' }}
        >
          <title>{bar.rg.title} ({year}) — {bar.rg['primary-type'] ?? 'Release'}</title>
        </rect>
      )
      // Small gap between stacked segments
      currentY += h + 1
    }

    return rects
  }

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <svg
          width={SVG_W}
          height={SVG_H}
          style={{ display: 'block', minWidth: '100%' }}
        >
          {/* Baseline */}
          <line
            x1={0} y1={PAD_TOP + MAX_STACK}
            x2={SVG_W} y2={PAD_TOP + MAX_STACK}
            stroke={`oklch(65% 0.1 ${familyHue} / 0.2)`}
            strokeWidth={1}
          />

          {yearList.map((year, i) => {
            const bucket = byYear.get(year)!
            const x = i * COL_W + 8
            const hasReleases = bucket.albums.length + bucket.eps.length + bucket.singles.length > 0

            return (
              <g key={year}>
                {stackedBars(year, bucket, x)}

                {/* Year label — only show if has releases or is a decade marker */}
                {(hasReleases || year % 5 === 0) && (
                  <text
                    x={x + COL_W / 2}
                    y={PAD_TOP + MAX_STACK + LABEL_H - 2}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    fillOpacity={hasReleases ? 0.6 : 0.25}
                    style={{ userSelect: 'none' }}
                  >
                    {year}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: albumColor }} />
          Album
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: epColor }} />
          EP
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-1.5 rounded-sm" style={{ background: singleColor }} />
          Single
        </span>
        <span className="text-muted-foreground/50 ml-auto">Bar height = release weight</span>
      </div>
    </div>
  )
}
