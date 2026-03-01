'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { hierarchy, pack } from 'd3-hierarchy'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Connection {
  type: string
  label: string
  targetType: string
  targetId: string
  targetName: string
  importance?: number
  attributes?: string[]
}

interface CategoryData {
  id: string
  label: string
  color: string
  bg: string
  importance: number
  leaves: LeafData[]
}

interface LeafData {
  id: string
  name: string
  targetType: string
  targetId: string
  importance: number
}

// ── Category config ────────────────────────────────────────────────────────

const CAT = {
  SAMPLES_FROM: { label: 'Samples From', color: '#c4956a', bg: 'rgba(196,149,106,0.14)' },
  SAMPLED_BY:   { label: 'Sampled By',   color: '#8b9cc4', bg: 'rgba(139,156,196,0.14)' },
  CREDITS:      { label: 'Credits',       color: '#d6d3d1', bg: 'rgba(214,211,209,0.07)' },
  PERFORMERS:   { label: 'Performers',    color: '#a3a3a3', bg: 'rgba(163,163,163,0.07)' },
} as const

const CAT_ORDER = ['SAMPLES_FROM', 'SAMPLED_BY', 'CREDITS', 'PERFORMERS'] as const
type CatKey = typeof CAT_ORDER[number]

function getCatKey(type: string): CatKey {
  const t = type.toLowerCase()
  if (t.includes('sample') && !t.includes('by')) return 'SAMPLES_FROM'
  if (t === 'sampled by' || t.includes('sampled by')) return 'SAMPLED_BY'
  if (t === 'performer' || t.includes('vocal') || t.includes('instrument')) return 'PERFORMERS'
  return 'CREDITS'
}

// ── Data processing ────────────────────────────────────────────────────────

function buildCategories(connections: Connection[]): CategoryData[] {
  const maxImp = Math.max(...connections.map(c => c.importance || 1), 1)
  const norm = (imp: number) =>
    Math.max(8, (Math.log1p(imp || 1) / Math.log1p(maxImp)) * 100)

  const map = new Map<CatKey, Connection[]>()
  const seen = new Set<string>()

  for (const conn of connections) {
    const key = getCatKey(conn.type)
    if (!map.has(key)) map.set(key, [])
    const dedupeKey = `${key}-${conn.targetId}`
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey)
      map.get(key)!.push(conn)
    }
  }

  return CAT_ORDER
    .filter(key => map.has(key))
    .map(key => {
      const cfg = CAT[key]
      const conns = map.get(key)!
      const leaves: LeafData[] = conns.slice(0, 15).map(c => ({
        id: `leaf-${c.targetId}-${c.type}`,
        name: c.targetName,
        targetType: c.targetType,
        targetId: c.targetId,
        importance: norm(c.importance || 1),
      }))
      // Dampen size differences: 30 base + scaled sum so small categories are still visible
      const rawImp = leaves.reduce((s, l) => s + l.importance, 0)
      return {
        id: `cat-${key}`,
        label: cfg.label,
        color: cfg.color,
        bg: cfg.bg,
        importance: 30 + rawImp * 0.45,
        leaves,
      }
    })
}

// ── Two-level pack layout ───────────────────────────────────────────────────
//
// OUTER: categories treated as flat leaves, sized by importance.
//        Gives clean proportional circles for the collapsed overview.
//
// INNER: run per-category when expanded, packs leaves inside the outer radius.
//        Completely independent from the outer layout.

