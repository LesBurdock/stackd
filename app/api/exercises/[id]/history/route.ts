import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chartLabel } from '@/lib/exercise-name'

function epley(weight: number, reps: number) {
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

// group key = lower(trim(coalesce(group_name, name))) -- null group_name means the
// exercise is its own group.
function groupKey(name: string, groupName: string | null) {
  return (groupName ?? name).toLowerCase().trim()
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: exerciseId } = await params
  const { searchParams } = new URL(request.url)
  const metric = searchParams.get('metric') ?? '1rm'
  const scope = searchParams.get('scope') ?? 'group'

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
      series.push({ exercise_id: ex.id, name: ex.name, variation: ex.variation, label, points: [] })
      continue
    }

    const { data: seData } = await supabase
      .from('session_exercises')
      .select('id, workout_session_id')
      .eq('exercise_id', ex.id)
      .in('workout_session_id', sessionIds)

    if (!seData || seData.length === 0) {
      series.push({ exercise_id: ex.id, name: ex.name, variation: ex.variation, label, points: [] })
      continue
    }

    const seIds = seData.map(s => s.id)
    const seSessionMap = new Map(seData.map(se => [se.id, se.workout_session_id]))

    const { data: logs } = await supabase
      .from('logged_sets')
      .select('weight, reps, session_exercise_id')
      .in('session_exercise_id', seIds)

    const bySession = new Map<string, Array<{ weight: number; reps: number }>>()
    for (const log of logs ?? []) {
      const sessionId = seSessionMap.get(log.session_exercise_id)
      if (!sessionId) continue
      if (!bySession.has(sessionId)) bySession.set(sessionId, [])
      bySession.get(sessionId)!.push({ weight: log.weight, reps: log.reps })
    }

    const points = (sessions ?? [])
      .filter(s => bySession.has(s.id))
      .map(s => {
        const sets = bySession.get(s.id)!
        let value: number
        if (metric === '1rm') {
          value = Math.max(...sets.map(set => epley(set.weight, set.reps)))
          value = Math.round(value * 10) / 10
        } else if (metric === 'volume') {
          value = sets.reduce((sum, set) => sum + set.weight * set.reps, 0)
          value = Math.round(value)
        } else {
          value = Math.max(...sets.map(set => set.weight))
        }
        return { session_id: s.id, date: s.completed_at!, value }
      })

    series.push({ exercise_id: ex.id, name: ex.name, variation: ex.variation, label, points })
  }

  return NextResponse.json({ series })
}
