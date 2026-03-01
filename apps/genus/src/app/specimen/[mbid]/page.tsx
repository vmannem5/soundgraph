import Link from 'next/link'
import { getSpecimenDetail, getArtistHybridData } from '@/lib/data-service'
import { SoundProfileRadar } from '@/components/sound-profile-radar'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ mbid: string }>
}

const LEVEL_LABELS: Record<string, string> = {
  family: 'Sound Family',
  movement: 'Movement',
  scene: 'Scene',
  sound: 'Sound',
  strain: 'Strain',
}

export default async function SpecimenPage({ params }: Props) {
  const { mbid } = await params
  const [specimen, hybrid] = await Promise.all([
    getSpecimenDetail(mbid),
    getArtistHybridData(mbid),
  ])

  if (!specimen) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to GENUS
        </Link>
        <p className="mt-8 text-muted-foreground">
          Specimen not found in GENUS classification system.
        </p>
        <p className="text-xs text-muted-foreground mt-1">MBID: {mbid}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: '220px' }}>
        {specimen.imageUrl ? (
          <>
            <img
              src={specimen.imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(40px)', transform: 'scale(1.15)', opacity: 0.35 }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-background" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-background" />
        )}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-6 pb-8 flex items-end gap-6">
          {/* Artist photo */}
          {specimen.imageUrl && (
            <div className="shrink-0 rounded-full overflow-hidden ring-4 ring-white/20 shadow-2xl bg-neutral-800" style={{ width: 100, height: 100 }}>
              <img src={specimen.imageUrl} alt={specimen.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex flex-col gap-1 pb-1">
            <nav className="text-sm text-white/60 flex items-center gap-1.5 flex-wrap">
              <Link href="/" className="hover:text-white">GENUS</Link>
              {specimen.lineage.map((segment, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span>›</span>
                  <span className="text-white/50">{segment}</span>
                </span>
              ))}
            </nav>
            <h1 className="text-4xl font-black text-white drop-shadow-lg">{specimen.name}</h1>
            {specimen.type && <div className="text-sm text-white/60">{specimen.type}{specimen.country ? ` · ${specimen.country}` : ''}</div>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      {/* 3-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left: Classification */}
        <aside className="space-y-6">
          {specimen.classifications.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lineage</div>
              {specimen.classifications.map(c => (
                <Link
                  key={c.taxonomyId}
                  href={`/lineage/${c.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 border border-border hover:bg-accent transition-colors"
                >
                  <div className="text-xs text-muted-foreground w-20 shrink-0">{LEVEL_LABELS[c.level] ?? c.level}</div>
                  <div className="text-sm font-medium">{c.name}</div>
                </Link>
              ))}
            </div>
          )}

          {specimen.tags.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sound Signature</div>
              <div className="flex flex-wrap gap-1.5">
                {specimen.tags.slice(0, 8).map(t => (
                  <span key={t.tag} className="px-2 py-0.5 rounded-full text-xs border border-border text-muted-foreground">
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center: Radar */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">Sound Profile</div>
          {specimen.soundProfile ? (
            <SoundProfileRadar values={specimen.soundProfile} />
          ) : (
            <div className="w-full aspect-square rounded-xl border border-border flex items-center justify-center">
              <p className="text-xs text-muted-foreground text-center px-4">
                Sound Profile not computed yet.
              </p>
            </div>
          )}
        </div>

        {/* Right: Origins + Related */}
        <aside className="space-y-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Origins</div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
              {specimen.country && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geography</span>
                  <span>{specimen.country}</span>
                </div>
              )}
              {specimen.primaryFamily && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sound Family</span>
                  <Link href={`/lineage/${specimen.primaryFamilySlug}`} style={{ color: 'var(--genus-gold)' }}>
                    {specimen.primaryFamily}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {specimen.relatedSpecimens.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Related Specimens</div>
              <div className="space-y-1">
                {specimen.relatedSpecimens.map(rel => (
                  <Link
                    key={rel.mbid}
                    href={`/specimen/${rel.mbid}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent transition-colors group"
                  >
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{rel.name}</span>
                    {rel.primaryFamily && <span className="text-xs text-muted-foreground">{rel.primaryFamily}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

        </aside>
      </div>

      {/* Hybrid sections — SoundGraph connection data */}
      {(hybrid.collaborators.length > 0 || hybrid.samplesFrom.length > 0 || hybrid.sampledBy.length > 0) && (
        <div className="border-t border-border pt-8 space-y-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Connections
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Collaborators */}
            {hybrid.collaborators.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Top Collaborators
                </div>
                <div className="space-y-1">
                  {hybrid.collaborators.map(a => (
                    <Link
                      key={a.mbid}
                      href={`/specimen/${a.mbid}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent transition-colors group"
                    >
                      <span className="text-sm font-medium group-hover:text-primary transition-colors truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{a.count} tracks</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Sampled from */}
            {hybrid.samplesFrom.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Sampled From
                </div>
                <div className="space-y-1">
                  {hybrid.samplesFrom.map(r => (
                    <div key={r.mbid} className="px-3 py-2 rounded-lg border border-border/50">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      {r.artistName && <div className="text-xs text-muted-foreground truncate">{r.artistName}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sampled by */}
            {hybrid.sampledBy.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Sampled By
                </div>
                <div className="space-y-1">
                  {hybrid.sampledBy.map(r => (
                    <div key={r.mbid} className="px-3 py-2 rounded-lg border border-border/50">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      {r.artistName && <div className="text-xs text-muted-foreground truncate">{r.artistName}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Album art — Cover Art Archive */}
      <AlbumCovers mbid={mbid} />

      </div>
    </main>
  )
}

async function AlbumCovers({ mbid }: { mbid: string }) {
  // Fetch release groups from MusicBrainz
  const rgs = await fetch(
    `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&limit=8&fmt=json`,
    { headers: { 'User-Agent': 'MusicGenus/0.1.0 (musicgenus.com)' }, next: { revalidate: 86400 } }
  )
    .then(r => r.ok ? r.json() : null)
    .then(d => (d?.['release-groups'] ?? []) as Array<{ id: string; title: string; 'primary-type'?: string; 'first-release-date'?: string }>)
    .catch(() => [])

  if (!rgs.length) return null

  return (
    <div className="border-t border-border pt-8 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Discography</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {rgs.map(rg => (
          <div key={rg.id} className="space-y-1">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={`https://coverartarchive.org/release-group/${rg.id}/front-250`}
                alt={rg.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-xs font-medium truncate">{rg.title}</div>
            {rg['first-release-date'] && (
              <div className="text-xs text-muted-foreground">{rg['first-release-date'].slice(0, 4)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
