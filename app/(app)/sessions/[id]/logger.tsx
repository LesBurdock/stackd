'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ProgrammeSet = {
  id: string
  set_number: number
  target_weight: number | null
  target_reps_min: number | null
  target_reps_max: number | null
  target_rir: number | null
  set_type: string
  load_type: string
  load_percent: number | null
  reference_set_number: number | null
}

type LoggedSet = {
  id: string
  set_number: number
  weight: number
  reps: number
  rir: number | null
}

type SessionExercise = {
  id: string
  order_index: number
  exercise_id: string
  programme_exercise_id: string
  exercises: { id: string; name: string; default_rest_seconds: number; rounding_increment: number }
  programme_exercises: {
    id: string
    num_sets: number
    superset_group: string | null
    superset_order: number | null
    rest_seconds: number | null
    notes: string | null
    load_scheme: string
    programme_sets: ProgrammeSet[]
  }
  logged_sets: LoggedSet[]
}

type PrevLogs = Record<string, Array<{ set_number: number; weight: number; reps: number; rir: number | null }>>

// A "screen" is either a single exercise or a superset group
type Screen = { type: 'single'; se: SessionExercise } | { type: 'superset'; ses: SessionExercise[] }

function buildScreens(exercises: SessionExercise[]): Screen[] {
  const sorted = [...exercises].sort((a, b) => a.order_index - b.order_index)
  const screens: Screen[] = []
  const seen = new Set<string>()

  for (const se of sorted) {
    const group = se.programme_exercises.superset_group
    if (!group) {
      screens.push({ type: 'single', se })
    } else if (!seen.has(group)) {
      seen.add(group)
      const paired = sorted
        .filter(s => s.programme_exercises.superset_group === group)
        .sort((a, b) => (a.programme_exercises.superset_order ?? 0) - (b.programme_exercises.superset_order ?? 0))
      screens.push({ type: 'superset', ses: paired })
    }
  }
  return screens
}

function epley1RM(weight: number, reps: number) {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

function SetRow({
  sessionExId,
  set,
  setIndex,
  loggedSet,
  prevSet,
  suggestion,
  onLog,
  onEdit,
  restSeconds,
}: {
  sessionExId: string
  set: ProgrammeSet
  setIndex: number
  loggedSet: LoggedSet | undefined
  prevSet: { weight: number; reps: number } | undefined
  suggestion: number | null
  onLog: (sessionExId: string, set: ProgrammeSet, weight: number, reps: number, rir: number | null) => Promise<void>
  onEdit: (loggedSetId: string, weight: number, reps: number, rir: number | null, sessionExId: string, setNumber: number) => Promise<void>
  restSeconds: number | null
}) {
  const [weight, setWeight] = useState(suggestion !== null ? String(suggestion) : prevSet ? String(prevSet.weight) : '')
  const [reps, setReps] = useState(prevSet ? String(prevSet.reps) : String(set.target_reps_min ?? ''))
  const [rir, setRir] = useState(set.target_rir !== null ? String(set.target_rir) : '')
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editRir, setEditRir] = useState('')
  const [saving, setSaving] = useState(false)

  // Update weight if suggestion changes (from API response after prior set logged)
  useEffect(() => {
    if (suggestion !== null && !loggedSet) setWeight(String(suggestion))
  }, [suggestion, loggedSet])

  const isLogged = !!loggedSet
  const w = parseFloat(weight)
  const r = parseInt(reps)
  const estimated1RM = !isNaN(w) && !isNaN(r) && w > 0 && r > 0 ? epley1RM(w, r) : null

  const targetLabel = set.target_reps_min && set.target_reps_max
    ? set.target_reps_min === set.target_reps_max
      ? `${set.target_reps_min} reps`
      : `${set.target_reps_min}–${set.target_reps_max} reps`
    : null

  async function handleLog() {
    const wNum = parseFloat(weight)
    const rNum = parseInt(reps)
    if (isNaN(wNum) || isNaN(rNum) || rNum < 1) return
    setLogging(true)
    await onLog(sessionExId, set, wNum, rNum, rir ? parseInt(rir) : null)
    setLogging(false)
  }

  function startEditing() {
    setEditWeight(String(loggedSet!.weight))
    setEditReps(String(loggedSet!.reps))
    setEditRir(loggedSet!.rir !== null ? String(loggedSet!.rir) : '')
    setEditing(true)
  }

  async function handleSaveEdit() {
    const wNum = parseFloat(editWeight)
    const rNum = parseInt(editReps)
    if (isNaN(wNum) || isNaN(rNum) || rNum < 1) return
    setSaving(true)
    await onEdit(loggedSet!.id, wNum, rNum, editRir ? parseInt(editRir) : null, sessionExId, set.set_number)
    setSaving(false)
    setEditing(false)
  }

  if (isLogged && editing) {
    return (
      <div className="py-3 border-b border-zinc-800 last:border-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 text-xs text-zinc-600 shrink-0 text-center">{set.set_number}</span>
          <span className="text-xs text-zinc-500">Editing</span>
        </div>
        <div className="flex items-center gap-2 pl-8">
          <div className="flex-1">
            <label className="block text-[10px] text-zinc-600 mb-1">Weight (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              value={editWeight}
              onChange={e => setEditWeight(e.target.value)}
              className="w-full rounded-lg border border-blue-500/50 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="w-16">
            <label className="block text-[10px] text-zinc-600 mb-1">Reps</label>
            <input
              type="text"
              inputMode="numeric"
              value={editReps}
              onChange={e => setEditReps(e.target.value)}
              className="w-full rounded-lg border border-blue-500/50 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="w-14">
            <label className="block text-[10px] text-zinc-600 mb-1">RIR</label>
            <input
              type="text"
              inputMode="numeric"
              value={editRir}
              onChange={e => setEditRir(e.target.value)}
              placeholder="—"
              className="w-full rounded-lg border border-blue-500/50 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 mt-4">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLogged) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0">
        <span className="w-6 text-xs text-zinc-600 shrink-0 text-center">{set.set_number}</span>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm font-medium text-white">{loggedSet.weight} kg</span>
          <span className="text-zinc-600">×</span>
          <span className="text-sm font-medium text-white">{loggedSet.reps}</span>
          {loggedSet.rir !== null && (
            <span className="text-xs text-zinc-500">RIR {loggedSet.rir}</span>
          )}
        </div>
        <button onClick={startEditing} className="shrink-0 p-1 text-green-500 hover:text-green-400 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 text-xs text-zinc-600 shrink-0 text-center">{set.set_number}</span>
        {prevSet && (
          <span className="text-xs text-zinc-600">Last: {prevSet.weight} kg × {prevSet.reps}</span>
        )}
        {!prevSet && targetLabel && (
          <span className="text-xs text-zinc-600">Target: {targetLabel}</span>
        )}
        {estimated1RM && (
          <span className="ml-auto text-xs text-zinc-500">≈{estimated1RM} kg 1RM</span>
        )}
      </div>
      <div className="flex items-center gap-2 pl-8">
        <div className="flex-1">
          <label className="block text-[10px] text-zinc-600 mb-1">Weight (kg)</label>
          <input
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            placeholder={prevSet ? String(prevSet.weight) : '0'}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-zinc-600 mb-1">Reps</label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={reps}
            onChange={e => setReps(e.target.value)}
            placeholder={String(set.target_reps_min ?? '')}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="w-14">
          <label className="block text-[10px] text-zinc-600 mb-1">RIR</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="5"
            value={rir}
            onChange={e => setRir(e.target.value)}
            placeholder="—"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleLog}
          disabled={logging || !weight || !reps}
          className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {logging ? '…' : 'Log'}
        </button>
      </div>
    </div>
  )
}

