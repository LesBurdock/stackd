import BottomNav from '@/components/bottom-nav'

// Placeholder for stage 2's content -- this step only wires up the tab and landing route.
export default function TodayPage() {
  return (
    <div className="h-dvh bg-background text-ink flex flex-col">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Today</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-28" />
      <BottomNav />
    </div>
  )
}
