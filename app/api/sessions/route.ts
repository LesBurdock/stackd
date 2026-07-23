import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { programme_id } = await request.json()
  if (!programme_id) return NextResponse.json({ error: 'programme_id is required' }, { status: 400 })

  // Verify programme ownership via RLS
  const { data: programme } = await supabase
    .from('programmes')
    .select('id')
    .eq('id', programme_id)
    .single()
  if (!programme) return NextResponse.json({ error: 'Programme not found' }, { status: 404 })

  // Create the session
  const { data: session, error: sessionErr } = await supabase
    .from('workout_sessions')
    .insert({ user_id: user.id, programme_id, status: 'in_progress' })
    .select('id')
    .single()
  if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 })

  // Copy programme exercises into session exercises
  const { data: progExercises } = await supabase
    .from('programme_exercises')
    .select('id, exercise_id, order_index')
    .eq('programme_id', programme_id)
    .order('order_index', { ascending: true })

  if (progExercises && progExercises.length > 0) {
    const { error: seErr } = await supabase.from('session_exercises').insert(
      progExercises.map(pe => ({
        workout_session_id: session.id,
        programme_exercise_id: pe.id,
        exercise_id: pe.exercise_id,
        order_index: pe.order_index,
      }))
    )
    if (seErr) return NextResponse.json({ error: seErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: session.id }, { status: 201 })
}