const W = 680
const H = 680

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function outerPack(cats: CategoryData[]): any[] {
  if (!cats.length) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = hierarchy<any>({ children: cats.map(c => ({ id: c.id, importance: c.importance })) })
    .sum((d) => d.importance || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packed = pack<any>().size([W, H]).padding(20)(root)
  return packed.children || []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function innerPack(leaves: LeafData[], containerR: number): any[] {
  // Reserve top space for the category label
  const labelPad = Math.max(24, containerR * 0.14)
  const avail = (containerR - labelPad) * 2

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = hierarchy<any>({ children: leaves })
    .sum((d) => d.importance || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packed = pack<any>().size([avail, avail]).padding(4)(root)

  // Translate from [0..avail] space to [-containerR..containerR] with downward offset for label
  const offset = containerR - labelPad
  return (packed.children || []).map((n: {x: number; y: number; r: number; data: LeafData}) => ({
    data: n.data,
    x: n.x - offset,
    y: n.y - offset + labelPad * 0.5,
    r: n.r,
  }))
}

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectionBubbles({ connections }: { connections: Connection[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const categories = useMemo(() => buildCategories(connections), [connections])

  const outerNodes = useMemo(() => outerPack(categories), [categories])

  const expandedLeaves = useMemo(() => {
    if (!expandedId) return null
    const outerNode = outerNodes.find((n) => n.data.id === expandedId)
    if (!outerNode) return null
    const cat = categories.find(c => c.id === expandedId)
    if (!cat) return null
    return innerPack(cat.leaves, outerNode.r)
  }, [expandedId, outerNodes, categories])

  if (!categories.length) {
    return (
      <div className="w-full h-56 rounded-xl border border-white/5 bg-[#0c0c10] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No connections found.</p>
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-xl border border-white/5 overflow-hidden"
      style={{ background: '#0c0c10' }}
      onClick={() => { setExpandedId(null); setTooltip(null) }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {outerNodes.map((outerNode) => {
          const catId = outerNode.data.id as string
          const cat = categories.find(c => c.id === catId)!
          const isExpanded = expandedId === catId
          const { x: cx, y: cy, r } = outerNode
          const labelFs = Math.min(15, Math.max(10, r * 0.15))

          return (
            <g
              key={catId}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                setExpandedId(isExpanded ? null : catId)
                setTooltip(null)
              }}
            >
              {/* Category ring */}
              <circle
                cx={cx} cy={cy} r={r}
                fill={isExpanded
                  ? cat.bg.replace('0.14', '0.04').replace('0.07', '0.02')
                  : cat.bg}
                stroke={cat.color}
                strokeWidth={isExpanded ? 1.5 : 1.2}
                strokeOpacity={isExpanded ? 0.7 : 0.45}
              />

              {/* Category label — top of circle when expanded, center when collapsed */}
              <text
                x={cx}
                y={isExpanded ? cy - r + labelFs + 8 : cy - labelFs * 0.3}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={cat.color}
                fontSize={labelFs}
                fontWeight="700"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {cat.label}
              </text>

              {/* Collapsed hint */}
              {!isExpanded && (
                <>
                  <text
                    x={cx}
                    y={cy + labelFs * 0.85}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={cat.color}
                    fontSize={Math.max(9, labelFs * 0.7)}
                    opacity={0.45}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {cat.leaves.length} {cat.leaves.length === 1 ? 'item' : 'items'}
                  </text>
                  {r > 55 && (
                    <text
                      x={cx}
                      y={cy + labelFs * 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={cat.color}
                      fontSize={Math.max(8, labelFs * 0.62)}
                      opacity={0.28}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      tap to expand
                    </text>
                  )}
                </>
              )}

              {/* Expanded leaves — rendered inside the outer circle */}
              {isExpanded && expandedLeaves && expandedLeaves.map((leaf: {data: LeafData; x: number; y: number; r: number}) => {
                const ld = leaf.data
                const lr = Math.max(leaf.r, 3)
                const lx = cx + leaf.x
                const ly = cy + leaf.y
                const showText = lr >= 14

                return (
                  <g
                    key={ld.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (ld.targetType === 'artist') router.push(`/artist/${ld.targetId}`)
                      else if (ld.targetType === 'recording') router.push(`/recording/${ld.targetId}`)
                    }}
                    onMouseEnter={() => {
                      if (lr < 28) setTooltip({ text: ld.name, x: lx, y: ly - lr - 8 })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle
                      cx={lx} cy={ly} r={lr}
                      fill={cat.bg}
                      stroke={cat.color}
                      strokeWidth={0.75}
                      strokeOpacity={0.6}
                    />
                    {showText && (
                      <text
                        x={lx} y={ly}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#e0e0e0"
                        fontSize={Math.min(10, lr * 0.42)}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {ld.name.length > Math.floor(lr / 3.5)
                          ? ld.name.slice(0, Math.floor(lr / 3.5)) + '…'
                          : ld.name}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}

        {/* Tooltip for tiny leaf nodes */}
        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tooltip.x - 68} y={tooltip.y - 15}
              width={136} height={22}
              rx={5}
              fill="rgba(12,12,16,0.96)"
              stroke="rgba(255,255,255,0.1)"
            />
            <text
              x={tooltip.x} y={tooltip.y - 4}
              textAnchor="middle"
              fill="#f0f0f0"
              fontSize={10}
            >
              {tooltip.text.length > 24 ? tooltip.text.slice(0, 22) + '…' : tooltip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
