'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { hierarchy, pack } from 'd3-hierarchy'
import type { HierarchyCircularNode } from 'd3-hierarchy'

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

interface BubbleData {
  id: string
  name: string
  targetType?: string
  targetId?: string
  importance: number
  color: string
  bg: string
  isCategory?: boolean
  isSubcategory?: boolean
  children?: BubbleData[]
}

// ── Category config ────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  'SAMPLES FROM': { label: 'Samples From', color: '#c4956a', bg: 'rgba(196,149,106,0.18)' },
  'SAMPLED BY':   { label: 'Sampled By',   color: '#8b9cc4', bg: 'rgba(139,156,196,0.18)' },
  'CREDITS':      { label: 'Credits',       color: '#d6d3d1', bg: 'rgba(214,211,209,0.10)' },
  'PERFORMERS':   { label: 'Performers',    color: '#a3a3a3', bg: 'rgba(163,163,163,0.10)' },
}

// Order: samples always first
const CATEGORY_ORDER = ['SAMPLES FROM', 'SAMPLED BY', 'CREDITS', 'PERFORMERS']

const CREDITS_SUBGROUP: Record<string, string> = {
  producer: 'Producers', composer: 'Producers', lyricist: 'Producers',
  writer: 'Producers', arranger: 'Producers',
  engineer: 'Engineers & Mix', mix: 'Engineers & Mix',
  audio: 'Engineers & Mix', mastering: 'Engineers & Mix',
}

function getCategoryKey(type: string): string {
  const t = type.toLowerCase()
  if (t === 'samples material' || t === 'sample' || t === 'samples from' || (t.startsWith('sample') && !t.includes('by'))) return 'SAMPLES FROM'
  if (t === 'sampled by' || t.includes('sampled by')) return 'SAMPLED BY'
  if (t === 'performer' || t.includes('vocal') || t.includes('instrument') || t.includes('performance')) return 'PERFORMERS'
  return 'CREDITS'
}

// ── Hierarchy builder ──────────────────────────────────────────────────────

function buildHierarchy(connections: Connection[]): BubbleData {
  const maxImp = Math.max(...connections.map(c => c.importance || 1), 1)
  const norm = (imp: number) =>
    Math.max(1, (Math.log1p(imp || 1) / Math.log1p(maxImp)) * 100)

  // Group by category, deduplicating by targetId
  const groups = new Map<string, Connection[]>()
  const seenIds = new Set<string>()
  for (const conn of connections) {
    const cat = getCategoryKey(conn.type)
    if (!groups.has(cat)) groups.set(cat, [])
    const key = `${cat}-${conn.targetId}`
    if (!seenIds.has(key)) {
      seenIds.add(key)
      groups.get(cat)!.push(conn)
    }
  }

  const children: BubbleData[] = []

  const sortedGroups = [...groups.entries()].sort(
    ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  )

  for (const [cat, conns] of sortedGroups) {
    const style = CATEGORY_STYLES[cat] || { label: cat, color: '#6b7280', bg: 'rgba(107,114,128,0.10)' }

    if (cat === 'CREDITS') {
      // Sub-group by role type
      const subMap = new Map<string, Connection[]>()
      for (const conn of conns) {
        const sg = CREDITS_SUBGROUP[conn.type.toLowerCase()] || 'Other Credits'
        if (!subMap.has(sg)) subMap.set(sg, [])
        subMap.get(sg)!.push(conn)
      }

      const subchildren: BubbleData[] = []
      for (const [sgLabel, sgConns] of subMap) {
        const leaves = sgConns.slice(0, 12).map(c => ({
          id: `leaf-${c.targetId}-${c.type}`,
          name: c.targetName,
          targetType: c.targetType,
          targetId: c.targetId,
          importance: norm(c.importance || 1),
          color: style.color,
          bg: style.bg,
        }))
        subchildren.push({
          id: `subcat-${sgLabel}`,
          name: sgLabel,
          isSubcategory: true,
          importance: leaves.reduce((s, n) => s + n.importance, 0),
          color: style.color,
          bg: style.bg,
          children: leaves,
        })
      }

      children.push({
        id: 'cat-CREDITS',
        name: style.label,
        isCategory: true,
        importance: subchildren.reduce((s, n) => s + n.importance, 0),
        color: style.color,
        bg: style.bg,
        children: subchildren,
      })
    } else {
      const overflow = Math.max(0, conns.length - 12)
      const leaves: BubbleData[] = conns.slice(0, 12).map(c => ({
        id: `leaf-${c.targetId}-${c.type}`,
        name: c.targetName,
        targetType: c.targetType,
        targetId: c.targetId,
        importance: norm(c.importance || 1),
        color: style.color,
        bg: style.bg,
      }))
      if (overflow > 0) {
        leaves.push({
          id: `overflow-${cat}`,
          name: `+${overflow} more`,
          importance: norm(1),
          color: style.color,
          bg: style.bg,
        })
      }

      children.push({
        id: `cat-${cat}`,
        name: style.label,
        isCategory: true,
        importance: leaves.reduce((s, n) => s + n.importance, 0),
        color: style.color,
        bg: style.bg,
        children: leaves,
      })
    }
  }

  return { id: 'root', name: 'root', importance: 1, color: 'transparent', bg: 'transparent', children }
}

