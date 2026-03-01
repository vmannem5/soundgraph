'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
  className?: string
  label?: string
}

export function BackButton({ className = '', label = '← Back to search' }: BackButtonProps) {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      className={`text-sm hover:underline transition-colors ${className}`}
    >
      {label}
    </button>
  )
}
