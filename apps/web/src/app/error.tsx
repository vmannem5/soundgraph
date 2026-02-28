'use client'

export default function Error({
  error,
}: {
  error: Error & { digest?: string }
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">{error.message}</p>
      {error.digest && (
        <p className="text-sm text-muted-foreground">Digest: {error.digest}</p>
      )}
    </main>
  )
}
