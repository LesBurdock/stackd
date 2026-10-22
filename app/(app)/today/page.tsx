import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/bottom-nav'
import EmptyTrainingState from '@/components/empty-training-state'
import StartBlockButton from '@/components/start-block-button'
import Card from '@/components/card'
import TodayCard from './today-card'
import ResumeSessionCard from './resume-session-card'
import PhaseCompleteCard from './phase-complete-card'
import { isPhaseComplete, type PhaseProgress } from '@/lib/derived-counts'

type RawProgramme = { id: string; name: string; order_index: number | null }
type RawPhase = {
  id: string
  phase_label: string
  order_index: number
  status: 'planned' | 'active' | 'archived'
  duration_weeks: number | null
  programmes: RawProgramme[]
}

export default async function TodayPage() {
  const supabase = await createClient()

  // (a) A session is already in progress -- takes priority over everything else.
  const { data: inProgress } = await supabase
    .from('workout_sessions')
    .select('id, started_at, programmes(name)')
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let content: React.ReactNode

  if (inProgress) {
    const programme = inProgress.programmes as unknown as { name: string } | null
    content = (
      <ResumeSessionCard
        sessionId={inProgress.id}
        workoutName={programme?.name ?? 'Workout'}
        startedAt={inProgress.started_at}
      />
    )
  } else {
    const { data: block } = await supabase
      .from('training_blocks')
      .select(`
        id, name, weeks_total,
        training_block_phases(id, phase_label, order_index, status, duration_weeks,
          programmes(id, name, order_index))
      `)
      .eq('status', 'active')
      .maybeSingle()

    if (block) {
      const phaseRows = [...(block.training_block_phases as unknown as RawPhase[])].sort(
        (a, b) => a.order_index - b.order_index
      )
      const activePhaseRow = phaseRows.find(p => p.status === 'active') ?? null

      if (activePhaseRow && activePhaseRow.programmes.length > 0) {
        const allProgrammeIds = phaseRows.flatMap(ph => ph.programmes.map(p => p.id))
        const sessionsByProgramme = new Map<string, number>()
        if (allProgrammeIds.length > 0) {
          const { data: sessions } = await supabase
            .from('workout_sessions')
            .select('programme_id')
            .in('programme_id', allProgrammeIds)
            .eq('status', 'completed')
          for (const s of sessions ?? []) {
            sessionsByProgramme.set(s.programme_id, (sessionsByProgramme.get(s.programme_id) ?? 0) + 1)
          }
        }

        const toPhaseProgress = (ph: RawPhase): PhaseProgress => ({
          id: ph.id,
          label: ph.phase_label,
          orderIndex: ph.order_index,
          status: ph.status,
          durationWeeks: ph.duration_weeks,
          workouts: [...ph.programmes]
            .sort((a, b) => (a.order_index ?? Infinity) - (b.order_index ?? Infinity))
            .map(p => ({
              programmeId: p.id,
              name: p.name,
              orderIndex: p.order_index,
              completedSessions: sessionsByProgramme.get(p.id) ?? 0,
            })),
        })

        const allPhases = phaseRows.map(toPhaseProgress)
        const activePhase = toPhaseProgress(activePhaseRow)

        if (isPhaseComplete(activePhase)) {
          // (b) Every workout in the active phase has reached its N sessions.
          const { data: nextPhase } = await supabase
            .from('training_block_phases')
            .select('phase_label')
            .eq('block_id', block.id)
            .eq('status', 'planned')
            .gt('order_index', activePhaseRow.order_index)
            .order('order_index', { ascending: true })
            .limit(1)
            .maybeSingle()

          content = (
            <PhaseCompleteCard
              phaseId={activePhaseRow.id}
              phaseLabel={activePhase.label}
              nextPhaseLabel={nextPhase?.phase_label ?? null}
              blockId={block.id}
              blockName={block.name}
            />
          )
        } else {
          // Happy path (step 2).
          const activePhaseProgrammeIds = activePhaseRow.programmes.map(p => p.id)
          let lastCompletedWorkoutName: string | null = null
          if (activePhaseProgrammeIds.length > 0) {
            const { data: lastSession } = await supabase
              .from('workout_sessions')
              .select('completed_at, programmes(name)')
              .in('programme_id', activePhaseProgrammeIds)
              .eq('status', 'completed')
              .order('completed_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            const programme = lastSession?.programmes as unknown as { name: string } | null
            lastCompletedWorkoutName = programme?.name ?? null
          }

          content = (
            <TodayCard
              allPhases={allPhases}
              activePhase={activePhase}
              weeksTotal={block.weeks_total}
              lastCompletedWorkoutName={lastCompletedWorkoutName}
            />
          )
        }
      }
    } else {
      // (c) No active block -- is one planned?
      const { data: plannedBlock } = await supabase
        .from('training_blocks')
        .select('id, name')
        .eq('status', 'planned')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (plannedBlock) {
        content = (
          <Card className="p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">No active training block</p>
            <h2 className="mt-1 text-2xl font-bold text-ink leading-tight">{plannedBlock.name}</h2>
            <div className="mt-4">
              <StartBlockButton blockId={plannedBlock.id} disabledReason={null} />
            </div>
          </Card>
        )
      } else {
        // (d) No blocks at all (or only archived ones, with nothing to start today).
        content = <EmptyTrainingState />
      }
    }
  }

  return (
    <div className="h-dvh bg-background text-ink flex flex-col">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Today</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-28">{content}</main>
      <BottomNav />
    </div>
  )
}
