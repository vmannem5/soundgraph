'use client'

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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Color mapping for different node/edge types
const TYPE_COLORS: Record<string, string> = {
  recording: '#3b82f6',   // blue
  artist: '#10b981',      // green
  producer: '#f59e0b',    // amber
  engineer: '#8b5cf6',    // purple
  composer: '#ec4899',    // pink
  work: '#6366f1',        // indigo
  sample: '#ef4444',      // red
  performer: '#10b981',   // green
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
  }
  connections: Connection[]
}

function buildGraphData(
  recording: KnowledgeGraphProps['recording'],
  connections: Connection[]
) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Center node (the recording)
  nodes.push({
    id: `recording-${recording.id}`,
    position: { x: 0, y: 0 },
    data: {
      label: recording.title,
    },
    style: {
      background: TYPE_COLORS.recording,
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 20px',
      fontSize: '14px',
      fontWeight: 'bold',
      minWidth: '120px',
      textAlign: 'center' as const,
    },
  })

  // Group connections by type for better layout
  const grouped = new Map<string, Connection[]>()
  connections.forEach((conn) => {
    const group = conn.type
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group)!.push(conn)
  })

  let groupIndex = 0
  const totalGroups = grouped.size

  grouped.forEach((conns) => {
    const angle = (groupIndex / totalGroups) * 2 * Math.PI - Math.PI / 2
    const groupRadius = 300

    conns.forEach((conn, i) => {
      const spreadAngle = angle + ((i - (conns.length - 1) / 2) * 0.3)
      const radius = groupRadius + i * 30
      const x = Math.cos(spreadAngle) * radius
      const y = Math.sin(spreadAngle) * radius

      const nodeId = `${conn.targetType}-${conn.targetId}`

      // Avoid duplicate nodes
      if (!nodes.find((n) => n.id === nodeId)) {
        nodes.push({
          id: nodeId,
          position: { x, y },
          data: { label: conn.targetName },
          style: {
            background: TYPE_COLORS[conn.type] || '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '12px',
            minWidth: '80px',
            textAlign: 'center' as const,
          },
        })
      }

      edges.push({
        id: `edge-${recording.id}-${conn.targetId}-${conn.type}`,
        source: `recording-${recording.id}`,
        target: nodeId,
        label: conn.type,
        labelStyle: { fontSize: '10px', fill: '#9ca3af' },
        style: { stroke: TYPE_COLORS[conn.type] || '#6b7280' },
        markerEnd: { type: MarkerType.ArrowClosed },
        type: 'smoothstep',
      })
    })

    groupIndex++
  })

  return { nodes, edges }
}

export function KnowledgeGraph({ recording, connections }: KnowledgeGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = buildGraphData(
    recording,
    connections
  )
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div className="w-full h-[600px] bg-background rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => (node.style?.background as string) || '#6b7280'}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  )
}
