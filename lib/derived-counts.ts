// Pure derived-count functions for the Training tab (and later Today/Logger). No database
// access here -- callers fetch the raw rows and pass them in. See CLAUDE.md's "Design handoff"
// section ("Derived counts") for the spec these implement.
//
// training_block_phases.duration_weeks (migration 013) is the only source of a phase's intended
// length. It is null for phases the importer/migration-013 backfill couldn't determine (see
// CLAUDE.md's schema comment on that column). Every function here is explicit about what
// happens when it's null: no "of N" is shown, nothing is guessed.

export type WorkoutProgress = {
  programmeId: string
  name: string
  orderIndex: number | null
  completedSessions: number
}

export type PhaseProgress = {
  id: string
  label: string
  orderIndex: number
  status: 'planned' | 'active' | 'archived'
  durationWeeks: number | null
  workouts: WorkoutProgress[]
}

// "Session x of N" for one workout within its phase. completedSessions is sessions already
// done; the session about to be started (or in progress) is completedSessions + 1.
export function sessionLabel(completedSessions: number, durationWeeks: number | null): string {
  const x = completedSessions + 1
  return durationWeeks === null ? `Session ${x}` : `Session ${x} of ${durationWeeks}`
}

// Sum across every workout in the phase. total is null when durationWeeks is unknown -- done
// can still be shown on its own ("6 sessions" rather than "6 of 12").
export function phaseSessionTotals(phase: PhaseProgress): { done: number; total: number | null } {
  const done = phase.workouts.reduce((sum, w) => sum + w.completedSessions, 0)
  const total = phase.durationWeeks === null ? null : phase.workouts.length * phase.durationWeeks
  return { done, total }
}

// A phase is only ever reported complete when durationWeeks is known and every workout has
// reached it -- an unknown durationWeeks never counts as complete, that would be a guess.
export function isPhaseComplete(phase: PhaseProgress): boolean {
  if (phase.durationWeeks === null || phase.workouts.length === 0) return false
  return phase.workouts.every(w => w.completedSessions >= phase.durationWeeks!)
}

export function isBlockReadyToFinish(phases: PhaseProgress[]): boolean {
  return phases.length > 0 && phases.every(isPhaseComplete)
}

// The workout furthest behind in the phase (fewest completed sessions), tie-broken by
// orderIndex (nulls sort last). Used for "Up next" / Today's suggestion (stage 2).
export function suggestedWorkout(phase: PhaseProgress): WorkoutProgress | null {
  if (phase.workouts.length === 0) return null
  return [...phase.workouts].sort((a, b) => {
    if (a.completedSessions !== b.completedSessions) return a.completedSessions - b.completedSessions
    return (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity)
  })[0]
}

// "Week W of weeks_total" for the logger header (stage 2+). Null if any phase before the
// current one has an unknown durationWeeks -- the sum can't be trusted if a term is missing.
export function blockWeek(
  phases: PhaseProgress[],
  currentPhaseOrderIndex: number,
  completedSessionsOfCurrentWorkoutInPhase: number
): number | null {
  const earlier = phases.filter(p => p.orderIndex < currentPhaseOrderIndex)
  if (earlier.some(p => p.durationWeeks === null)) return null
  const weeksBefore = earlier.reduce((sum, p) => sum + (p.durationWeeks ?? 0), 0)
  return weeksBefore + completedSessionsOfCurrentWorkoutInPhase + 1
}

// "Jun – Aug 2026 · 12 weeks" for a previous (archived) block. finished_at wins over the last
// completed session when present; the start is always the first completed session. Returns
// null when the block has no completed sessions at all -- the caller shows just the name and
// phase count in that case (per the Training tab spec), nothing is invented from created_at.
export function previousBlockDateLabel(
  finishedAt: string | null,
  firstSessionDate: string | null,
  lastSessionDate: string | null,
  weeksTotal: number | null
): string | null {
  if (!firstSessionDate) return null
  const end = finishedAt ?? lastSessionDate
  if (!end) return null

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  const startLabel = fmt(firstSessionDate)
  const endLabel = fmt(end)
  const range = startLabel === endLabel ? startLabel : `${startLabel.split(' ')[0]} – ${endLabel}`
  return weeksTotal != null ? `${range} · ${weeksTotal} weeks` : range
}
