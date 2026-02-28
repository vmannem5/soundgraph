// SoundGraph - Seed script for Drake & The Weeknd
// Fetches data from MusicBrainz API and inserts into Prisma DB
// Usage: npx tsx scripts/seed-artists.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const USER_AGENT = 'SoundGraph/1.0 (https://soundgraph.vercel.app)'
const MB_BASE = 'https://musicbrainz.org/ws/2'

// Rate limit: 1 req/sec
async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms))
}

async function mbFetch(path: string): Promise<any> {
    const url = `${MB_BASE}${path}${path.includes('?') ? '&' : '?'}fmt=json`
    console.log(`  → MB: ${path}`)

    // Use curl on Node v25+ (TLS incompatibility workaround)
    const { execSync } = await import('child_process')
    try {
        const result = execSync(
            `curl -s -H "User-Agent: ${USER_AGENT}" "${url}"`,
            { encoding: 'utf-8', timeout: 15000 }
        )
        return JSON.parse(result)
    } catch {
        // Fallback to fetch
        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            cache: 'no-store',
        })
        if (!res.ok) throw new Error(`MB API error: ${res.status}`)
        return res.json()
    }
}

// Target artists
const ARTISTS = [
    { name: 'Drake', mbid: '9fff2f8a-21e6-47de-a2b8-7f449929d43f' },
    { name: 'The Weeknd', mbid: 'c8b03190-306c-4120-bb0b-6f2ebfc06ea9' },
]

