import { createClient } from '@/lib/supabase/server'
import ExercisePicker from './exercise-picker'

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ addTo?: string }>
}) {
  const { addTo } = await searchParams
  const supabase = await createClient()

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, category, equipment, is_custom')
    .order('name', { ascending: true })

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4">
        {addTo ? (
          <a
            href={`/programmes/${addTo}/edit`}
            className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </a>
        ) : null}
        <h1 className="text-lg font-semibold">{addTo ? 'Add exercise' : 'Exercises'}</h1>
      </header>
      <ExercisePicker exercises={exercises ?? []} programmeId={addTo} />
    </div>
  )
}
