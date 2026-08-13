'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StartWorkoutInline({ programmeId }: { programmeId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programme_id: programmeId }),
    })
    const data = await res.json()
    if (res.ok) router.push(`/sessions/${data.id}`)
    else setLoading(false)
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
    >
      {loading ? '…' : '▶ Start'}
    </button>
  )
}
