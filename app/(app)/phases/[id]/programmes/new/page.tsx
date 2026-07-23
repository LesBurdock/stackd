import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NewProgrammeForm from './new-programme-form'

export default async function NewProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: phaseId } = await params
  const supabase = await createClient()

  const { data: phase } = await supabase
    .from('training_block_phases')
    .select('id, phase_label, block_id')
    .eq('id', phaseId)
    .single()

  if (!phase) notFound()

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link href={`/phases/${phaseId}`} className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-semibold">Add programme</h1>
          <p className="text-xs text-zinc-500">{phase.phase_label}</p>
        </div>
      </header>
      <main className="flex-1 px-4 pb-12">
        <NewProgrammeForm phaseId={phaseId} blockId={phase.block_id} />
      </main>
    </div>
  )
}
