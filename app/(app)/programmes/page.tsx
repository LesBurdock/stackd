import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BottomNav from '@/components/bottom-nav'
import StartWorkoutInline from './start-workout-inline'

type PhaseProgramme = {
  id: string
  name: string
}

type Phase = {
  id: string
  phase_label: string
  status: 'planned' | 'active' | 'archived'
  order_index: number
  programmes: PhaseProgramme[]
}

type PeakLift = {
  order_index: number
  exercises: { name: string } | null
}

type Block = {
  id: string
  name: string
  training_block_phases: Phase[]
  training_block_peak_lifts: PeakLift[]
}

type Programme = {
  id: string
  name: string
  status: 'active' | 'archived'
}

function PhaseBar({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) return null
  const sorted = [...phases].sort((a, b) => a.order_index - b.order_index)
  return (
    <div className="flex gap-1 mt-3">
      {sorted.map(phase => (
        <div
          key={phase.id}
          className={`h-1.5 flex-1 rounded-full ${
            phase.status === 'archived' ? 'bg-indigo-500'
            : phase.status === 'active' ? 'bg-blue-400'
            : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  )
}

function BlockCard({ block }: { block: Block }) {
  const phases = [...block.training_block_phases].sort((a, b) => a.order_index - b.order_index)
  const activePhase = phases.find(p => p.status === 'active')
  const completedCount = phases.filter(p => p.status === 'archived').length

  const peakLifts = [...block.training_block_peak_lifts]
    .sort((a, b) => a.order_index - b.order_index)
    .map(pl => pl.exercises?.name)
    .filter(Boolean) as string[]

  const activeProgs = activePhase?.programmes ?? []

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* Top section — tapping navigates to block detail */}
      <Link href={`/blocks/${block.id}`} className="block p-4 hover:bg-zinc-800/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-white leading-snug">{block.name}</h3>
          {activePhase && (
            <span className="shrink-0 text-xs font-medium text-blue-400 bg-blue-400/10 rounded-full px-2 py-0.5">
              Active
            </span>
          )}
        </div>

        {peakLifts.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500">Peaking: {peakLifts.join(', ')}</p>
        )}

        <PhaseBar phases={phases} />

        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {activePhase ? activePhase.phase_label
              : phases.length === 0 ? 'No phases yet'
              : 'All phases complete'}
          </p>
          <p className="text-xs text-zinc-600">{completedCount}/{phases.length} phases</p>
        </div>
      </Link>

      {/* Active phase workouts */}
      {activeProgs.length > 0 && (
        <div className="border-t border-zinc-800 divide-y divide-zinc-800">
          {activeProgs.map(prog => (
            <div key={prog.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
              <Link
                href={`/programmes/${prog.id}`}
                className="flex-1 min-w-0 text-sm text-zinc-300 hover:text-white transition-colors truncate"
              >
                {prog.name}
              </Link>
              <StartWorkoutInline programmeId={prog.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgrammeRow({ programme }: { programme: Programme }) {
  return (
    <Link
      href={`/programmes/${programme.id}`}
      className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0 hover:text-zinc-300 transition-colors"
    >
      <span className="text-sm text-zinc-300">{programme.name}</span>
      <span className="text-xs text-blue-400">Active</span>
    </Link>
  )
}

export default async function ProgrammesPage() {
  const supabase = await createClient()

  const [{ data: blocks }, { data: standalone }] = await Promise.all([
    supabase
      .from('training_blocks')
      .select(`
        id, name,
        training_block_phases(id, phase_label, status, order_index, programmes(id, name)),
        training_block_peak_lifts(order_index, exercises(name))
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('programmes')
      .select('id, name, status')
      .is('phase_id', null)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  const hasBlocks = (blocks?.length ?? 0) > 0
  const hasStandalone = (standalone?.length ?? 0) > 0
  const isEmpty = !hasBlocks && !hasStandalone

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Stackd</h1>
        <Link href="/settings" className="p-1 text-zinc-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-28">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
            <div className="size-16 rounded-full bg-zinc-900 flex items-center justify-center text-2xl">🏋️</div>
            <div>
              <h2 className="text-lg font-semibold text-white">Ready to train?</h2>
              <p className="mt-1 text-sm text-zinc-500">Import your first training plan to get started.</p>
            </div>
            <Link
              href="/import"
              className="mt-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Import your first plan
            </Link>
            <Link href="/blocks/new" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              or create a training block manually
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {hasBlocks && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Training Blocks</h2>
                  <div className="flex items-center gap-3">
                    <Link href="/import" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      + Import
                    </Link>
                    <Link href="/blocks/new" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                      + New block
                    </Link>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {(blocks as unknown as Block[]).map(block => (
                    <BlockCard key={block.id} block={block} />
                  ))}
                </div>
              </section>
            )}

            {hasStandalone && (
              <section>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Standalone Programmes</h2>
                </div>
                <div className="rounded-2xl bg-zinc-900 border border-zinc-800 px-4">
                  {(standalone as Programme[]).map(p => (
                    <ProgrammeRow key={p.id} programme={p} />
                  ))}
                </div>
              </section>
            )}

            {!hasBlocks && (
              <div className="flex flex-col gap-2">
                <Link
                  href="/import"
                  className="flex items-center justify-center rounded-2xl border border-dashed border-blue-700 p-6 text-sm text-blue-400 hover:border-blue-500 hover:text-blue-300 transition-colors"
                >
                  + Import a training block
                </Link>
                <Link
                  href="/blocks/new"
                  className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  + Create a block manually
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
