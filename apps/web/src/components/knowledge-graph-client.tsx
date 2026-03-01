'use client'

import dynamic from 'next/dynamic'

export const KnowledgeGraphClient = dynamic(
  () => import('@/components/knowledge-graph').then(m => ({ default: m.KnowledgeGraph })),
  { ssr: false }
)
