'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ProgrammeSet = {
  id: string
  set_number: number
  target_reps_min: number | null
  target_reps_max: number | null
  target_rir: number | null
  set_type: string
  load_type: string
  load_percent: number | null
}

type ProgrammeExercise = {
  id: string
  order_index: number
  num_sets: number
  superset_group: string | null
  tempo: string | null
  rest_seconds: number | null
  notes: string | null
  load_scheme: string
  ramp_end_percent: number | null
  exercises: { id: string; name: string; default_rest_seconds: number }
  programme_sets: ProgrammeSet[]
}

function repsLabel(ex: ProgrammeExercise) {
  const working = ex.programme_sets.filter(s => s.set_type === 'working')
  if (working.length === 0) return '—'
  const s = working[0]
  if (s.target_reps_min && s.target_reps_max) {
    return s.target_reps_min === s.target_reps_max
      ? `${s.target_reps_min} reps`
      : `${s.target_reps_min}–${s.target_reps_max} reps`
  }
  return '—'
}

function ExerciseCard({
  ex,
  programmeId,
  onUpdated,
  onDeleted,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  startExpanded,
}: {
  ex: ProgrammeExercise
  programmeId: string
  onUpdated: () => void
  onDeleted: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  startExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(startExpanded ?? false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const working = ex.programme_sets.filter(s => s.set_type === 'working')
  const firstWorking = working[0]

  const [numSets, setNumSets] = useState(String(ex.num_sets))
  const [repsMin, setRepsMin] = useState(String(firstWorking?.target_reps_min ?? 8))
  const [repsMax, setRepsMax] = useState(String(firstWorking?.target_reps_max ?? 12))
  const [rir, setRir] = useState(String(firstWorking?.target_rir ?? ''))
  const [loadScheme, setLoadScheme] = useState(ex.load_scheme)
  const [rampPct, setRampPct] = useState(String(ex.ramp_end_percent ?? 30))
  const [rest, setRest] = useState(String(ex.rest_seconds ?? ex.exercises.default_rest_seconds))
  const [tempo, setTempo] = useState(ex.tempo ?? '')
  const [supersetGroup, setSupersetGroup] = useState(ex.superset_group ?? '')
  const [notes, setNotes] = useState(ex.notes ?? '')

  async function save() {
    setSaving(true)
    await fetch(`/api/programme-exercises/${ex.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        num_sets: parseInt(numSets) || 3,
        target_reps_min: parseInt(repsMin) || 8,
        target_reps_max: parseInt(repsMax) || 12,
        target_rir: rir ? parseInt(rir) : null,
        load_scheme: loadScheme,
        ramp_end_percent: loadScheme === 'ramp' ? (parseInt(rampPct) || 30) : null,
        rest_seconds: rest ? parseInt(rest) : null,
        tempo: tempo || null,
        superset_group: supersetGroup || null,
        notes: notes || null,
      }),
    })
    setSaving(false)
    setExpanded(false)
    onUpdated()
  }

  async function remove() {
    if (!confirm(`Remove ${ex.exercises.name}?`)) return
    setDeleting(true)
    await fetch(`/api/programme-exercises/${ex.id}`, { method: 'DELETE' })
    onDeleted()
  }

  return (
    <div className={`rounded-xl border bg-zinc-900 transition-colors ${expanded ? 'border-blue-500/40' : 'border-zinc-800'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder arrows */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 text-zinc-600 hover:text-zinc-400 disabled:opacity-20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 text-zinc-600 hover:text-zinc-400 disabled:opacity-20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Name + summary */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium text-white truncate">{ex.exercises.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {ex.num_sets} sets · {repsLabel(ex)}
            {ex.superset_group ? ` · SS-${ex.superset_group}` : ''}
          </p>
        </button>

        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Sets</label>
              <input
                type="number"
                min="1"
                max="20"
                value={numSets}
                onChange={e => setNumSets(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Rest (sec)</label>
              <input
                type="number"
                min="0"
                value={rest}
                onChange={e => setRest(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Reps min</label>
              <input
                type="number"
                min="1"
                value={repsMin}
                onChange={e => setRepsMin(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Reps max</label>
              <input
                type="number"
                min="1"
                value={repsMax}
                onChange={e => setRepsMax(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">RIR</label>
              <input
                type="number"
                min="0"
                max="5"
                value={rir}
                onChange={e => setRir(e.target.value)}
                placeholder="—"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Load scheme toggle */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Load scheme</label>
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              {(['equal', 'ramp'] as const).map(scheme => (
                <button
                  key={scheme}
                  onClick={() => setLoadScheme(scheme)}
                  className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                    loadScheme === scheme
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {scheme}
                </button>
              ))}
            </div>
            {loadScheme === 'ramp' && (
              <div className="mt-2">
                <label className="block text-xs text-zinc-500 mb-1">Ramp % (e.g. 30 → top set is 130% of opening)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={rampPct}
                  onChange={e => setRampPct(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tempo</label>
              <input
                type="text"
                value={tempo}
                onChange={e => setTempo(e.target.value)}
                placeholder="e.g. 3-1-1-0"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Superset group</label>
              <input
                type="text"
                value={supersetGroup}
                onChange={e => setSupersetGroup(e.target.value)}
                placeholder="e.g. A"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-red-400 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExerciseList({
  programmeId,
  initialExercises,
  expandedId,
}: {
  programmeId: string
  initialExercises: ProgrammeExercise[]
  expandedId?: string
}) {
  const router = useRouter()
  const [exercises, setExercises] = useState(initialExercises)

  async function moveExercise(index: number, direction: 'up' | 'down') {
    const newList = [...exercises]
    const swapIdx = direction === 'up' ? index - 1 : index + 1
    ;[newList[index], newList[swapIdx]] = [newList[swapIdx], newList[index]]

    // Update order_index values
    const updated = newList.map((ex, i) => ({ ...ex, order_index: i }))
    setExercises(updated)

    // Persist both swapped items
    await Promise.all([
      fetch(`/api/programme-exercises/${updated[index].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: index }),
      }),
      fetch(`/api/programme-exercises/${updated[swapIdx].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: swapIdx }),
      }),
    ])
  }

  function refresh() {
    router.refresh()
  }

  function removeLocally(id: string) {
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  if (exercises.length === 0) {
    return (
      <p className="text-sm text-zinc-600 text-center py-8">
        No exercises yet. Add one below.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.id}
          ex={ex}
          programmeId={programmeId}
          onUpdated={refresh}
          onDeleted={() => removeLocally(ex.id)}
          onMoveUp={() => moveExercise(i, 'up')}
          onMoveDown={() => moveExercise(i, 'down')}
          isFirst={i === 0}
          isLast={i === exercises.length - 1}
          startExpanded={ex.id === expandedId}
        />
      ))}
    </div>
  )
}
