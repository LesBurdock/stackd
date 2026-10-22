import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chartLabel } from '@/lib/exercise-name'
import { sessionValue, filterPointsByRange, seriesStats, type Metric, type Range } from '@/lib/progress-metrics'

// group key = lower(trim(coalesce(group_name, name))) -- null group_name means the
// exercise is its own group.
function groupKey(name: string, groupName: string | null) {
  return (groupName ?? name).toLowerCase().trim()
}

const VALID_METRICS: Metric[] = ['e1rm', 'volume', 'weight', 'reps']
const VALID_RANGES: Range[] = ['4W', '12W', '6M', 'All']

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: exerciseId } = await params
  const { searchParams } = new URL(request.url)
  const metricParam = searchParams.get('metric') ?? 'e1rm'
  const scope = searchParams.get('scope') ?? 'group'
  const rangeParam = searchParams.get('range') ?? 'All'

  const metric: Metric = VALID_METRICS.includes(metricParam as Metric) ? (metricParam as Metric) : 'e1rm'
  const range: Range = VALID_RANGES.includes(rangeParam as Range) ? (rangeParam as Range) : 'All'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: selected } = await supabase
    .from('exercises')
    .select('id, name, group_name, variation')
    .eq('id', exerciseId)
    .single()

  if (!selected) return NextResponse.json({ series: [] })

  let groupExercises: Array<{ id: string; name: string; variation: string | null }>
  if (scope === 'exercise') {
    groupExercises = [{ id: selected.id, name: selected.name, variation: selected.variation }]
  } else {
    const key = groupKey(selected.name, selected.group_name)
    const { data: allExercises } = await supabase
      .from('exercises')
      .select('id, name, group_name, variation')
    groupExercises = (allExercises ?? [])
      .filter(ex => groupKey(ex.name, ex.group_name) === key)
      .map(ex => ({ id: ex.id, name: ex.name, variation: ex.variation }))
  }

  // Completed sessions for this user -- shared across every series in the group.
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })

  const sessionIds = (sessions ?? []).map(s => s.id)

  const series = []
  for (const ex of groupExercises) {
    const label = chartLabel(ex)
    if (sessionIds.length === 0) {
      series.push({ exercise_id: ex.id, name: ex.name, variation: ex.variation, label, points: [], best: null, latest: null, change: null, sessions: 0 })
      continue
    }

    const { data: seData } = await supabase
      .from('session_exercises')
      .select('id, workout_session_id')
      .eq('exercise_id', ex.id)
      .in('workout_session_id', sessionIds)

    if (!seData || seData.length === 0) {
      series.push({ exercise_id: ex.id, name: ex.name, variation: ex.variation, label, points: [], best: null, latest: null, change: null, sessions: 0 })
      continue
    }

    const seIds = seData.map(s => s.id)
    const seSessionMap = new Map(seData.map(se => [se.id, se.workout_session_id]))

    // NOTE: "not skipped" belongs here too (migration 008) -- not added yet, see this
    // file's header-level note in lib/progress-metrics.ts. Warm-ups ARE excluded now, via
    // the nested programme_sets.set_type (null for extras added on the day, which are
    // never warm-ups by definition).
    const { data: logs } = await supabase
      .from('logged_sets')
      .select('weight, reps, session_exercise_id, programme_sets(set_type)')
      .in('session_exercise_id', seIds)

    const bySession = new Map<string, Array<{ weight: number; reps: number; isWarmup: boolean }>>()
    for (const log of logs ?? []) {
      const sessionId = seSessionMap.get(log.session_exercise_id)
      if (!sessionId) continue
      const programmeSet = log.programme_sets as unknown as { set_type: string } | null
      if (!bySession.has(sessionId)) bySession.set(sessionId, [])
      bySession.get(sessionId)!.push({ weight: log.weight, reps: log.reps, isWarmup: programmeSet?.set_type === 'warmup' })
    }

    const allPoints = (sessions ?? [])
      .filter(s => bySession.has(s.id))
      .map(s => ({ session_id: s.id, date: s.completed_at!, value: sessionValue(bySession.get(s.id)!, metric) }))
      .filter((p): p is { session_id: string; date: string; value: number } => p.value !== null)

    const points = filterPointsByRange(allPoints, range)
    const stats = seriesStats(points)

    series.push({
      exercise_id: ex.id,
      name: ex.name,
      variation: ex.variation,
      label,
      points,
      best: stats?.best ?? null,
      latest: stats?.latest ?? null,
      change: stats?.change ?? null,
      sessions: stats?.sessions ?? 0,
    })
  }

  return NextResponse.json({ series })
}
