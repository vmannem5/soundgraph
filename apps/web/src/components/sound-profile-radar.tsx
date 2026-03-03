interface Props {
  values: {
    genreBreadth: number
    sampleUse: number
    collaborationRadius: number
    eraSpread: number
    instrumentDiversity: number
    geographicReach: number
  }
}

const AXES = [
  { key: 'genreBreadth',        label: 'Genre Breadth' },
  { key: 'sampleUse',           label: 'Sample Use' },
  { key: 'collaborationRadius', label: 'Collab Radius' },
  { key: 'eraSpread',           label: 'Era Spread' },
  { key: 'instrumentDiversity', label: 'Instrument Div.' },
  { key: 'geographicReach',     label: 'Geo Reach' },
] as const

// Larger viewBox with padding so labels never clip
const W = 360
const H = 360
const CX = W / 2
const CY = H / 2
const MAX_R = 100
const N = AXES.length

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function buildPolygon(values: number[]): string {
  return values
    .map((v, i) => {
      const { x, y } = polarToXY((360 / N) * i, (v / 100) * MAX_R)
      return `${x},${y}`
    })
    .join(' ')
}

export function SoundProfileRadar({ values }: Props) {
  const dataValues = AXES.map(a => values[a.key])
  const polygon = buildPolygon(dataValues)
  const rings = [25, 50, 75, 100]

  return (
    <div className="w-full max-w-sm mx-auto text-foreground">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid rings */}
        {rings.map(pct => {
          const r = (pct / 100) * MAX_R
          const pts = Array.from({ length: N }, (_, i) => {
            const { x, y } = polarToXY((360 / N) * i, r)
            return `${x},${y}`
          }).join(' ')
          return (
            <polygon
              key={pct}
              points={pts}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          )
        })}

        {/* Axis spokes */}
        {AXES.map((axis, i) => {
          const { x, y } = polarToXY((360 / N) * i, MAX_R)
          return (
            <line
              key={axis.key}
              x1={CX} y1={CY} x2={x} y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          )
        })}

        {/* Data polygon */}
        <polygon
          points={polygon}
          fill="oklch(78% 0.18 85 / 0.25)"
          stroke="oklch(78% 0.18 85)"
          strokeWidth={2}
        />

        {/* Data dots */}
        {dataValues.map((v, i) => {
          const { x, y } = polarToXY((360 / N) * i, (v / 100) * MAX_R)
          return (
            <circle key={i} cx={x} cy={y} r={4} fill="oklch(78% 0.18 85)" />
          )
        })}

        {/* Axis labels — positioned further out with generous padding */}
        {AXES.map((axis, i) => {
          const angle = (360 / N) * i
          // Extra padding per axis based on angle to avoid clipping
          const labelR = MAX_R + 26
          const { x, y } = polarToXY(angle, labelR)
          const anchor = x < CX - 8 ? 'end' : x > CX + 8 ? 'start' : 'middle'
          return (
            <text
              key={axis.key}
              x={x} y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.55}
              style={{ userSelect: 'none' }}
            >
              {axis.label}
            </text>
          )
        })}

        {/* Value % labels on each axis at the data point */}
        {dataValues.map((v, i) => {
          if (v < 5) return null // skip near-zero values
          const { x, y } = polarToXY((360 / N) * i, (v / 100) * MAX_R)
          return (
            <text
              key={`val-${i}`}
              x={x} y={y - 7}
              textAnchor="middle"
              fontSize={8}
              fill="oklch(78% 0.18 85)"
              fillOpacity={0.8}
              style={{ userSelect: 'none' }}
            >
              {Math.round(v)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
