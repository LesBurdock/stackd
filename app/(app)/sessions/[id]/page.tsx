import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Logger from './logger'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('workout_sessions')
    .select('id, programme_id, status, programmes(id, name)')
    .eq('id', sessionId)
    .single()

  if (!session) notFound()
  if (session.status === 'completed' || session.status === 'abandoned') {
    redirect(`/programmes/${session.programme_id}`)
  }

  // Load session exercises with all needed data
  const { data: sessionExercises } = await supabase
    .from('session_exercises')
    .select(`
      id, order_index, exercise_id, programme_exercise_id,
      exercises(id, name, default_rest_seconds, rounding_increment),
      programme_exercises(
        id, num_sets, superset_group, superset_order, rest_seconds, notes, load_scheme,
        programme_sets(id, set_number, target_weight, target_reps_min, target_reps_max, target_rir, set_type, load_type, load_percent, reference_set_number)
      ),
      logged_sets(id, set_number, weight, reps, rir)
    `)
    .eq('workout_session_id', sessionId)
    .order('order_index', { ascending: true })

  // Load previous session's logs for reference
  const { data: prevSession } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('programme_id', session.programme_id)
    .eq('status', 'completed')
    .neq('id', sessionId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  let previousLogs: Record<string, Array<{ set_number: number; weight: number; reps: number; rir: number | null }>> = {}

  if (prevSession) {
    const { data: prevSEs } = await supabase
      .from('session_exercises')
      .select('exercise_id, logged_sets(set_number, weight, reps, rir)')
      .eq('workout_session_id', prevSession.id)

    if (prevSEs) {
      for (const se of prevSEs) {
        previousLogs[se.exercise_id] = (se.logged_sets as any[]) ?? []
      }
    }
  }

  const programme = session.programmes as unknown as { id: string; name: string }

  return (
    <Logger
      sessionId={sessionId}
      programmeId={session.programme_id}
      programmeName={programme.name}
      sessionExercises={(sessionExercises ?? []) as any}
      previousLogs={previousLogs}
    />
  )
}
