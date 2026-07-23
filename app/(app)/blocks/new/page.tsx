import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import NewBlockForm from './new-block-form'

export default async function NewBlockPage() {
  const supabase = await createClient()

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, category, equipment')
    .order('name')

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="flex items-center gap-3 px-4 pt-12 pb-6">
        <Link
          href="/programmes"
          className="p-1 -ml-1 text-zinc-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold">New training block</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-12">
        <NewBlockForm exercises={exercises ?? []} />
      </main>
    </div>
  )
}
