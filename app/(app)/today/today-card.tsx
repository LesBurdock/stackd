'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/card'
import Button from '@/components/button'
import TagPill from '@/components/tag-pill'
import SegmentedBar from '@/components/segmented-bar'
import { sessionLabel, blockWeek, type PhaseProgress, type WorkoutProgress } from '@/lib/derived-counts'

export default function TodayCard({
  allPhases,
  activePhase,
  weeksTotal,
  lastCompletedWorkoutName,
}: {
  allPhases: PhaseProgress[]
  activePhase: PhaseProgress
  weeksTotal: number | null
  lastCompletedWorkoutName: string | null
}) {
  const router = useRouter()
  const suggested = [...activePhase.workouts].sort((a, b) => {
    if (a.completedSessions !== b.completedSessions) return a.completedSessions - b.completedSessions
    return (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity)
  })[0]

  const [pickedId, setPickedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const displayed: WorkoutProgress = activePhase.workouts.find(w => w.programmeId === pickedId) ?? suggested
  const isPick = pickedId !== null && pickedId !== suggested.programmeId

  const total = activePhase.durationWeeks
  const week = blockWeek(allPhases, activePhase.orderIndex, displayed.completedSessions)

  async function handleStart() {
    setStarting(true)
    setStartError(null)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programme_id: displayed.programmeId }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/sessions/${data.id}`)
      return
    }
    setStarting(false)
    setStartError(data.error ?? 'Failed to start this workout.')
  }

  function choose(id: string) {
    setPickedId(id)
    setSheetOpen(false)
  }

  return (
    <Card className="p-4">
      <TagPill highlight>
        {isPick
          ? `Your pick · ${suggested.name} suggested`
          : lastCompletedWorkoutName
            ? `Up next · after ${lastCompletedWorkoutName}`
            : 'Up next'}
      </TagPill>

      <h2 className="mt-3 text-3xl font-bold text-ink leading-tight">{displayed.name}</h2>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-sm font-semibold text-ink shrink-0">
          {sessionLabel(displayed.completedSessions, activePhase.durationWeeks)}
        </span>
        {total !== null && <SegmentedBar total={total} done={displayed.completedSessions} />}
      </div>

      <p className="mt-1 text-sm text-muted">
        {activePhase.label}
        {week !== null && weeksTotal !== null && ` · Week ${week} of ${weeksTotal}`}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" className="w-full" onClick={handleStart} disabled={starting}>
          {starting ? 'Starting…' : 'Start workout'}
        </Button>
        {startError && <p className="text-xs text-error text-center">{startError}</p>}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="text-sm text-muted hover:text-ink transition-colors text-center"
        >
          Change workout
        </button>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-white px-5 pt-3"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Change workout</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="text-sm text-muted hover:text-ink transition-colors">
                Cancel
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">{activePhase.label} · pick what you&apos;re doing today</p>

            <div className="mt-4 flex flex-col">
              {activePhase.workouts.map(w => {
                const isSuggested = w.programmeId === suggested.programmeId
                const isSelected = w.programmeId === (pickedId ?? suggested.programmeId)
                return (
                  <button
                    key={w.programmeId}
                    type="button"
                    onClick={() => choose(w.programmeId)}
                    className="flex items-center justify-between gap-3 py-3 border-b border-divider last:border-0 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink truncate">{w.name}</span>
                        {isSuggested && <TagPill>Suggested</TagPill>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 w-40">
                        {activePhase.durationWeeks !== null ? (
                          <SegmentedBar total={activePhase.durationWeeks} done={w.completedSessions} />
                        ) : (
                          <span className="text-xs text-muted">{w.completedSessions} sessions done</span>
                        )}
                      </div>
                      {activePhase.durationWeeks !== null && (
                        <p className="mt-1 text-xs text-muted">{w.completedSessions} of {activePhase.durationWeeks} sessions done</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 flex items-center justify-center size-6 rounded-full ${
                        isSelected ? 'bg-action text-ink' : 'border-2 border-border'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              The suggestion is just a nudge. After today it moves to whichever workout is furthest behind.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
