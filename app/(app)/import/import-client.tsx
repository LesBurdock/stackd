'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type SlotRole = 'warmup_primer' | 'primary_compound' | 'secondary_compound' | 'accessory_isolation' | 'finisher_isolation'

interface PreviewSet {
  set_number: number
  week_number: number | null
  target_weight: number | null
  target_reps_min: number | null
  target_reps_max: number | null
  target_duration_seconds: number | null
  set_type: 'working' | 'amrap'
  weight_status: string | null
  weight_basis: string | null
  weight_confidence: string | null
}

interface PreviewExercise {
  exercise_name: string
  matched_exercise_id: string | null
  matched_exercise_name: string | null
  is_new: boolean
  order_index: number
  superset_group: string | null
  superset_order: number | null
  slot_role: SlotRole | null
  prescription_type: 'reps' | 'duration'
  num_sets: number
  tempo: string | null
  rest_seconds: number | null
  notes: string | null
  sets: PreviewSet[]
}

interface PreviewProgramme {
  name: string
  exercises: PreviewExercise[]
}

interface PreviewPhase {
  phase_label: string
  order_index: number
  programmes: PreviewProgramme[]
}

interface ImportPreview {
  block: {
    name: string
    athlete_name: string | null
    model_name: string | null
    weeks_total: number
    days_per_week: number
    target_priority_regions: string[]
    constraints: string[]
    peaking_focus: { label: string } | null
  }
  phases: PreviewPhase[]
  stats: {
    phase_count: number
    programme_count: number
    exercise_count: number
    new_exercise_count: number
    matched_exercise_count: number
  }
}

function formatReps(ex: PreviewExercise) {
  const s = ex.sets[0]
  if (!s) return '—'
  if (s.set_type === 'amrap') return 'MAX'
  if (ex.prescription_type === 'duration' && s.target_duration_seconds) return `${s.target_duration_seconds}s`
  if (s.target_reps_min !== null && s.target_reps_max !== null) {
    return s.target_reps_min === s.target_reps_max ? `${s.target_reps_min}` : `${s.target_reps_min}–${s.target_reps_max}`
  }
  return '—'
}

function ExerciseRow({ ex }: { ex: PreviewExercise }) {
  const firstSet = ex.sets[0]
  const isWeekSpecific = ex.sets.some(s => s.week_number !== null)
  const weightLabel = firstSet?.target_weight != null ? `${firstSet.target_weight} kg` : 'TBD'

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{ex.exercise_name}</p>
        {ex.matched_exercise_name && ex.matched_exercise_name !== ex.exercise_name && (
          <p className="text-xs text-zinc-500 mt-0.5">matched → {ex.matched_exercise_name}</p>
        )}
        <p className="text-xs text-zinc-500 mt-0.5">
          {ex.num_sets} × {formatReps(ex)} · {weightLabel}
          {isWeekSpecific && ' · week-specific weights'}
        </p>
      </div>
      {ex.is_new ? (
        <span className="shrink-0 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-full px-2 py-0.5">new</span>
      ) : (
        <span className="shrink-0 text-xs font-medium bg-emerald-500/15 text-emerald-400 rounded-full px-2 py-0.5">matched</span>
      )}
    </div>
  )
}

export default function ImportClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [rawPlan, setRawPlan] = useState<object | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [step, setStep] = useState<'pick' | 'preview' | 'saving'>('pick')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)

    let plan: object
    try {
      const text = await file.text()
      plan = JSON.parse(text)
    } catch {
      setError('Could not parse file — make sure it is a valid .json file.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/blocks/import-json?preview=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, preview: true }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to parse plan.')
      setLoading(false)
      return
    }

    setRawPlan(plan)
    setPreview(data)
    setFileName(file.name)
    setStep('preview')
    setLoading(false)
  }

  async function handleSave() {
    if (!rawPlan) return
    setStep('saving')
    setError(null)

    const res = await fetch('/api/blocks/import-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: rawPlan, preview: false }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Import failed.')
      setStep('preview')
      return
    }

    router.push(`/blocks/${data.blockId}`)
  }

  function reset() {
    setPreview(null)
    setRawPlan(null)
    setFileName(null)
    setStep('pick')
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/programmes" className="text-zinc-400 hover:text-white transition-colors text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Import training block</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-12">
        {step === 'pick' && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-zinc-400">
              Upload a <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded text-xs">.json</code> file generated in the unified training plan format to import a full training block — all phases and programmes in one go.
            </p>

            <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900 p-12 cursor-pointer hover:border-blue-500 transition-colors">
              <div className="flex flex-col items-center gap-2 text-center">
                <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium text-zinc-300">
                  {loading ? 'Reading file…' : 'Tap to choose a .json file'}
                </p>
                <p className="text-xs text-zinc-500">unified-training-plan format</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFile}
                disabled={loading}
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-800 bg-red-950/30 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="flex flex-col gap-6">
            {/* File name */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-xs text-zinc-500 truncate">{fileName}</p>
            </div>

            {/* Block summary */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-2">
              <h2 className="text-base font-semibold text-white">{preview.block.name}</h2>
              {preview.block.athlete_name && (
                <p className="text-xs text-zinc-500">Athlete: {preview.block.athlete_name}</p>
              )}
              {preview.block.peaking_focus && (
                <p className="text-xs text-zinc-400">Peaking: {preview.block.peaking_focus.label}</p>
              )}
              <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                <span>{preview.block.weeks_total} weeks</span>
                <span>{preview.block.days_per_week}×/week</span>
                {preview.block.model_name && <span>{preview.block.model_name}</span>}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Phases', value: preview.stats.phase_count },
                { label: 'Programmes', value: preview.stats.programme_count },
                { label: 'Exercises', value: preview.stats.exercise_count },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {preview.stats.new_exercise_count > 0 && (
              <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 px-4 py-3">
                <p className="text-sm text-amber-300">
                  <span className="font-semibold">{preview.stats.new_exercise_count} new exercise{preview.stats.new_exercise_count > 1 ? 's' : ''}</span>
                  {' '}will be added to your library. You can rename them afterwards in the exercise library.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-800 bg-red-950/30 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Phase breakdown */}
            {preview.phases.map(phase => (
              <section key={phase.phase_label + phase.order_index}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                  {phase.phase_label}
                </h2>
                <div className="flex flex-col gap-3">
                  {phase.programmes.map(prog => (
                    <div key={prog.name} className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800">
                        <p className="text-sm font-semibold text-white">{prog.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{prog.exercises.length} exercises</p>
                      </div>
                      {prog.exercises.map(ex => (
                        <ExerciseRow key={ex.exercise_name + ex.order_index} ex={ex} />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 pb-4">
              <button
                onClick={handleSave}
                className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-blue-500 active:bg-blue-700 transition-colors"
              >
                Import training block
              </button>
              <button
                onClick={reset}
                className="w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Discard and choose another file
              </button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Importing training block…</p>
          </div>
        )}
      </main>
    </div>
  )
}
