'use client'

interface SpotifyEmbedProps {
    trackId: string
    compact?: boolean
}

export function SpotifyEmbed({ trackId, compact = false }: SpotifyEmbedProps) {
    const height = compact ? 80 : 152

    return (
        <div className="w-full rounded-xl overflow-hidden">
            <iframe
                src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
                width="100%"
                height={height}
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-xl"
            />
        </div>
    )
}
