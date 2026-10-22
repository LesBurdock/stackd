import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  return (
    <div className="h-dvh bg-background text-ink flex flex-col">
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
        className="w-full rounded-xl border border-divider bg-white px-4 py-3 text-left text-sm text-error hover:bg-tag-fill transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}
