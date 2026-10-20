import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeletePhaseButton from './delete-phase-button'
import FinishPhaseButton from './finish-phase-button'
import SegmentedBar from '@/components/segmented-bar'
import TagPill from '@/components/tag-pill'
import { phaseSessionTotals, suggestedWorkout, type PhaseProgress } from '@/lib/derived-counts'

export default async function PhaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: phaseId } = await params
  const supabase = await createClient()

  const { data: phase } = await supabase
    .from('training_block_phases')
    .select(`
      id, phase_label, status, order_index, duration_weeks, block_id,
      training_blocks(id, name),
      programmes(id, name, order_index)
    `)
    .eq('id', phaseId)
    .single()

  if (!phase) notFound()

  const block = phase.training_blocks as unknown as { id: string; name: string } | null
  const rawProgrammes = phase.programmes as unknown as { id: string; name: string; order_index: number | null }[]

  const { count: totalPhases } = await supabase
    .from('training_block_phases')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', phase.block_id)

  const programmeIds = rawProgrammes.map(p => p.id)
  const sessionsByProgramme = new Map<string, number>()
  if (programmeIds.length > 0) {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('programme_id')
      .in('programme_id', programmeIds)
      .eq('status', 'completed')
    for (const s of sessions ?? []) {
      sessionsByProgramme.set(s.programme_id, (sessionsByProgramme.get(s.programme_id) ?? 0) + 1)
    }
  }

  const phaseProgress: PhaseProgress = {
    id: phase.id,
    label: phase.phase_label,
    orderIndex: phase.order_index,
    status: phase.status as 'planned' | 'active' | 'archived',
    durationWeeks: phase.duration_weeks,
    workouts: [...rawProgrammes]
      .sort((a, b) => (a.order_index ?? Infinity) - (b.order_index ?? Infinity))
      .map(p => ({
        programmeId: p.id,
        name: p.name,
        orderIndex: p.order_index,
        completedSessions: sessionsByProgramme.get(p.id) ?? 0,
      })),
  }

  const { done, total } = phaseSessionTotals(phaseProgress)
  const suggested = suggestedWorkout(phaseProgress)

  return (
    <div className="h-dvh bg-background text-ink flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link
          href={`/blocks/${phase.block_id}`}
          className="p-1 -ml-1 text-muted hover:text-ink transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {block && <p className="text-xs text-muted mb-0.5 truncate">{block.name}</p>}
          <p className="text-xs text-muted">Phase {phase.order_index + 1} of {totalPhases ?? '?'}</p>
        </div>
        <DeletePhaseButton
          phaseId={phaseId}
          phaseLabel={phase.phase_label}
          blockId={phase.block_id}
          programmeCount={rawProgrammes.length}
        />
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-12 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-ink leading-tight">{phase.phase_label}</h1>
          <div className="mt-3 flex items-center gap-3">
            {total !== null ? (
              <>
                <SegmentedBar total={total} done={done} />
                <span className="shrink-0 text-sm font-semibold text-ink">{done} of {total} sessions</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-ink">{done} sessions</span>
            )}
          </div>
        </div>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Workouts{phase.duration_weeks !== null && ` · ${phase.duration_weeks} sessions each`}
          </h2>

          <div className="flex flex-col gap-2">
            {phaseProgress.workouts.length === 0 ? (
              <p className="text-sm text-muted py-1">No workouts yet.</p>
            ) : (
              phaseProgress.workouts.map(w => (
                <Link
                  key={w.programmeId}
                  href={`/programmes/${w.programmeId}`}
                  className="rounded-xl border border-divider bg-white px-4 py-3 hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-ink truncate">{w.name}</span>
                      {suggested?.programmeId === w.programmeId && <TagPill highlight>Up next</TagPill>}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-faint shrink-0">
                      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {phase.duration_weeks !== null ? (
                      <>
                        <SegmentedBar total={phase.duration_weeks} done={w.completedSessions} />
                        <span className="shrink-0 text-xs text-muted">{w.completedSessions} of {phase.duration_weeks}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">{w.completedSessions} sessions</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href={`/phases/${phaseId}/programmes/new`}
            className="mt-3 block text-center text-sm text-muted hover:text-ink transition-colors"
          >
            + Add workout
          </Link>
        </section>

        {phase.status === 'active' && (
          <FinishPhaseButton phaseId={phaseId} phaseLabel={phase.phase_label} blockId={phase.block_id} />
        )}
      </main>
    </div>
  )
}
