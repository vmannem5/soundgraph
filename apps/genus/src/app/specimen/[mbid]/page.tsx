import Link from 'next/link'
import { getSpecimenDetail } from '@/lib/data-service'
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
  const specimen = await getSpecimenDetail(mbid)

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
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-foreground">GENUS</Link>
        {specimen.lineage.map((segment, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span>›</span>
            <span className="text-foreground/70">{segment}</span>
          </span>
        ))}
        <span>›</span>
        <span className="font-semibold text-foreground">{specimen.name}</span>
      </nav>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left: Classification */}
        <aside className="space-y-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Specimen</div>
            <h1 className="text-3xl font-black" style={{ color: 'var(--genus-gold)' }}>{specimen.name}</h1>
            {specimen.type && <div className="text-sm text-muted-foreground mt-1">{specimen.type}</div>}
            {specimen.country && <div className="text-xs text-muted-foreground">{specimen.country}</div>}
          </div>

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

          <div className="pt-2 border-t border-border">
            <Link
              href={`http://localhost:3000/artist/${mbid}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
            >
              View on SoundGraph →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
