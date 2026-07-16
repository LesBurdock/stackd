'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdvancePhaseButton({ phaseId, blockId }: { phaseId: string; blockId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function advance() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/phases/${phaseId}/advance`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed'); setLoading(false); return }
    router.push(`/blocks/${blockId}`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={advance}
        disabled={loading}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Advancing…' : 'Start next phase →'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
