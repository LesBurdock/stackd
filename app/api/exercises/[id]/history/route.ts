import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function epley(weight: number, reps: number) {
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: exerciseId } = await params
  const { searchParams } = new URL(request.url)
  const metric = searchParams.get('metric') ?? '1rm'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all completed sessions for this user
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })

  if (!sessions || sessions.length === 0) return NextResponse.json([])

  const sessionIds = sessions.map(s => s.id)
  const sessionDateMap: Record<string, string> = {}
  for (const s of sessions) sessionDateMap[s.id] = s.completed_at!

  // Get session_exercises for this exercise in those sessions
  const { data: seData } = await supabase
    .from('session_exercises')
    .select('id, workout_session_id')
    .eq('exercise_id', exerciseId)
    .in('workout_session_id', sessionIds)

  if (!seData || seData.length === 0) return NextResponse.json([])

  const seIds = seData.map(s => s.id)
  const seSessionMap: Record<string, string> = {}
  for (const se of seData) seSessionMap[se.id] = se.workout_session_id

  // Get all logged sets for those session exercises
  const { data: logs } = await supabase
    .from('logged_sets')
    .select('weight, reps, session_exercise_id')
    .in('session_exercise_id', seIds)

  if (!logs || logs.length === 0) return NextResponse.json([])

  // Group logs by session
  const bySession: Record<string, Array<{ weight: number; reps: number }>> = {}
  for (const log of logs) {
    const sessionId = seSessionMap[log.session_exercise_id]
    if (!sessionId) continue
    if (!bySession[sessionId]) bySession[sessionId] = []
    bySession[sessionId].push({ weight: log.weight, reps: log.reps })
  }

  // Compute metric per session, ordered by date
  const result = sessions
    .filter(s => bySession[s.id])
    .map(s => {
      const sets = bySession[s.id]
      let value: number

      if (metric === '1rm') {
        value = Math.max(...sets.map(set => epley(set.weight, set.reps)))
        value = Math.round(value * 10) / 10
      } else if (metric === 'volume') {
        value = sets.reduce((sum, set) => sum + set.weight * set.reps, 0)
        value = Math.round(value)
      } else {
        // max_weight
        value = Math.max(...sets.map(set => set.weight))
      }

      return {
        session_id: s.id,
        date: s.completed_at,
        value,
      }
    })

  return NextResponse.json(result)
}
