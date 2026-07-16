import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
      </header>
      <main className="px-4">
        <SignOutButton />
      </main>
    </div>
  )
}

function SignOutButton() {
  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-red-400 hover:bg-zinc-800 transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}
