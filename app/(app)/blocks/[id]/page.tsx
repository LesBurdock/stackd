import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import GoalsSection from './goals-section'

const STATUS_LABEL: Record<string, string> = { active: 'Active', planned: 'Planned', archived: 'Done' }
const STATUS_COLOUR: Record<string, string> = {
  active: 'text-blue-400 bg-blue-400/10',
  planned: 'text-zinc-400 bg-zinc-800',
  archived: 'text-indigo-400 bg-indigo-400/10',
}

export default async function BlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: block } = await supabase
    .from('training_blocks')
    .select(`
      id, name,
      training_block_peak_lifts(order_index, exercises(name)),
      training_block_goals(id, description, order_index, achieved, achieved_at),
      training_block_phases(id, phase_label, status, order_index)
    `)
    .eq('id', id)
    .single()

  if (!block) notFound()

  const peakLifts = (block.training_block_peak_lifts as unknown as { order_index: number; exercises: { name: string } | null }[])
    .sort((a, b) => a.order_index - b.order_index)
    .map(pl => pl.exercises?.name)
    .filter(Boolean) as string[]

  const goals = (block.training_block_goals as { id: string; description: string; order_index: number; achieved: boolean; achieved_at: string | null }[])
    .sort((a, b) => a.order_index - b.order_index)

  const phases = (block.training_block_phases as { id: string; phase_label: string; status: string; order_index: number }[])
    .sort((a, b) => a.order_index - b.order_index)

  const completedCount = phases.filter(p => p.status === 'archived').length

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link href="/programmes" className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{block.name}</h1>
          {peakLifts.length > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">Peaking: {peakLifts.join(', ')}</p>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-12 flex flex-col gap-8">

        <GoalsSection blockId={id} initialGoals={goals} />

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Phases
              {phases.length > 0 && (
                <span className="ml-2 normal-case tracking-normal font-normal text-zinc-600">
                  {completedCount}/{phases.length} done
                </span>
              )}
            </h2>
          </div>

          {phases.length > 0 && (
            <div className="flex gap-1 mb-4">
              {phases.map(phase => (
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
          )}

          <div className="flex flex-col gap-2">
            {phases.length === 0 ? (
              <p className="text-sm text-zinc-600 py-1">No phases yet.</p>
            ) : (
              phases.map(phase => (
                <Link
                  key={phase.id}
                  href={`/phases/${phase.id}`}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                    phase.status === 'active'
                      ? 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <p className={`text-sm font-medium ${phase.status === 'archived' ? 'text-zinc-500' : 'text-white'}`}>
                    {phase.phase_label}
                  </p>
                  <span className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOUR[phase.status] ?? ''}`}>
                    {STATUS_LABEL[phase.status] ?? phase.status}
                  </span>
                </Link>
              ))
            )}
          </div>

          <Link
            href={`/blocks/${id}/phases/new`}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors"
          >
            + Add phase
          </Link>
        </section>

      </main>
    </div>
  )
}