function ExerciseBlock({
  se,
  logged,
  prevLogs,
  suggestions,
  onLog,
  onEdit,
  restSeconds,
}: {
  se: SessionExercise
  logged: Record<number, LoggedSet>
  prevLogs: PrevLogs
  suggestions: Record<string, Record<number, number>>
  onLog: (sessionExId: string, set: ProgrammeSet, weight: number, reps: number, rir: number | null) => Promise<void>
  onEdit: (loggedSetId: string, weight: number, reps: number, rir: number | null, sessionExId: string, setNumber: number) => Promise<void>
  restSeconds: number | null
}) {
  const pe = se.programme_exercises
  const seen = new Set<number>()
  const workingSets = pe.programme_sets
    .filter(s => s.set_type !== 'warmup')
    .sort((a, b) => a.set_number - b.set_number)
    .filter(s => { if (seen.has(s.set_number)) return false; seen.add(s.set_number); return true })
  const prev = prevLogs[se.exercise_id] ?? []
  const seSuggestions = suggestions[se.id] ?? {}

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-white">{se.exercises.name}</h2>
        <span className="text-xs text-zinc-500">{pe.num_sets} sets</span>
      </div>
      {pe.notes && <p className="text-xs text-zinc-500 mb-3">{pe.notes}</p>}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4">
        {workingSets.map((set) => (
          <SetRow
            key={set.id}
            sessionExId={se.id}
            set={set}
            setIndex={set.set_number - 1}
            loggedSet={logged[set.set_number]}
            prevSet={prev.find(p => p.set_number === set.set_number)}
            suggestion={seSuggestions[set.set_number] ?? null}
            onLog={onLog}
            onEdit={onEdit}
            restSeconds={restSeconds}
          />
        ))}
      </div>
    </div>
  )
}

