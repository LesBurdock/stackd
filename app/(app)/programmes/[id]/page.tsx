import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StartWorkoutButton from './start-workout-button'
import DeleteProgrammeButton from './delete-programme-button'

type ProgrammeSet = {
  id: string
  set_number: number
  target_reps_min: number | null
  target_reps_max: number | null
  set_type: string
}

type ProgrammeExercise = {
  id: string
  order_index: number
  num_sets: number
  superset_group: string | null
  superset_order: number | null
  notes: string | null
  exercises: { id: string; name: string }
  programme_sets: ProgrammeSet[]
}

type Programme = {
  id: string
  name: string
  status: string
  phase_id: string | null
  training_block_phases: {
    phase_label: string
    block_id: string
    training_blocks: { name: string } | null
  } | null
  programme_exercises: ProgrammeExercise[]
}

function setsLabel(ex: ProgrammeExercise): string {
  const working = ex.programme_sets.filter(s => s.set_type === 'working')
  if (working.length === 0) return `${ex.num_sets} sets`
  const s = working[0]
  const reps = s.target_reps_min && s.target_reps_max
    ? s.target_reps_min === s.target_reps_max
      ? `${s.target_reps_min}`
      : `${s.target_reps_min}–${s.target_reps_max}`
    : null
  return reps ? `${working.length}×${reps}` : `${working.length} sets`
}

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: programme } = await supabase
    .from('programmes')
    .select(`
      id, name, status, phase_id,
      training_block_phases(phase_label, block_id, training_blocks(name)),
      programme_exercises(
        id, order_index, num_sets, superset_group, superset_order, notes,
        exercises(id, name),
        programme_sets(id, set_number, target_reps_min, target_reps_max, set_type)
      )
    `)
    .eq('id', id)
    .single()

  if (!programme) notFound()

  const { count: sessionCount } = await supabase
    .from('workout_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('programme_id', id)
    .eq('status', 'completed')

  const p = programme as unknown as Programme
  const phase = p.training_block_phases
  const block = phase?.training_blocks

  const exercises = [...p.programme_exercises].sort((a, b) => a.order_index - b.order_index)

  // Group into supersets and individual items
  const groups: (ProgrammeExercise | ProgrammeExercise[])[] = []
  const seen = new Set<string>()
  for (const ex of exercises) {
    if (!ex.superset_group) {
      groups.push(ex)
    } else if (!seen.has(ex.superset_group)) {
      seen.add(ex.superset_group)
      const paired = exercises
        .filter(e => e.superset_group === ex.superset_group)
        .sort((a, b) => (a.superset_order ?? 0) - (b.superset_order ?? 0))
      groups.push(paired)
    }
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link
          href={phase ? `/phases/${p.phase_id}` : '/programmes'}
          className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {block && (
            <p className="text-xs text-zinc-500 mb-0.5">{block.name} · {phase?.phase_label}</p>
          )}
          <h1 className="text-lg font-semibold truncate">{p.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DeleteProgrammeButton
            programmeId={id}
            programmeName={p.name}
            redirectTo={phase ? `/phases/${p.phase_id}` : '/programmes'}
          />
          <Link
            href={`/programmes/${id}/edit`}
            className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-600"
          >
            Edit
          </Link>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 flex flex-col gap-6">
        <p className="text-sm text-zinc-500">
          {sessionCount ?? 0} session{sessionCount === 1 ? '' : 's'} completed
        </p>

        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <p className="text-sm text-zinc-500">No exercises yet.</p>
            <Link
              href={`/programmes/${id}/edit`}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Add exercises →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group, i) =>
              Array.isArray(group) ? (
                <div key={i} className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
                    Superset
                  </p>
                  {group.map((ex, j) => (
                    <div
                      key={ex.id}
                      className={`flex items-center justify-between px-4 py-3 ${j < group.length - 1 ? 'border-b border-indigo-500/10' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{ex.exercises.name}</p>
                        {ex.notes && <p className="text-xs text-zinc-500 mt-0.5">{ex.notes}</p>}
                      </div>
                      <span className="text-xs text-zinc-500 shrink-0 ml-3">{setsLabel(ex)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div key={group.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{group.exercises.name}</p>
                    {group.notes && <p className="text-xs text-zinc-500 mt-0.5">{group.notes}</p>}
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0 ml-3">{setsLabel(group)}</span>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {p.status === 'active' && exercises.length > 0 && (
        <div className="px-4 pb-8 pt-3 border-t border-zinc-800">
          <StartWorkoutButton programmeId={id} />
        </div>
      )}
    </div>
  )
}
