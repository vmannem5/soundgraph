import Link from 'next/link'
import type { SampleNode } from '@/lib/data-service'

interface Props {
  roots: SampleNode[]
}

function SampleNodeRow({ node, depth }: { node: SampleNode; depth: number }) {
  const indent = depth * 20
  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 group"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {depth > 0 && (
          <span className="text-muted-foreground/40 shrink-0 text-sm select-none">
            {'└─'}
          </span>
        )}
        <Link
          href={`/recording/${node.mbid}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate"
        >
          {node.title}
        </Link>
        {(node.artistName || node.year) && (
          <span className="text-xs text-muted-foreground shrink-0">
            {[node.artistName, node.year].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      {node.children.map(child => (
        <SampleNodeRow key={child.mbid} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

export function SampleChain({ roots }: Props) {
  if (!roots.length) return null
  return (
    <section>
      <h2 className="text-xl font-bold mb-3">Sample Ancestry</h2>
      <div className="rounded-xl border border-white/5 bg-[#0c0c10] px-2 py-3">
        {roots.map(root => (
          <SampleNodeRow key={root.mbid} node={root} depth={0} />
        ))}
      </div>
    </section>
  )
}
