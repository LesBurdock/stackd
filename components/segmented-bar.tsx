// One segment per expected session: done = ink, the next one up (the session about to
// happen) = orange, the rest = faint divider. Used anywhere a "Session x of N" count needs a
// visual alongside it (Today, later Phase detail).
export default function SegmentedBar({ total, done }: { total: number; done: number }) {
  return (
    <div className="flex gap-1 flex-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < done ? 'bg-ink' : i === done ? 'bg-action' : 'bg-divider'}`}
        />
      ))}
    </div>
  )
}
