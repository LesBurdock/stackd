'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewProgrammeForm({ phaseId, blockId }: { phaseId: string; blockId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Give this programme a name.'); return }
    setError('')
    setLoading(true)

    const res = await fetch(`/api/phases/${phaseId}/programmes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setLoading(false); return }

    router.push(`/phases/${phaseId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
          Programme name
        </label>
        <input
          id="name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Upper body, Lower body, Full body"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-2 text-xs text-zinc-500">
          You can add multiple programmes to this phase — e.g. Upper, Lower, and Full body running side by side.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Adding…' : 'Add programme'}
      </button>
    </form>
  )
}
