// Pure helpers shared by the Progress history route and the picker query. No DB access --
// callers fetch logged_sets (+ each set's programme_sets.set_type, to exclude warm-ups) and
// pass plain arrays in. See CLAUDE.md's Design handoff "Progress" paragraph for the spec.
//
// NOTE: skipped sets (migration 008, logged_sets.skipped) should also be excluded here once
// that column exists anywhere -- it doesn't yet (neither stackd-test nor production), so
// there is deliberately no "not skipped" filter below. Add it alongside the warm-up filter
// wherever sets are fetched, the moment 008 ships.

export type Metric = 'e1rm' | 'volume' | 'weight' | 'reps'
export type Range = '4W' | '12W' | '6M' | 'All'

export type RawSet = { weight: number; reps: number; isWarmup: boolean }

function epley(weight: number, reps: number) {
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

// One value per session for the given metric, from that session's non-warmup sets.
export function sessionValue(sets: RawSet[], metric: Metric): number | null {
  const working = sets.filter(s => !s.isWarmup)
  if (working.length === 0) return null
  switch (metric) {
    case 'e1rm':
      return Math.round(Math.max(...working.map(s => epley(s.weight, s.reps))) * 10) / 10
    case 'volume':
      return Math.round(working.reduce((sum, s) => sum + s.weight * s.reps, 0))
    case 'weight':
      return Math.max(...working.map(s => s.weight))
    case 'reps':
      return Math.max(...working.map(s => s.reps))
  }
}

const RANGE_DAYS: Record<Exclude<Range, 'All'>, number> = { '4W': 28, '12W': 84, '6M': 182 }

export function rangeStartDate(range: Range, now = new Date()): Date | null {
  if (range === 'All') return null
  const d = new Date(now)
  d.setDate(d.getDate() - RANGE_DAYS[range])
  return d
}

export function filterPointsByRange<T extends { date: string }>(points: T[], range: Range): T[] {
  const start = rangeStartDate(range)
  if (!start) return points
  return points.filter(p => new Date(p.date) >= start)
}

export function seriesStats(points: { value: number }[]) {
  if (points.length === 0) return null
  const values = points.map(p => p.value)
  return {
    best: Math.max(...values),
    latest: values[values.length - 1],
    change: values[values.length - 1] - values[0],
    sessions: points.length,
  }
}

// A group defaults to Reps only if every exercise in it is Bodyweight equipment AND none of
// them have ever been prescribed as duration-based (a timed hold like Plank has no
// meaningful "reps" even though it's also Bodyweight -- it falls back to e1RM like anything
// else, per the design handoff: "timed exercises... are never defaulted to Reps").
export function defaultMetricForGroup(exercises: { equipment: string | null }[], anyTimed: boolean): Metric {
  if (anyTimed) return 'e1rm'
  const allBodyweight = exercises.length > 0 && exercises.every(e => e.equipment === 'Bodyweight')
  return allBodyweight ? 'reps' : 'e1rm'
}

export function isPerHand(exercises: { equipment: string | null }[]): boolean {
  return exercises.length > 0 && exercises.every(e => e.equipment === 'Dumbbell')
}
