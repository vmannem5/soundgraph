'use client'

import React from 'react'

// Genre-based color palettes
const GENRE_PALETTES: Record<string, string[]> = {
  jazz:         ['#c4956a', '#d4a574', '#8b6f47', '#e8c9a0'],
  electronic:   ['#6ecfcf', '#9b8bc4', '#4a9aca', '#b06ec4'],
  'hip-hop':    ['#c45a5a', '#d48a4a', '#c47a3a', '#e8a060'],
  hip:          ['#c45a5a', '#d48a4a', '#c47a3a', '#e8a060'],
  rap:          ['#c45a5a', '#d48a4a', '#c47a3a', '#e8a060'],
  rock:         ['#7a8b9c', '#5a6b7c', '#9aaabb', '#4a5b6c'],
  pop:          ['#c46a9b', '#d49abb', '#9b6ac4', '#e8a0c0'],
  classical:    ['#9b9b6a', '#c4c49a', '#7a7a4a', '#d4d4b0'],
  default:      ['#8b9cc4', '#c4956a', '#6ec4a0', '#c46a8b'],
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

function getPalette(genres: string[]): string[] {
  const genre = (genres[0] || '').toLowerCase()
  for (const [key, palette] of Object.entries(GENRE_PALETTES)) {
    if (genre.includes(key)) return palette
  }
  return GENRE_PALETTES.default
}

export function GeneratedAvatar({
  id,
  name,
  genres = [],
  size = 72,
}: {
  id: string
  name: string
  genres?: string[]
  size?: number
}) {
  const seed = hashString(id || name)
  const rand = seededRandom(seed)
  const palette = getPalette(genres)

  const shapeCount = 4 + Math.floor(rand() * 3)
  const shapes: React.ReactNode[] = []

  for (let i = 0; i < shapeCount; i++) {
    const color = palette[Math.floor(rand() * palette.length)]
    const opacity = 0.3 + rand() * 0.5
    const type = Math.floor(rand() * 3)

    if (type === 0) {
      const cx = rand() * size
      const cy = rand() * size
      const r = size * 0.1 + rand() * size * 0.35
      shapes.push(
        <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
      )
    } else if (type === 1) {
      const cx = rand() * size
      const cy = rand() * size
      const r = size * 0.2 + rand() * size * 0.3
      const startAngle = rand() * Math.PI * 2
      const endAngle = startAngle + Math.PI * 0.5 + rand() * Math.PI
      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)
      shapes.push(
        <path
          key={i}
          d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
          stroke={color}
          strokeWidth={size * 0.04 + rand() * size * 0.06}
          fill="none"
          opacity={opacity}
          strokeLinecap="round"
        />
      )
    } else {
      const x1 = rand() * size
      const y1 = rand() * size
      const x2 = rand() * size
      const y2 = rand() * size
      shapes.push(
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
          strokeWidth={size * 0.02 + rand() * size * 0.04}
          opacity={opacity}
          strokeLinecap="round"
        />
      )
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, display: 'block' }}
    >
      <rect width={size} height={size} fill="oklch(0.19 0.01 250)" rx={size * 0.08} />
      {shapes}
    </svg>
  )
}
