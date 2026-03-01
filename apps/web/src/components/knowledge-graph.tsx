'use client'

import { useMemo } from 'react'
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

// Connection group definitions — inspired by sample-focused music graph
const CONNECTION_GROUPS: Record<string, { label: string; color: string; borderColor: string; order: number }> = {
  'samples material': { label: 'SAMPLES FROM', color: '#ef4444', borderColor: '#dc2626', order: 0 },
  sample: { label: 'SAMPLES FROM', color: '#ef4444', borderColor: '#dc2626', order: 0 },
  'samples from': { label: 'SAMPLES FROM', color: '#ef4444', borderColor: '#dc2626', order: 0 },
  'sampled by': { label: 'SAMPLED BY', color: '#f97316', borderColor: '#ea580c', order: 1 },
  producer: { label: 'CREDITS', color: '#f59e0b', borderColor: '#d97706', order: 2 },
  composer: { label: 'CREDITS', color: '#ec4899', borderColor: '#db2777', order: 2 },
  lyricist: { label: 'CREDITS', color: '#ec4899', borderColor: '#db2777', order: 2 },
  writer: { label: 'CREDITS', color: '#ec4899', borderColor: '#db2777', order: 2 },
  arranger: { label: 'CREDITS', color: '#8b5cf6', borderColor: '#7c3aed', order: 2 },
  'mix': { label: 'CREDITS', color: '#8b5cf6', borderColor: '#7c3aed', order: 2 },
  'audio': { label: 'CREDITS', color: '#8b5cf6', borderColor: '#7c3aed', order: 2 },
  engineer: { label: 'CREDITS', color: '#8b5cf6', borderColor: '#7c3aed', order: 2 },
  performer: { label: 'PERFORMERS', color: '#10b981', borderColor: '#059669', order: 3 },
  'vocal': { label: 'PERFORMERS', color: '#10b981', borderColor: '#059669', order: 3 },
  'instrument': { label: 'PERFORMERS', color: '#10b981', borderColor: '#059669', order: 3 },
  'performance': { label: 'PERFORMERS', color: '#3b82f6', borderColor: '#2563eb', order: 3 },
  work: { label: 'WORKS', color: '#6366f1', borderColor: '#4f46e5', order: 4 },
}

