import BottomNav from '@/components/bottom-nav'

export default function ProgressPage() {
  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Progress</h1>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Coming soon</p>
      </main>
      <BottomNav />
    </div>
  )
}
