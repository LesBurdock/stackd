'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdvancePhaseButton({ blockId }: { blockId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function advance() {
    setLoading(true)
    setError('')

    const res = await fetch(`/api/blocks/${blockId}/advance-phase`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to advance phase')
      setLoading(false)
      return
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={advance}
        disabled={loading}
        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-40"
      >
        {loading ? 'Advancing…' : 'Advance phase →'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