function getGroupInfo(type: string) {
  // Try exact match first
  if (CONNECTION_GROUPS[type]) return CONNECTION_GROUPS[type]
  // Try partial match
  const partial = Object.entries(CONNECTION_GROUPS).find(([key]) => type.toLowerCase().includes(key))
  if (partial) return partial[1]
  // Default
  return { label: 'CONNECTIONS', color: '#6b7280', borderColor: '#4b5563', order: 5 }
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

  // Center node — the recording itself (large, prominent)
  nodes.push({
    id: `recording-${recording.id}`,
    position: { x: 0, y: 0 },
    data: {
      label: `${recording.title}\n${artistName}`,
    },
    style: {
      background: albumArt
        ? `url(${albumArt}) center/cover`
        : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      color: 'white',
      border: '3px solid rgba(255,255,255,0.3)',
      borderRadius: '50%',
      width: '140px',
      height: '140px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: 'bold',
      textAlign: 'center' as const,
      textShadow: '0 1px 4px rgba(0,0,0,0.8)',
      boxShadow: '0 0 40px rgba(59,130,246,0.3)',
      padding: '16px',
      lineHeight: '1.2',
    },
  })

  // Group connections by their group label
  const grouped = new Map<string, { info: typeof CONNECTION_GROUPS[string]; conns: Connection[] }>()
  connections.forEach((conn) => {
    const info = getGroupInfo(conn.type)
    const key = info.label
    if (!grouped.has(key)) grouped.set(key, { info, conns: [] })
    grouped.get(key)!.conns.push(conn)
  })

  // Sort groups by order
  const sortedGroups = [...grouped.entries()].sort((a, b) => a[1].info.order - b[1].info.order)

  const totalGroups = sortedGroups.length
  const addedNodeIds = new Set<string>()

  sortedGroups.forEach(([groupLabel, { info, conns }], groupIdx) => {
    // Calculate angle for this group's sector
    const sectorAngle = (2 * Math.PI) / Math.max(totalGroups, 1)
    const baseAngle = groupIdx * sectorAngle - Math.PI / 2

    // Add group label node
    const groupLabelRadius = 180
    const groupX = Math.cos(baseAngle) * groupLabelRadius
    const groupY = Math.sin(baseAngle) * groupLabelRadius
    const groupNodeId = `group-${groupLabel}`

    nodes.push({
      id: groupNodeId,
      position: { x: groupX, y: groupY },
      data: { label: groupLabel },
      selectable: false,
      draggable: false,
      style: {
        background: 'transparent',
        color: info.color,
        border: 'none',
        fontSize: '11px',
        fontWeight: '800',
        letterSpacing: '2px',
        textTransform: 'uppercase' as const,
        padding: '4px 8px',
        pointerEvents: 'none' as const,
        opacity: 0.7,
      },
    })

    // Add individual connection nodes
    conns.forEach((conn, i) => {
      const nodeId = `${conn.targetType}-${conn.targetId}`

      // Skip duplicate nodes
      if (addedNodeIds.has(nodeId)) return
      addedNodeIds.add(nodeId)

      const angleSpread = Math.min(0.4, sectorAngle * 0.8 / Math.max(conns.length, 1))
      const nodeAngle = baseAngle + (i - (conns.length - 1) / 2) * angleSpread
      const radius = 300 + (i % 2) * 60

      const x = Math.cos(nodeAngle) * radius
      const y = Math.sin(nodeAngle) * radius

      const isSample = conn.targetType === 'recording'
      const isSampledBy = conn.type === 'sampled by'
      const nodeSize = isSample ? '100px' : '70px'
      const borderRadius = isSample ? '16px' : '24px'

      nodes.push({
        id: nodeId,
        position: { x, y },
        data: {
          label: conn.targetName,
        },
        style: {
          background: `${info.color}15`,
          color: 'white',
          border: `2px solid ${info.color}`,
          borderRadius,
          padding: '8px 14px',
          fontSize: isSample ? '11px' : '11px',
          fontWeight: '500',
          minWidth: nodeSize,
          textAlign: 'center' as const,
          backdropFilter: 'blur(8px)',
          boxShadow: `0 0 20px ${info.color}20`,
          transition: 'all 0.2s ease',
        },
      })

      // Clear directional labels for sample connections
      const edgeLabel = isSample
        ? (isSampledBy ? 'sampled by' : 'samples from')
        : conn.type

      edges.push({
        id: `edge-${recording.id}-${conn.targetId}-${conn.type}-${i}`,
        source: `recording-${recording.id}`,
        target: nodeId,
        label: edgeLabel,
        labelStyle: {
          fontSize: isSample ? '10px' : '9px',
          fill: isSample ? '#fbbf24' : '#9ca3af',
          fontWeight: isSample ? '600' : '400',
        },
        labelBgStyle: {
          fill: 'rgba(0,0,0,0.6)',
          fillOpacity: 0.8,
        },
        labelBgPadding: [4, 6] as [number, number],
        labelShowBg: true,
        style: {
          stroke: info.color,
          strokeWidth: isSample ? 2.5 : 1.5,
          opacity: isSample ? 0.9 : 0.6,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: info.color,
        },
        type: 'smoothstep',
        animated: isSample,
      })
    })
  })

  return { nodes, edges }
}

export function KnowledgeGraph({ recording, connections }: KnowledgeGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphData(recording, connections),
    [recording, connections]
  )
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  if (connections.length === 0) {
    return (
      <div className="w-full h-[400px] bg-background rounded-lg border flex items-center justify-center">
        <p className="text-muted-foreground">No connections found for this recording.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-[450px] sm:h-[550px] md:h-[650px] rounded-xl border overflow-hidden" style={{ background: '#0a0a0f' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.05)"
        />
        <Controls
          style={{ background: '#1a1a2e', borderColor: '#333', borderRadius: '8px' }}
        />
        <MiniMap
          nodeColor={(node) => {
            const bg = node.style?.background as string
            if (bg?.includes('gradient') || bg?.includes('url')) return '#3b82f6'
            const border = node.style?.borderColor as string || node.style?.border as string
            if (border?.includes('#ef4444')) return '#ef4444'
            if (border?.includes('#10b981')) return '#10b981'
            if (border?.includes('#f59e0b')) return '#f59e0b'
            if (border?.includes('#8b5cf6')) return '#8b5cf6'
            if (border?.includes('#ec4899')) return '#ec4899'
            return '#6b7280'
          }}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: '#0a0a0f', borderColor: '#333', borderRadius: '8px' }}
        />
      </ReactFlow>
    </div>
  )
}
