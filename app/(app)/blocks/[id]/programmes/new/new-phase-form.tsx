'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PHASE_SUGGESTIONS = ['Accumulation', 'Intensification', 'Peaking', 'Deload', 'Transition']

export default function NewPhaseForm({ blockId }: { blockId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phaseLabel, setPhaseLabel] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Give this programme a name.')
      return
    }

    setLoading(true)

    const res = await fetch(`/api/blocks/${blockId}/programmes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phase_label: phaseLabel.trim() || null }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    router.push(`/blocks/${blockId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      <div>
        <label htmlFor="phase-label" className="block text-sm font-medium text-zinc-300 mb-1.5">
          Phase label <span className="text-zinc-500 font-normal">(optional)</span>
        </label>
        <input
          id="phase-label"
          type="text"
          value={phaseLabel}
          onChange={e => setPhaseLabel(e.target.value)}
          placeholder="e.g. Accumulation"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {PHASE_SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPhaseLabel(s)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                phaseLabel === s
                  ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

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
          placeholder="e.g. Upper / Lower 4-day"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding…' : 'Add programme'}
      </button>
    </form>
  )
}
