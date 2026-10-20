import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ExerciseList from './exercise-list'

export default async function ProgrammeEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ expanded?: string }>
}) {
  const { id } = await params
  const { expanded } = await searchParams
  const supabase = await createClient()

  const { data: programme } = await supabase
    .from('programmes')
    .select(`
      id, name, phase_id,
      programme_exercises(
        id, order_index, num_sets, superset_group, superset_order,
        tempo, rest_seconds, notes, load_scheme, ramp_end_percent,
        exercises(id, name, default_rest_seconds),
        programme_sets(id, set_number, target_reps_min, target_reps_max, target_rir, set_type, load_type, load_percent)
      )
    `)
    .eq('id', id)
    .single()

  if (!programme) notFound()

  const exercises = [...(programme.programme_exercises as any[])].sort(
    (a, b) => a.order_index - b.order_index
  )

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link
          href={`/programmes/${id}`}
          className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold truncate">{programme.name}</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
        <ExerciseList programmeId={id} initialExercises={exercises} expandedId={expanded} />

        <Link
          href={`/exercises?addTo=${id}`}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-700 px-4 py-4 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors"
        >
          + Add exercise
        </Link>
      </main>
    </div>
  )
}
