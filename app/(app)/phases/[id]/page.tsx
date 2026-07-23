import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AdvancePhaseButton from './advance-phase-button'

const STATUS_LABEL: Record<string, string> = { active: 'Active', planned: 'Planned', archived: 'Done' }
const STATUS_COLOUR: Record<string, string> = {
  active: 'text-blue-400 bg-blue-400/10',
  planned: 'text-zinc-400 bg-zinc-800',
  archived: 'text-indigo-400 bg-indigo-400/10',
}

export default async function PhaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: phaseId } = await params
  const supabase = await createClient()

  const { data: phase } = await supabase
    .from('training_block_phases')
    .select(`
      id, phase_label, status, order_index, block_id,
      training_blocks(id, name)
    `)
    .eq('id', phaseId)
    .single()

  if (!phase) notFound()

  const { data: programmes } = await supabase
    .from('programmes')
    .select('id, name, status')
    .eq('phase_id', phaseId)
    .order('created_at', { ascending: true })

  // Check if there's a next planned phase to advance to
  const { data: nextPhase } = await supabase
    .from('training_block_phases')
    .select('id')
    .eq('block_id', phase.block_id)
    .eq('status', 'planned')
    .gt('order_index', phase.order_index)
    .order('order_index', { ascending: true })
    .limit(1)
    .single()

  const block = phase.training_blocks as unknown as { id: string; name: string } | null
  const canAdvance = phase.status === 'active' && !!nextPhase

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link
          href={`/blocks/${phase.block_id}`}
          className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {block && <p className="text-xs text-zinc-500 mb-0.5">{block.name}</p>}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{phase.phase_label}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOUR[phase.status] ?? ''}`}>
              {STATUS_LABEL[phase.status] ?? phase.status}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-12 flex flex-col gap-6">

        {/* Programmes list */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Programmes</h2>

          <div className="flex flex-col gap-2">
            {(!programmes || programmes.length === 0) ? (
              <p className="text-sm text-zinc-600 py-1">No programmes yet.</p>
            ) : (
              programmes.map(p => (
                <Link
                  key={p.id}
                  href={`/programmes/${p.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700 transition-colors"
                >
                  <span className="text-sm font-medium text-white">{p.name}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-zinc-600">
                    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </Link>
              ))
            )}
          </div>

          <Link
            href={`/phases/${phaseId}/programmes/new`}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors"
          >
            + Add programme
          </Link>
        </section>

        {/* Advance phase */}
        {canAdvance && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm font-medium text-white mb-1">Finished this phase?</p>
            <p className="text-xs text-zinc-500 mb-3">
              This will archive all programmes in this phase and activate the next one.
            </p>
            <AdvancePhaseButton phaseId={phaseId} blockId={phase.block_id} />
          </section>
        )}

      </main>
    </div>
  )
}