export default function Logger({
  sessionId,
  programmeId,
  programmeName,
  sessionExercises,
  previousLogs,
}: {
  sessionId: string
  programmeId: string
  programmeName: string
  sessionExercises: SessionExercise[]
  previousLogs: PrevLogs
}) {
  const router = useRouter()
  const screens = buildScreens(sessionExercises)
  const [screenIdx, setScreenIdx] = useState(0)
  const [finishing, setFinishing] = useState(false)

  // logged[sessionExerciseId][set_number] = LoggedSet
  const [logged, setLogged] = useState<Record<string, Record<number, LoggedSet>>>(() => {
    const init: Record<string, Record<number, LoggedSet>> = {}
    for (const se of sessionExercises) {
      init[se.id] = {}
      for (const ls of se.logged_sets) {
        init[se.id][ls.set_number] = ls
      }
    }
    return init
  })

  // Suggestions from API: suggestions[sessionExId][set_number] = weight
  const [suggestions, setSuggestions] = useState<Record<string, Record<number, number>>>({})

  // Rest timer
  const [restSeconds, setRestSeconds] = useState<number | null>(null)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (restSeconds === null || restSeconds <= 0) {
      if (restRef.current) clearInterval(restRef.current)
      if (restSeconds === 0) setRestSeconds(null)
      return
    }
    restRef.current = setInterval(() => {
      setRestSeconds(s => (s !== null && s > 1 ? s - 1 : 0))
    }, 1000)
    return () => { if (restRef.current) clearInterval(restRef.current) }
  }, [restSeconds !== null && restSeconds > 0])

  async function handleLog(seId: string, set: ProgrammeSet, weight: number, reps: number, rir: number | null) {
    const res = await fetch(`/api/sessions/${sessionId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_exercise_id: seId,
        programme_set_id: set.id,
        set_number: set.set_number,
        weight,
        reps,
        rir,
      }),
    })
    const data = await res.json()
    if (!res.ok) return

    // Update local logged state
    setLogged(prev => ({
      ...prev,
      [seId]: {
        ...prev[seId],
        [set.set_number]: { id: data.id, set_number: set.set_number, weight, reps, rir },
      },
    }))

    // If API returned a suggestion for the next set, store it
    if (data.next_suggestion !== null) {
      const nextSetNumber = set.set_number + 1
      setSuggestions(prev => ({
        ...prev,
        [seId]: { ...(prev[seId] ?? {}), [nextSetNumber]: data.next_suggestion },
      }))
    }

    // Start rest timer
    const se = sessionExercises.find(s => s.id === seId)
    const restDuration = se?.programme_exercises.rest_seconds ?? se?.exercises.default_rest_seconds ?? 90
    setRestSeconds(restDuration)
  }

  async function handleEdit(loggedSetId: string, weight: number, reps: number, rir: number | null, seId: string, setNumber: number) {
    await fetch(`/api/logged-sets/${loggedSetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, reps, rir }),
    })
    setLogged(prev => ({
      ...prev,
      [seId]: {
        ...prev[seId],
        [setNumber]: { ...prev[seId][setNumber], weight, reps, rir },
      },
    }))
  }

  async function handleFinish() {
    setFinishing(true)
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    router.push('/programmes')
  }

  const currentScreen = screens[screenIdx]
  const screenSEs = currentScreen?.type === 'single'
    ? [currentScreen.se]
    : currentScreen?.ses ?? []

  const screenLabel = currentScreen?.type === 'superset'
    ? `Superset: ${screenSEs.map(s => s.exercises.name).join(' + ')}`
    : screenSEs[0]?.exercises.name ?? ''

  // Exercise chip labels
  const chipLabels = screens.map(s =>
    s.type === 'superset'
      ? s.ses.map(se => se.exercises.name.split(' ')[0]).join('+')
      : s.se.exercises.name.split(' ')[0]
  )

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500">{programmeName}</p>
          <h1 className="text-base font-semibold">Workout</h1>
        </div>
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors"
        >
          {finishing ? 'Saving…' : 'Finish early'}
        </button>
      </header>

      {/* Rest timer banner */}
      {restSeconds !== null && (
        <div className="flex items-center justify-between bg-blue-600/20 border-b border-blue-500/20 px-4 py-2">
          <span className="text-sm text-blue-300 font-medium">Rest timer</span>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-blue-300 tabular-nums">
              {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
            </span>
            <button
              onClick={() => setRestSeconds(null)}
              className="text-xs text-blue-400 hover:text-blue-200"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Exercise chips */}
      {screens.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none border-b border-zinc-800">
          {chipLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => setScreenIdx(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                i === screenIdx
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-6">
        {sessionExercises.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-12">
            No exercises in this programme. Add some first.
          </p>
        ) : (
          screenSEs.map((se, i) => (
            <ExerciseBlock
              key={se.id}
              se={se}
              logged={logged[se.id] ?? {}}
              prevLogs={previousLogs}
              suggestions={suggestions}
              onLog={handleLog}
              onEdit={handleEdit}
              restSeconds={restSeconds}
            />
          ))
        )}
      </main>

      {/* Bottom navigation between exercises */}
      {screens.length > 1 && (
        <div className="flex items-center justify-between px-4 pb-8 pt-3 border-t border-zinc-800 gap-3">
          <button
            onClick={() => setScreenIdx(i => Math.max(0, i - 1))}
            disabled={screenIdx === 0}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            Prev
          </button>
          <span className="text-xs text-zinc-600 shrink-0">{screenIdx + 1} / {screens.length}</span>
          {screenIdx < screens.length - 1 ? (
            <button
              onClick={() => setScreenIdx(i => i + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Next exercise
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {finishing ? 'Saving…' : 'Finish workout'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
