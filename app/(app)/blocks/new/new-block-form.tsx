'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  name: string
  category: string | null
  equipment: string | null
}

export default function NewBlockForm({ exercises }: { exercises: Exercise[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return exercises
    return exercises.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q) ||
        e.equipment?.toLowerCase().includes(q)
    )
  }, [exercises, search])

  function toggleExercise(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectedExercises = selectedIds
    .map(id => exercises.find(e => e.id === id))
    .filter(Boolean) as Exercise[]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Give your block a name.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), peak_lift_exercise_ids: selectedIds }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }

    router.push(`/blocks/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Block name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
          Block name
        </label>
        <input
          id="name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Powerlifting Accumulation"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Peak lifts */}
      <div>
        <p className="text-sm font-medium text-zinc-300 mb-1">Peak lifts</p>
        <p className="text-xs text-zinc-500 mb-3">The exercises you're building towards this block. Optional.</p>

        {selectedExercises.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedExercises.map(e => (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleExercise(e.id)}
                className="flex items-center gap-1.5 rounded-full bg-blue-600/20 border border-blue-500/30 px-3 py-1 text-xs font-medium text-blue-300"
              >
                {e.name}
                <span className="text-blue-400 leading-none">×</span>
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
        />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">No exercises match.</p>
          ) : (
            filtered.map(exercise => {
              const selected = selectedIds.includes(exercise.id)
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => toggleExercise(exercise.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                    selected ? 'bg-blue-600/10' : 'hover:bg-zinc-800'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${selected ? 'text-blue-300' : 'text-white'}`}>
                      {exercise.name}
                    </p>
                    {exercise.equipment && (
                      <p className="text-xs text-zinc-500">{exercise.equipment}</p>
                    )}
                  </div>
                  {selected && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5 text-blue-400 shrink-0">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )
            })
          )}
        </div>
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
        {loading ? 'Creating…' : 'Create block'}
      </button>
    </form>
  )
}
