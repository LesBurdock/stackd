'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  name: string
  category: string | null
  equipment: string | null
  is_custom: boolean
}

export default function ExercisePicker({
  exercises,
  programmeId,
}: {
  exercises: Exercise[]
  programmeId?: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [equipment, setEquipment] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const equipmentOptions = [...new Set(exercises.map(e => e.equipment).filter(Boolean))] as string[]

  const filtered = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchesEquipment = !equipment || e.equipment === equipment
    return matchesSearch && matchesEquipment
  })

  async function addToProgramme(exerciseId: string) {
    if (!programmeId) return
    setAdding(exerciseId)
    const res = await fetch(`/api/programmes/${programmeId}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: exerciseId }),
    })
    if (res.ok) {
      const { id: newExId } = await res.json()
      router.push(`/programmes/${programmeId}/edit?expanded=${newExId}`)
      router.refresh()
    } else {
      setAdding(null)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Search */}
      <div className="px-4 pb-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Equipment filter chips */}
      {equipmentOptions.length > 0 && (
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setEquipment(null)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
              equipment === null
                ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            All
          </button>
          {equipmentOptions.map(eq => (
            <button
              key={eq}
              onClick={() => setEquipment(equipment === eq ? null : eq)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                equipment === eq
                  ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {eq}
            </button>
          ))}
        </div>
      )}

      {/* Exercise list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4 text-center">No exercises found.</p>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {filtered.map(ex => (
              <div key={ex.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{ex.name}</span>
                    {ex.is_custom && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
                        Custom
                      </span>
                    )}
                  </div>
                  {ex.equipment && (
                    <span className="text-xs text-zinc-500">{ex.equipment}</span>
                  )}
                </div>
                {programmeId ? (
                  <button
                    onClick={() => addToProgramme(ex.id)}
                    disabled={adding === ex.id}
                    className="shrink-0 ml-3 rounded-lg bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/30 disabled:opacity-50 transition-colors"
                  >
                    {adding === ex.id ? '…' : 'Add'}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
