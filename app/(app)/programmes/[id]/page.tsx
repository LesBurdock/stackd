import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import StartWorkoutButton from './start-workout-button'
import DeleteProgrammeButton from './delete-programme-button'
import { assignTabLabels } from '@/lib/exercise-tabs'

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
  exercises: { id: string; name: string; group_name: string | null }
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
    status: string
    duration_weeks: number | null
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
  return reps ? `${ex.num_sets}×${reps}` : `${ex.num_sets} sets`
}

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: programme } = await supabase
    .from('programmes')
    .select(`
      id, name, status, phase_id,
      training_block_phases(phase_label, block_id, status, duration_weeks, training_blocks(name)),
      programme_exercises(
        id, order_index, num_sets, superset_group, superset_order, notes,
        exercises(id, name, group_name),
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
  const tabbed = assignTabLabels(
    exercises.map(ex => ({ ...ex, orderIndex: ex.order_index, supersetGroup: ex.superset_group, supersetOrder: ex.superset_order }))
  )

  // Group into supersets and individual items, preserving the derived tab labels.
  const groups: (typeof tabbed[number] | typeof tabbed)[] = []
  const seen = new Set<string>()
  for (const ex of tabbed) {
    if (!ex.superset_group) {
      groups.push(ex)
    } else if (!seen.has(ex.superset_group)) {
      seen.add(ex.superset_group)
      const paired = tabbed
        .filter(e => e.superset_group === ex.superset_group)
        .sort((a, b) => (a.superset_order ?? 0) - (b.superset_order ?? 0))
      groups.push(paired)
    }
  }

  const done = sessionCount ?? 0
  const total = phase?.duration_weeks ?? null
  // Standalone workouts (no phase) have no look-ahead concept -- only a workout that belongs
  // to a block phase can be disabled by that phase not being active yet.
  const isPhaseActive = !phase || phase.status === 'active'

  return (
    <div className="h-dvh bg-background text-ink flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link
          href={phase ? `/phases/${p.phase_id}` : '/programmes'}
          className="p-1 -ml-1 text-muted hover:text-ink transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {block && (
            <p className="text-xs text-muted mb-0.5 truncate">{block.name} · {phase?.phase_label}</p>
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
            className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-ink"
          >
            Edit
          </Link>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 flex flex-col gap-6">
        <p className="text-sm text-muted">
          {total !== null ? `${done} of ${total} sessions done` : `${done} sessions done`}
          {' · '}{exercises.length} exercise{exercises.length === 1 ? '' : 's'}
        </p>

        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <p className="text-sm text-muted">No exercises yet.</p>
            <Link href={`/programmes/${id}/edit`} className="text-sm text-action hover:brightness-90 transition-[filter]">
              Add exercises →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group, i) =>
              Array.isArray(group) ? (
                <div key={i} className="flex gap-3">
                  <div className="w-0.5 shrink-0 bg-border rounded-full" />
                  <div className="flex-1 flex flex-col gap-3 py-0.5">
                    {group.map(ex => (
                      <div key={ex.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex gap-2">
                          <span className="text-xs font-mono text-muted shrink-0 pt-0.5">{ex.tabLabel}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{ex.exercises.group_name ?? ex.exercises.name}</p>
                            {ex.exercises.group_name && <p className="text-xs text-muted truncate">{ex.exercises.name}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-muted shrink-0 ml-3 pt-0.5">{setsLabel(ex)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={group.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex gap-2">
                    <span className="text-xs font-mono text-muted shrink-0 pt-0.5">{group.tabLabel}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{group.exercises.group_name ?? group.exercises.name}</p>
                      {group.exercises.group_name && <p className="text-xs text-muted truncate">{group.exercises.name}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-muted shrink-0 ml-3 pt-0.5">{setsLabel(group)}</span>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {p.status === 'active' && exercises.length > 0 && (
        <div className="px-4 pb-8 pt-3 border-t border-divider">
          <StartWorkoutButton
            programmeId={id}
            disabled={!isPhaseActive}
            disabledReason={!isPhaseActive ? "This phase hasn't started yet" : undefined}
          />
        </div>
      )}
    </div>
  )
}