async function seedArtist(name: string, mbid: string) {
    console.log(`\n=== Seeding ${name} (${mbid}) ===`)

    // 1. Fetch artist details
    const artist = await mbFetch(`/artist/${mbid}?inc=tags+aliases`)
    await sleep(1100)

    // Upsert artist
    const dbArtist = await prisma.artist.upsert({
        where: { mbid },
        create: {
            mbid,
            name: artist.name,
            sortName: artist['sort-name'],
            type: artist.type || null,
            country: artist.country || null,
            disambiguation: artist.disambiguation || null,
        },
        update: {
            name: artist.name,
            sortName: artist['sort-name'],
            type: artist.type || null,
            country: artist.country || null,
        },
    })
    console.log(`  ✓ Artist: ${dbArtist.name} (${dbArtist.id})`)

    // Upsert tags
    if (artist.tags) {
        for (const tag of artist.tags.slice(0, 15)) {
            await prisma.artistTag.upsert({
                where: { artistId_tag: { artistId: dbArtist.id, tag: tag.name } },
                create: { artistId: dbArtist.id, tag: tag.name, count: tag.count || 1 },
                update: { count: tag.count || 1 },
            })
        }
        console.log(`  ✓ ${artist.tags.length} tags`)
    }

    // Upsert aliases
    if (artist.aliases) {
        for (const alias of artist.aliases.slice(0, 10)) {
            try {
                await prisma.artistAlias.create({
                    data: { artistId: dbArtist.id, name: alias.name, locale: alias.locale || null },
                })
            } catch { /* duplicate, skip */ }
        }
        console.log(`  ✓ ${artist.aliases.length} aliases`)
    }

    // 2. Fetch release groups (albums, singles, EPs)
    const rgs = await mbFetch(`/release-group?artist=${mbid}&type=album|single|ep&limit=50`)
    await sleep(1100)

    for (const rg of (rgs['release-groups'] || []).slice(0, 30)) {
        await prisma.releaseGroup.upsert({
            where: { mbid: rg.id },
            create: {
                mbid: rg.id,
                title: rg.title,
                type: rg['primary-type'] || null,
                firstReleaseDate: rg['first-release-date'] || null,
            },
            update: { title: rg.title },
        })
    }
    console.log(`  ✓ ${rgs['release-groups']?.length || 0} release groups`)

    // 3. Fetch recordings with credits and samples
    const recordings = await mbFetch(`/recording?artist=${mbid}&limit=100`)
    await sleep(1100)

    const recordingMbids: string[] = []
    for (const rec of (recordings.recordings || []).slice(0, 50)) {
        const dbRec = await prisma.recording.upsert({
            where: { mbid: rec.id },
            create: {
                mbid: rec.id,
                title: rec.title,
                length: rec.length || null,
            },
            update: { title: rec.title, length: rec.length || null },
        })

        // Create performer credit
        try {
            await prisma.credit.upsert({
                where: { artistId_recordingId_role: { artistId: dbArtist.id, recordingId: dbRec.id, role: 'performer' } },
                create: { artistId: dbArtist.id, recordingId: dbRec.id, role: 'performer' },
                update: {},
            })
        } catch { /* skip */ }

        recordingMbids.push(rec.id)
    }
    console.log(`  ✓ ${recordingMbids.length} recordings`)

    // 4. Fetch detailed relationships for each recording (credits + samples)
    // Process in batches to respect rate limits
    let sampleCount = 0
    let creditCount = 0

    for (const recMbid of recordingMbids.slice(0, 25)) {
        try {
            const recDetail = await mbFetch(`/recording/${recMbid}?inc=artist-rels+recording-rels+tags`)
            await sleep(1100)

            const dbRec = await prisma.recording.findUnique({ where: { mbid: recMbid } })
            if (!dbRec) continue

            // Tags
            if (recDetail.tags) {
                for (const tag of recDetail.tags.slice(0, 10)) {
                    try {
                        await prisma.recordingTag.upsert({
                            where: { recordingId_tag: { recordingId: dbRec.id, tag: tag.name } },
                            create: { recordingId: dbRec.id, tag: tag.name, count: tag.count || 1 },
                            update: { count: tag.count || 1 },
                        })
                    } catch { /* skip */ }
                }
            }

            // Artist relationships (producer, engineer, etc.)
            const artistRels = recDetail.relations?.filter((r: any) => r['target-type'] === 'artist') || []
            for (const rel of artistRels) {
                const relArtist = rel.artist
                if (!relArtist) continue

                // Upsert the related artist
                const dbRelArtist = await prisma.artist.upsert({
                    where: { mbid: relArtist.id },
                    create: {
                        mbid: relArtist.id,
                        name: relArtist.name,
                        sortName: relArtist['sort-name'] || relArtist.name,
                        type: relArtist.type || null,
                    },
                    update: {},
                })

                // Create credit
                const role = rel.type || 'unknown'
                try {
                    await prisma.credit.upsert({
                        where: { artistId_recordingId_role: { artistId: dbRelArtist.id, recordingId: dbRec.id, role } },
                        create: {
                            artistId: dbRelArtist.id,
                            recordingId: dbRec.id,
                            role,
                            instrument: rel.attributes?.join(', ') || null,
                        },
                        update: {},
                    })
                    creditCount++
                } catch { /* duplicate, skip */ }
            }

            // Recording relationships (samples!)
            const recRels = recDetail.relations?.filter((r: any) => r['target-type'] === 'recording') || []
            for (const rel of recRels) {
                const sampledRec = rel.recording
                if (!sampledRec) continue

                // Upsert the sampled recording
                const dbSampledRec = await prisma.recording.upsert({
                    where: { mbid: sampledRec.id },
                    create: {
                        mbid: sampledRec.id,
                        title: sampledRec.title,
                        length: sampledRec.length || null,
                    },
                    update: {},
                })

                // Create sample relation
                const isForward = rel.direction === 'forward'
                try {
                    await prisma.sampleRelation.create({
                        data: {
                            samplingTrackId: isForward ? dbRec.id : dbSampledRec.id,
                            sampledTrackId: isForward ? dbSampledRec.id : dbRec.id,
                            description: rel.type || null,
                        },
                    })
                    sampleCount++
                    console.log(`    🎵 Sample: "${dbRec.title}" ${isForward ? '→' : '←'} "${sampledRec.title}"`)
                } catch { /* duplicate, skip */ }
            }
        } catch (err) {
            console.log(`    ⚠ Skipped ${recMbid}: ${err}`)
        }
    }

    console.log(`  ✓ ${creditCount} credits, ${sampleCount} sample relations`)
}

async function main() {
    console.log('🔊 SoundGraph Seed Script')
    console.log('========================')
    console.log('Fetching Drake & The Weeknd data from MusicBrainz...\n')

    for (const { name, mbid } of ARTISTS) {
        await seedArtist(name, mbid)
    }

    // Print final stats
    const stats = await Promise.all([
        prisma.artist.count(),
        prisma.recording.count(),
        prisma.releaseGroup.count(),
        prisma.credit.count(),
        prisma.sampleRelation.count(),
        prisma.artistTag.count(),
        prisma.recordingTag.count(),
    ])

    console.log('\n========================================')
    console.log('  Seed Complete!')
    console.log('========================================')
    console.log(`  Artists:          ${stats[0]}`)
    console.log(`  Recordings:       ${stats[1]}`)
    console.log(`  Release Groups:   ${stats[2]}`)
    console.log(`  Credits:          ${stats[3]}`)
    console.log(`  Sample Relations: ${stats[4]}`)
    console.log(`  Artist Tags:      ${stats[5]}`)
    console.log(`  Recording Tags:   ${stats[6]}`)
    console.log('========================================')

    await prisma.$disconnect()
}

main().catch(async (e) => {
    console.error('Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
})
