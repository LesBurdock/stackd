import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BottomNav from '@/components/bottom-nav'
import Card from '@/components/card'
import EmptyTrainingState from '@/components/empty-training-state'
import StartBlockButton from '@/components/start-block-button'
import FinishBlockButton from '@/components/finish-block-button'
import {
  phaseSessionTotals,
  isBlockReadyToFinish,
  previousBlockDateLabel,
  type PhaseProgress,
} from '@/lib/derived-counts'

type RawProgramme = { id: string; name: string; order_index: number | null }
type RawPhase = {
  id: string
  phase_label: string
  order_index: number
  status: 'planned' | 'active' | 'archived'
  duration_weeks: number | null
  programmes: RawProgramme[]
}
type RawBlock = {
  id: string
  name: string
  status: 'planned' | 'active' | 'archived'
  weeks_total: number | null
  finished_at: string | null
  created_at: string
  training_block_phases: RawPhase[]
}

function formatImportedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function PhaseRow({ phase }: { phase: PhaseProgress }) {
  const { done, total } = phaseSessionTotals(phase)
  const isDone = phase.status === 'archived'
  const isCurrent = phase.status === 'active'

  return (
    <Link
      href={`/phases/${phase.id}`}
      className="flex items-center justify-between py-2.5 border-b border-divider last:border-0 hover:opacity-80 transition-opacity"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`shrink-0 flex items-center justify-center size-6 rounded-full text-xs ${
            isDone ? 'bg-ink text-white' : isCurrent ? 'border-2 border-ink' : 'border-2 border-border'
          }`}
        >
          {isDone ? '✓' : isCurrent ? <span className="size-2 rounded-full bg-ink" /> : null}
        </span>
        <span className={`font-semibold truncate ${isCurrent ? 'text-ink' : isDone ? 'text-ink' : 'text-muted'}`}>
          {phase.label}
        </span>
      </div>
      <span className="shrink-0 text-xs text-muted">
        {isDone ? 'Done' : !isCurrent ? 'Not started' : total !== null ? `${done} of ${total}` : `${done} sessions`}
      </span>
    </Link>
  )
}

function ActiveBlockCard({ block, phases }: { block: RawBlock; phases: PhaseProgress[] }) {
  const ready = isBlockReadyToFinish(phases)

  return (
    <Card className="p-4">
      <h2 className="text-2xl font-bold text-ink leading-tight">{block.name}</h2>
      <p className="mt-0.5 text-xs text-muted">{phases.length} phase{phases.length === 1 ? '' : 's'}</p>

      <div className="mt-3">
        {phases.map(phase => <PhaseRow key={phase.id} phase={phase} />)}
      </div>

      <div className="mt-4">
        {ready ? (
          <FinishBlockButton blockId={block.id} blockName={block.name} variant="primary" />
        ) : (
          <div className="text-center">
            <FinishBlockButton blockId={block.id} blockName={block.name} variant="quiet" />
          </div>
        )}
      </div>
    </Card>
  )
}

function UpNextCard({ block, disabledReason }: { block: RawBlock; disabledReason: string | null }) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-bold text-ink leading-tight">{block.name}</h3>
      <p className="mt-0.5 text-xs text-muted">
        {block.training_block_phases.length} phase{block.training_block_phases.length === 1 ? '' : 's'}
        {' · imported '}{formatImportedDate(block.created_at)}
      </p>
      <div className="mt-3">
        <StartBlockButton blockId={block.id} disabledReason={disabledReason} />
      </div>
    </Card>
  )
}

function PreviousBlockRow({
  block,
  dateLabel,
}: {
  block: RawBlock
  dateLabel: string | null
}) {
  return (
    <Link
      href={`/blocks/${block.id}`}
      className="flex items-center justify-between py-3 border-b border-divider last:border-0 hover:opacity-70 transition-opacity"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{block.name}</p>
        <p className="text-xs text-muted mt-0.5">
          {dateLabel ?? `${block.training_block_phases.length} phase${block.training_block_phases.length === 1 ? '' : 's'}`}
        </p>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-faint shrink-0 ml-3">
        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
      </svg>
    </Link>
  )
}

