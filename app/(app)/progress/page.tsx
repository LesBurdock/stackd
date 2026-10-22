import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/bottom-nav'
import ProgressClient from './progress-client'
import { sessionValue, defaultMetricForGroup, isPerHand, type Metric } from '@/lib/progress-metrics'

type RawExercise = { id: string; name: string; group_name: string | null; variation: string | null; category: string | null; equipment: string | null }

export type GroupExercise = { id: string; name: string; variation: string | null }
export type GroupEntry = {
  key: string
  label: string
  exercises: GroupExercise[]
  defaultMetric: Metric
  perHand: boolean
  sessionCount: number
  latestValue: number | null
}

function groupKey(ex: RawExercise) {
  return (ex.group_name ?? ex.name).toLowerCase().trim()
}

export default async function ProgressPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: exercisesRaw } = await supabase
    .from('exercises')
    .select('id, name, group_name, variation, category, equipment')
    .order('name', { ascending: true })

  const exercises = (exercisesRaw ?? []) as RawExercise[]

  const groups: GroupEntry[] = []

  if (user && exercises.length > 0) {
    const exerciseIds = exercises.map(e => e.id)

    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, completed_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true })

    const sessionIds = (sessions ?? []).map(s => s.id)
    const sessionDate = new Map((sessions ?? []).map(s => [s.id, s.completed_at!]))

    const { data: seData } = sessionIds.length > 0
      ? await supabase
          .from('session_exercises')
          .select('id, workout_session_id, exercise_id')
          .in('workout_session_id', sessionIds)
          .in('exercise_id', exerciseIds)
      : { data: [] }

    const seIds = (seData ?? []).map(se => se.id)
    const seMeta = new Map((seData ?? []).map(se => [se.id, { sessionId: se.workout_session_id, exerciseId: se.exercise_id }]))

    const { data: logs } = seIds.length > 0
      ? await supabase
          .from('logged_sets')
          .select('weight, reps, session_exercise_id, programme_sets(set_type)')
          .in('session_exercise_id', seIds)
      : { data: [] }

    // sets per (exerciseId, sessionId)
    const setsByExSession = new Map<string, Array<{ weight: number; reps: number; isWarmup: boolean }>>()
    for (const log of logs ?? []) {
      const meta = seMeta.get(log.session_exercise_id)
      if (!meta) continue
      const key = `${meta.exerciseId}::${meta.sessionId}`
      const programmeSet = log.programme_sets as unknown as { set_type: string } | null
      if (!setsByExSession.has(key)) setsByExSession.set(key, [])
      setsByExSession.get(key)!.push({ weight: log.weight, reps: log.reps, isWarmup: programmeSet?.set_type === 'warmup' })
    }

    // Which exercises have ever been prescribed as duration-based (timed holds like Plank) --
    // used to keep them off the Reps default even though they're Bodyweight equipment.
    const { data: prescriptions } = await supabase
      .from('programme_exercises')
      .select('exercise_id, prescription_type')
      .in('exercise_id', exerciseIds)
    const timedExerciseIds = new Set((prescriptions ?? []).filter(p => p.prescription_type === 'duration').map(p => p.exercise_id))

    const byKey = new Map<string, RawExercise[]>()
    for (const ex of exercises) {
      const key = groupKey(ex)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(ex)
    }

    for (const [key, groupExercises] of byKey) {
      const anyTimed = groupExercises.some(ex => timedExerciseIds.has(ex.id))
      const defaultMetric = defaultMetricForGroup(groupExercises, anyTimed)
      const perHand = isPerHand(groupExercises)

      // Latest session across every exercise in the group, and a count of distinct
      // sessions touching any of them.
      const sessionValues = new Map<string, number>() // sessionId -> value (last exercise wins on a rare same-day collision)
      for (const ex of groupExercises) {
        for (const sid of sessionIds) {
          const sets = setsByExSession.get(`${ex.id}::${sid}`)
          if (!sets) continue
          const value = sessionValue(sets, defaultMetric)
          if (value !== null) sessionValues.set(sid, value)
        }
      }

      if (sessionValues.size === 0) continue // not logged yet -- don't show in the picker

      const latestSessionId = [...sessionValues.keys()].sort((a, b) =>
        (sessionDate.get(a) ?? '').localeCompare(sessionDate.get(b) ?? '')
      ).pop()!

      groups.push({
        key,
        label: groupExercises[0].group_name ?? groupExercises[0].name,
        exercises: groupExercises.map(e => ({ id: e.id, name: e.name, variation: e.variation })),
        defaultMetric,
        perHand,
        sessionCount: sessionValues.size,
        latestValue: sessionValues.get(latestSessionId) ?? null,
      })
    }

    groups.sort((a, b) => a.label.localeCompare(b.label))
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <header className="px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Progress</h1>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto px-4 pb-28">
        <ProgressClient groups={groups} />
      </main>
      <BottomNav />
    </div>
  )
}
