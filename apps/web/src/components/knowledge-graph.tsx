'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Ring-based layout: each group has a designated ring (distance from center)
// Ring 0 = samples (closest), Ring 1 = sampled by, Ring 2 = credits, Ring 3 = performers, Ring 4 = works
const CONNECTION_GROUPS: Record<string, { label: string; color: string; bg: string; ring: number }> = {
  'samples material': { label: 'SAMPLES FROM', color: '#c4956a', bg: 'rgba(196,149,106,0.10)', ring: 0 },
  sample: { label: 'SAMPLES FROM', color: '#c4956a', bg: 'rgba(196,149,106,0.10)', ring: 0 },
  'samples from': { label: 'SAMPLES FROM', color: '#c4956a', bg: 'rgba(196,149,106,0.10)', ring: 0 },
  'sampled by': { label: 'SAMPLED BY', color: '#8b9cc4', bg: 'rgba(139,156,196,0.10)', ring: 1 },
  producer: { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  composer: { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  lyricist: { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  writer: { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  arranger: { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  'mix': { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  'audio': { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  engineer: { label: 'CREDITS', color: '#d6d3d1', bg: 'rgba(214,211,209,0.08)', ring: 2 },
  performer: { label: 'PERFORMERS', color: '#a3a3a3', bg: 'rgba(163,163,163,0.08)', ring: 3 },
  'vocal': { label: 'PERFORMERS', color: '#a3a3a3', bg: 'rgba(163,163,163,0.08)', ring: 3 },
  'instrument': { label: 'PERFORMERS', color: '#a3a3a3', bg: 'rgba(163,163,163,0.08)', ring: 3 },
  'performance': { label: 'PERFORMERS', color: '#a3a3a3', bg: 'rgba(163,163,163,0.08)', ring: 3 },
  work: { label: 'WORKS', color: '#737373', bg: 'rgba(115,115,115,0.08)', ring: 4 },
}

function getGroupInfo(type: string) {
  if (CONNECTION_GROUPS[type]) return CONNECTION_GROUPS[type]
  const partial = Object.entries(CONNECTION_GROUPS).find(([key]) => type.toLowerCase().includes(key))
  if (partial) return partial[1]
  return { label: 'CONNECTIONS', color: '#6b7280', bg: 'rgba(107,114,128,0.08)', ring: 4 }
}

interface Connection {
  type: string
  label: string
  targetType: string
  targetId: string
  targetName: string
  attributes?: string[]
}

interface KnowledgeGraphProps {
  recording: {
    id: string
    title: string
    'artist-credit'?: Array<{ name: string; artist: { id: string; name: string } }>
    spotifyData?: {
      album?: { images?: Array<{ url: string }> }
    }
  }
  connections: Connection[]
}

function buildGraphData(
  recording: KnowledgeGraphProps['recording'],
  connections: Connection[]
) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const albumArt = recording.spotifyData?.album?.images?.[1]?.url || recording.spotifyData?.album?.images?.[0]?.url
  const artistName = recording['artist-credit']?.map(c => c.name || c.artist?.name).join(', ') || ''

  // Center node
  nodes.push({
    id: `recording-${recording.id}`,
    position: { x: 0, y: 0 },
    data: {
      label: `${recording.title}\n${artistName}`,
    },
    style: {
      background: albumArt
        ? `url(${albumArt}) center/cover`
        : 'linear-gradient(135deg, #404040, #262626)',
      color: 'white',
      border: '2px solid oklch(0.75 0.15 70 / 0.4)',
      borderRadius: '50%',
      width: '180px',
      height: '180px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center' as const,
      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 40px 8px oklch(0.75 0.15 70 / 0.25)',
      padding: '18px',
      lineHeight: '1.3',
    },
  })

  // Cap nodes per group to prevent overcrowding
  const MAX_NODES_PER_GROUP = 8

  // Group connections by label
  const grouped = new Map<string, { info: ReturnType<typeof getGroupInfo>; conns: Connection[] }>()
  connections.forEach((conn) => {
    const info = getGroupInfo(conn.type)
    const key = info.label
    if (!grouped.has(key)) grouped.set(key, { info, conns: [] })
    grouped.get(key)!.conns.push(conn)
  })

  const sortedGroups = [...grouped.entries()].sort((a, b) => a[1].info.ring - b[1].info.ring)
  const totalGroups = sortedGroups.length
  const addedNodeIds = new Set<string>()

  // Concentric ring radii — well-spaced for legibility
  const RING_RADII = [280, 480, 680, 880, 1050]

  // Subtle ring guides
  const usedRings = new Set(sortedGroups.map(([, { info }]) => info.ring))
  usedRings.forEach((ringIdx) => {
    const r = RING_RADII[ringIdx] || RING_RADII[RING_RADII.length - 1]
    nodes.push({
      id: `ring-guide-${ringIdx}`,
      position: { x: -r, y: -r },
      data: { label: '' },
      selectable: false,
      draggable: false,
      style: {
        background: 'transparent',
        border: '1px dashed rgba(255,255,255,0.05)',
        borderRadius: '50%',
        width: `${r * 2}px`,
        height: `${r * 2}px`,
        pointerEvents: 'none' as const,
      },
    })
  })

  sortedGroups.forEach(([groupLabel, { info, conns }], groupIdx) => {
    const sectorAngle = (2 * Math.PI) / Math.max(totalGroups, 1)
    const baseAngle = groupIdx * sectorAngle - Math.PI / 2
    const ringRadius = RING_RADII[info.ring] || RING_RADII[RING_RADII.length - 1]

    // Group label
    const labelRadius = ringRadius * 0.55
    const labelX = Math.cos(baseAngle) * labelRadius
    const labelY = Math.sin(baseAngle) * labelRadius

    const overflow = Math.max(0, conns.length - MAX_NODES_PER_GROUP)
    const labelText = overflow > 0 ? `${groupLabel} (+${overflow})` : groupLabel

    nodes.push({
      id: `group-${groupLabel}`,
      position: { x: labelX, y: labelY },
      data: { label: labelText },
      selectable: false,
      draggable: false,
      style: {
        background: 'transparent',
        color: info.color,
        border: 'none',
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        textTransform: 'uppercase' as const,
        padding: '4px 10px',
        pointerEvents: 'none' as const,
        opacity: 0.7,
      },
    })

    // Cap the nodes shown — compute count once before the loop for uniform spacing
    const nodesToPlace = Math.min(conns.filter(c => !addedNodeIds.has(`${c.targetType}-${c.targetId}`)).length, MAX_NODES_PER_GROUP)
    const maxSpread = sectorAngle * 0.8
    const angleStep = nodesToPlace > 1 ? maxSpread / (nodesToPlace - 1) : 0
    const startAngle = baseAngle - maxSpread / 2

    let placedIdx = 0
    conns.forEach((conn) => {
      const nodeId = `${conn.targetType}-${conn.targetId}`
      if (addedNodeIds.has(nodeId)) return
      if (placedIdx >= MAX_NODES_PER_GROUP) return
      addedNodeIds.add(nodeId)

      const nodeAngle = nodesToPlace > 1 ? startAngle + placedIdx * angleStep : baseAngle
      const jitter = (placedIdx % 3 - 1) * 35
      const radius = ringRadius + jitter

      const x = Math.cos(nodeAngle) * radius
      const y = Math.sin(nodeAngle) * radius

      const isSample = conn.targetType === 'recording'
      const isSampledBy = conn.type === 'sampled by'

      nodes.push({
        id: nodeId,
        position: { x, y },
        data: { label: conn.targetName, targetType: conn.targetType, targetId: conn.targetId },
        style: {
          background: info.bg,
          color: '#f5f5f5',
          border: `1.5px solid ${info.color}60`,
          borderRadius: isSample ? '14px' : '22px',
          padding: '12px 18px',
          fontSize: '13px',
          fontWeight: '500',
          minWidth: isSample ? '120px' : '90px',
          maxWidth: '200px',
          textAlign: 'center' as const,
          boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      })

      const edgeLabel = isSample
        ? (isSampledBy ? 'sampled by' : 'samples')
        : conn.type

      edges.push({
        id: `edge-${recording.id}-${conn.targetId}-${conn.type}-${placedIdx}`,
        source: `recording-${recording.id}`,
        target: nodeId,
        label: edgeLabel,
        labelStyle: {
          fontSize: '10px',
          fill: '#a3a3a3',
          fontWeight: '500',
        },
        labelBgStyle: {
          fill: 'rgba(12,12,16,0.9)',
          fillOpacity: 1,
        },
        labelBgPadding: [5, 8] as [number, number],
        labelShowBg: true,
        style: {
          stroke: `${info.color}40`,
          strokeWidth: isSample ? 2 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: `${info.color}70`,
          width: 18,
          height: 18,
        },
        type: 'smoothstep',
        animated: isSample,
      })

      placedIdx++
    })
  })

  return { nodes, edges }
}

export function KnowledgeGraph({ recording, connections }: KnowledgeGraphProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  useEffect(() => setMounted(true), [])

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphData(recording, connections),
    [recording, connections]
  )
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const navigateToNode = useCallback((node: Node) => {
    const { targetType, targetId } = node.data as { targetType?: string; targetId?: string }
    if (!targetType || !targetId) return
    if (targetType === 'artist') router.push(`/artist/${targetId}`)
    else if (targetType === 'recording') router.push(`/recording/${targetId}`)
  }, [router])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const { targetType, targetId } = node.data as { targetType?: string; targetId?: string }
    if (!targetType || !targetId) return
    setSelectedNode(node)
  }, [])

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(null)
    navigateToNode(node)
  }, [navigateToNode])

  if (!mounted) {
    return (
      <div style={{ height: '70vh', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', background: '#0c0c10' }} className="animate-pulse" />
    )
  }

  if (connections.length === 0) {
    return (
      <div className="w-full h-[400px] bg-background rounded-lg border flex items-center justify-center">
        <p className="text-muted-foreground">No connections found for this recording.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '70vh', overflow: 'hidden', position: 'relative', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', background: '#0c0c10' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={0.8}
          color="rgba(255,255,255,0.03)"
        />
        <Controls
          style={{ background: '#1a1a1e', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
        />
        <MiniMap
          nodeColor={() => '#525252'}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: '#0c0c10', borderColor: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}
        />
      </ReactFlow>

      {/* Single-click info popover */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(18,18,24,0.95)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '12px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            zIndex: 10,
            maxWidth: '360px',
            minWidth: '240px',
          }}
        >
          <span
            style={{
              flex: 1,
              color: '#f5f5f5',
              fontSize: '14px',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {String(selectedNode.data.label ?? '')}
          </span>
          <button
            onClick={() => navigateToNode(selectedNode)}
            style={{
              background: 'oklch(0.75 0.15 70 / 0.15)',
              border: '1px solid oklch(0.75 0.15 70 / 0.4)',
              color: 'oklch(0.85 0.12 70)',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
          >
            View
          </button>
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#737373',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 2px',
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
