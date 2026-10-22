import Link from 'next/link'

// Shared by the Training tab's first-time state and Today's "no blocks at all" state.
export default function EmptyTrainingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">No training block yet</p>
      <h2 className="text-2xl font-bold text-ink leading-tight">Import your first<br />training block</h2>
      <p className="text-sm text-muted max-w-xs">
        Training blocks are built outside Stackd and arrive as a file. Import one and the whole block is created at once: phases, workouts and every set.
      </p>
      <Link href="/import" className="w-full max-w-xs">
        <span className="block w-full rounded-[var(--radius-control)] bg-action px-6 py-3.5 text-sm font-semibold text-ink text-center hover:brightness-95 transition-[filter]">
          Choose training block file
        </span>
      </Link>
      <Link href="/blocks/new" className="text-sm text-muted hover:text-ink transition-colors underline">
        Build a training block manually
      </Link>
    </div>
  )
}
