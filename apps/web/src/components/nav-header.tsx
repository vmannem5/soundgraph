import Link from 'next/link'

export function NavHeader() {
  return (
    <header className="border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          SoundGraph
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Search
          </Link>
        </nav>
      </div>
    </header>
  )
}
