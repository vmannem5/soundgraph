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

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2
const MAX_R = 90
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
    <div className="w-full max-w-xs mx-auto text-foreground">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid rings */}
        {rings.map(pct => {
          const r = (pct / 100) * MAX_R
          const pts = Array.from({ length: N }, (_, i) => {
            const { x, y } = polarToXY((360 / N) * i, r)
            return `${x},${y}`
          }).join(' ')
          return <polygon key={pct} points={pts} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
        })}

        {/* Axis spokes */}
        {AXES.map((axis, i) => {
          const { x, y } = polarToXY((360 / N) * i, MAX_R)
          return <line key={axis.key} x1={CX} y1={CY} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
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
          return <circle key={i} cx={x} cy={y} r={3.5} fill="oklch(78% 0.18 85)" />
        })}

        {/* Axis labels */}
        {AXES.map((axis, i) => {
          const { x, y } = polarToXY((360 / N) * i, MAX_R + 18)
          const anchor = x < CX - 5 ? 'end' : x > CX + 5 ? 'start' : 'middle'
          return (
            <text
              key={axis.key}
              x={x} y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.5}
              style={{ userSelect: 'none' }}
            >
              {axis.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