// ── Layout ─────────────────────────────────────────────────────────────────

const WIDTH = 800
const HEIGHT = 560

function runPackLayout(data: BubbleData) {
  const root = hierarchy<BubbleData>(data)
    .sum(d => (d.children ? 0 : d.importance))
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  return pack<BubbleData>()
    .size([WIDTH, HEIGHT])
    .padding(d => {
      if (d.depth === 0) return 0
      if (d.depth === 1) return 18  // between categories
      return 6                       // between leaves inside a cluster
    })(root)
}

// ── Component ──────────────────────────────────────────────────────────────

interface ConnectionBubblesProps {
  connections: Connection[]
}

export function ConnectionBubbles({ connections }: ConnectionBubblesProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const packed = useMemo(() => {
    if (connections.length === 0) return null
    const data = buildHierarchy(connections)
    return runPackLayout(data)
  }, [connections])

  const handleCircleClick = useCallback((e: React.MouseEvent, node: HierarchyCircularNode<BubbleData>) => {
    e.stopPropagation()
    if (node.data.isCategory || node.data.isSubcategory) {
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(node.data.id)) next.delete(node.data.id)
        else next.add(node.data.id)
        return next
      })
      return
    }
    const { targetType, targetId } = node.data
    if (!targetType || !targetId) return
    if (targetType === 'artist') router.push(`/artist/${targetId}`)
    else if (targetType === 'recording') router.push(`/recording/${targetId}`)
  }, [router])

  if (!packed || connections.length === 0) {
    return (
      <div className="w-full h-[400px] rounded-xl border border-white/5 bg-[#0c0c10] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No connections found.</p>
      </div>
    )
  }

  const allNodes = packed.descendants().slice(1) // exclude invisible root

  // Determine visible nodes based on expand state
  const visibleNodes = allNodes.filter(node => {
    const d = node.depth
    if (d === 1) return true  // category always visible
    const parentId = node.parent?.data.id
    if (!parentId) return false
    if (d === 2) return expanded.has(parentId)  // show when category expanded
    if (d === 3) {
      // Credits sub-leaf: show when Credits category AND parent subcategory both expanded
      const grandparentId = node.parent?.parent?.data.id
      return grandparentId
        ? expanded.has(grandparentId) && expanded.has(parentId)
        : expanded.has(parentId)
    }
    return false
  })

  return (
    <div
      className="w-full rounded-xl border border-white/5 overflow-hidden"
      style={{ background: '#0c0c10' }}
      onClick={() => { setExpanded(new Set()); setTooltip(null) }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {visibleNodes.map(node => {
          const { id, name, color, bg, isCategory, isSubcategory } = node.data
          const isExpanded = expanded.has(id)
          const isLeaf = !isCategory && !isSubcategory
          const r = Math.max(node.r, 4)
          const fontSize = Math.min(13, Math.max(9, r * 0.28))
          const showText = r >= 22

          return (
            <g
              key={id}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
              onClick={(e) => handleCircleClick(e, node)}
              onMouseEnter={(e) => {
                if (r < 30) {
                  const svgEl = (e.currentTarget.closest('svg') as SVGSVGElement)
                  const rect = svgEl?.getBoundingClientRect()
                  void rect
                  setTooltip({ text: name, x: node.x, y: node.y - r - 8 })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={isExpanded ? bg.replace('0.18', '0.06').replace('0.10', '0.04') : bg}
                stroke={color}
                strokeWidth={isCategory ? 2 : 1}
                strokeOpacity={isExpanded ? 0.6 : 0.45}
              />
              {showText && (
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isLeaf ? '#e5e5e5' : color}
                  fontSize={fontSize}
                  fontWeight={isCategory ? '700' : isSubcategory ? '600' : '400'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {name.length > Math.floor(r / 4) ? name.slice(0, Math.floor(r / 4)) + '…' : name}
                </text>
              )}
              {isCategory && !isExpanded && (
                <text
                  x={node.x}
                  y={node.y + fontSize * 1.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={Math.max(8, fontSize * 0.75)}
                  opacity={0.6}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  tap to expand
                </text>
              )}
            </g>
          )
        })}

        {/* Tooltip for small nodes */}
        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tooltip.x - 60}
              y={tooltip.y - 18}
              width={120}
              height={24}
              rx={6}
              fill="rgba(18,18,24,0.95)"
              stroke="rgba(255,255,255,0.12)"
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 6}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize={11}
            >
              {tooltip.text.length > 20 ? tooltip.text.slice(0, 18) + '…' : tooltip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