export default async function ProgrammesPage() {
  const supabase = await createClient()

  const { data: blocksRaw } = await supabase
    .from('training_blocks')
    .select(`
      id, name, status, weeks_total, finished_at, created_at,
      training_block_phases(id, phase_label, order_index, status, duration_weeks,
        programmes(id, name, order_index))
    `)
    .order('created_at', { ascending: true })

  const blocks = (blocksRaw ?? []) as unknown as RawBlock[]

  const allProgrammeIds = blocks.flatMap(b =>
    b.training_block_phases.flatMap(ph => ph.programmes.map(p => p.id))
  )

  // One query for every completed session across every programme in every block, instead of
  // one query per programme -- aggregated below in JS.
  const sessionsByProgramme = new Map<string, string[]>() // programmeId -> completed_at[]
  if (allProgrammeIds.length > 0) {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('programme_id, completed_at')
      .in('programme_id', allProgrammeIds)
      .eq('status', 'completed')
    for (const s of sessions ?? []) {
      const list = sessionsByProgramme.get(s.programme_id) ?? []
      if (s.completed_at) list.push(s.completed_at)
      sessionsByProgramme.set(s.programme_id, list)
    }
  }

  function phasesFor(block: RawBlock): PhaseProgress[] {
    return [...block.training_block_phases]
      .sort((a, b) => a.order_index - b.order_index)
      .map(ph => ({
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
            completedSessions: (sessionsByProgramme.get(p.id) ?? []).length,
          })),
      }))
  }

  const activeBlock = blocks.find(b => b.status === 'active') ?? null
  const upNextBlocks = blocks.filter(b => b.status === 'planned')
  const previousBlocks = [...blocks.filter(b => b.status === 'archived')].sort((a, b) =>
    (b.finished_at ?? b.created_at).localeCompare(a.finished_at ?? a.created_at)
  )

  const isEmpty = blocks.length === 0
  const disabledReason = activeBlock ? `Finish ${activeBlock.name} first` : null

  return (
    <div className="h-dvh bg-background text-ink flex flex-col">
      <header className="flex items-center justify-between px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Training</h1>
        <div className="flex items-center gap-3">
          <Link href="/import" className="text-sm font-semibold text-action hover:brightness-90 transition-[filter]">
            + Import
          </Link>
          <Link href="/settings" className="p-1 text-muted hover:text-ink transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-28">
        {isEmpty ? (
          <EmptyTrainingState />
        ) : (
          <div className="flex flex-col gap-8">
            {activeBlock && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Active training block</h2>
                <ActiveBlockCard block={activeBlock} phases={phasesFor(activeBlock)} />
              </section>
            )}

            {upNextBlocks.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Up next</h2>
                <div className="flex flex-col gap-3">
                  {upNextBlocks.map(b => (
                    <UpNextCard key={b.id} block={b} disabledReason={disabledReason} />
                  ))}
                </div>
              </section>
            )}

            {previousBlocks.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Previous training blocks</h2>
                <Card className="px-4">
                  {previousBlocks.map(b => {
                    const programmeIds = b.training_block_phases.flatMap(ph => ph.programmes.map(p => p.id))
                    const dates = programmeIds.flatMap(id => sessionsByProgramme.get(id) ?? []).sort()
                    const dateLabel = previousBlockDateLabel(
                      b.finished_at,
                      dates[0] ?? null,
                      dates[dates.length - 1] ?? null,
                      b.weeks_total
                    )
                    return <PreviousBlockRow key={b.id} block={b} dateLabel={dateLabel} />
                  })}
                </Card>
              </section>
            )}

            {!activeBlock && upNextBlocks.length === 0 && previousBlocks.length === 0 && (
              // Shouldn't happen given isEmpty above, but keeps this exhaustive.
              null
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
