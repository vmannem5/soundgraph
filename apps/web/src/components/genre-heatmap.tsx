import type { GenreYearEntry } from '@/lib/data-service'

interface Props {
  data: GenreYearEntry[]
}

// Deterministic hue 0-359 from a string
function genreHue(tag: string): number {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff
  return h % 360
}

export function GenreHeatmap({ data }: Props) {
  if (!data.length) return null

  // Pick top 8 genres by total count across all years
  const genreTotals = new Map<string, number>()
  for (const row of data) {
    genreTotals.set(row.tag, (genreTotals.get(row.tag) || 0) + row.total_count)
  }
  const topGenres = [...genreTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag)

  if (!topGenres.length) return null

  // Group years into 2-year buckets, sorted ascending
  const allYears = [...new Set(data.map(r => r.year))].sort((a, b) => a - b)
  const minYear = allYears[0]
  const maxYear = allYears[allYears.length - 1]
  const eras: number[] = []
  for (let y = minYear; y <= maxYear; y += 2) eras.push(y)

  // Build lookup: tag → era → count
  const lookup = new Map<string, Map<number, number>>()
  for (const row of data) {
    const era = row.year % 2 === 0 ? row.year : row.year - 1
    if (!lookup.has(row.tag)) lookup.set(row.tag, new Map())
    const tagMap = lookup.get(row.tag)!
    tagMap.set(era, (tagMap.get(era) || 0) + row.total_count)
  }

  // Global max for opacity normalization
  let globalMax = 1
  for (const tagMap of lookup.values()) {
    for (const count of tagMap.values()) {
      if (count > globalMax) globalMax = count
    }
  }

  const cellOpacity = (count: number) =>
    count === 0 ? 0 : 0.08 + (count / globalMax) * 0.77

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Sound Evolution</h2>
      <div className="w-full overflow-x-auto">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${eras.length}, minmax(36px, 1fr))`,
            gap: '2px',
            minWidth: `${120 + eras.length * 38}px`,
          }}
        >
          {/* Header row */}
          <div />
          {eras.map(era => (
            <div
              key={era}
              className="text-center text-[10px] text-muted-foreground pb-1 font-medium"
            >
              {era}
            </div>
          ))}

          {/* Genre rows */}
          {topGenres.map(tag => {
            const hue = genreHue(tag)
            const color = `oklch(72% 0.18 ${hue})`
            return (
              <div key={tag} style={{ display: 'contents' }}>
                <div
                  className="text-xs font-medium truncate pr-2 flex items-center"
                  style={{ color }}
                >
                  {tag}
                </div>
                {eras.map(era => {
                  const count = lookup.get(tag)?.get(era) || 0
                  return (
                    <div
                      key={`${tag}-${era}`}
                      title={count > 0 ? `${tag} · ${era}–${era + 1}: ${count}` : undefined}
                      style={{
                        height: 28,
                        borderRadius: 4,
                        background: count > 0
                          ? `oklch(65% 0.20 ${hue} / ${cellOpacity(count).toFixed(2)})`
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid oklch(65% 0.12 ${hue} / ${count > 0 ? 0.3 : 0.06})`,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
