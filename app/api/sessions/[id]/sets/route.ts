import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify session ownership
  const { data: session } = await supabase
    .from('workout_sessions')
    .select('id, programme_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { session_exercise_id, programme_set_id, set_number, weight, reps, rir } = await request.json()

  const { data: logged, error } = await supabase
    .from('logged_sets')
    .insert({ session_exercise_id, programme_set_id: programme_set_id ?? null, set_number, weight, reps, rir: rir ?? null })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute suggested weight for the next ramp set if applicable
  let next_suggestion: number | null = null
  if (programme_set_id) {
    const { data: currentPSet } = await supabase
      .from('programme_sets')
      .select('programme_exercise_id, set_number')
      .eq('id', programme_set_id)
      .single()

    if (currentPSet) {
      const { data: nextPSet } = await supabase
        .from('programme_sets')
        .select('load_type, load_percent, reference_set_number')
        .eq('programme_exercise_id', currentPSet.programme_exercise_id)
        .eq('set_number', currentPSet.set_number + 1)
        .single()

      if (nextPSet?.load_type === 'percent_of_reference_set' && nextPSet.load_percent && nextPSet.reference_set_number) {
        // Get the reference set's logged weight from this session
        const { data: seData } = await supabase
          .from('session_exercises')
          .select('id')
          .eq('workout_session_id', sessionId)
          .eq('programme_exercise_id', currentPSet.programme_exercise_id)
          .single()

        if (seData) {
          const { data: refLog } = await supabase
            .from('logged_sets')
            .select('weight')
            .eq('session_exercise_id', seData.id)
            .eq('set_number', nextPSet.reference_set_number)
            .single()

          if (refLog) {
            // Get rounding_increment from exercise
            const { data: exData } = await supabase
              .from('session_exercises')
              .select('exercises(rounding_increment)')
              .eq('id', seData.id)
              .single()

            const increment = (exData?.exercises as any)?.rounding_increment ?? 2.5
            const raw = refLog.weight * (nextPSet.load_percent / 100)
            next_suggestion = Math.round(raw / increment) * increment
          }
        }
      }
    }
  }

  return NextResponse.json({ id: logged.id, next_suggestion }, { status: 201 })
}
