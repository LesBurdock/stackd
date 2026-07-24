import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/bottom-nav'
import ProgressClient from './progress-client'

export default async function ProgressPage() {
  const supabase = await createClient()

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, category')
    .order('name', { ascending: true })

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Progress</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-28">
        <ProgressClient exercises={exercises ?? []} />
      </main>
      <BottomNav />
    </div>
  )
}
