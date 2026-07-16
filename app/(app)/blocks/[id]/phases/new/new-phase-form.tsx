'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SUGGESTIONS = ['Accumulation', 'Intensification', 'Peaking', 'Deload', 'Transition']

export default function NewPhaseForm({ blockId }: { blockId: string }) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) { setError('Give this phase a label.'); return }
    setError('')
    setLoading(true)

    const res = await fetch(`/api/blocks/${blockId}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase_label: label.trim() }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setLoading(false); return }

    router.push(`/blocks/${blockId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="label" className="block text-sm font-medium text-zinc-300 mb-1.5">
          Phase label
        </label>
        <input
          id="label"
          type="text"
          autoFocus
          required
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Accumulation"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setLabel(s)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                label === s
                  ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Adding…' : 'Add phase'}
      </button>
    </form>
  )
}
