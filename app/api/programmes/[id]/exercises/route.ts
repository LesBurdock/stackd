import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: programmeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership via RLS
  const { data: programme } = await supabase
    .from('programmes')
    .select('id')
    .eq('id', programmeId)
    .single()
  if (!programme) return NextResponse.json({ error: 'Programme not found' }, { status: 404 })

  const body = await request.json()
  const {
    exercise_id,
    num_sets = 3,
    target_reps_min = 8,
    target_reps_max = 12,
    target_rir = null,
    load_scheme = 'equal',
    ramp_end_percent = 30,
    rest_seconds = null,
    tempo = null,
    superset_group = null,
    superset_order = null,
    notes = null,
  } = body

  if (!exercise_id) return NextResponse.json({ error: 'exercise_id is required' }, { status: 400 })

  // Auto-assign order_index as max + 1
  const { data: existing } = await supabase
    .from('programme_exercises')
    .select('order_index')
    .eq('programme_id', programmeId)
    .order('order_index', { ascending: false })
    .limit(1)
  const order_index = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

  const { data: ex, error: exErr } = await supabase
    .from('programme_exercises')
    .insert({
      programme_id: programmeId,
      exercise_id,
      order_index,
      num_sets,
      load_scheme,
      ramp_end_percent: load_scheme === 'ramp' ? ramp_end_percent : null,
      rest_seconds,
      tempo,
      superset_group,
      superset_order,
      notes,
    })
    .select('id')
    .single()

  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  // Generate programme_sets rows
  const sets = []
  for (let i = 1; i <= num_sets; i++) {
    if (load_scheme === 'ramp' && num_sets > 1) {
      if (i === 1) {
        sets.push({
          programme_exercise_id: ex.id,
          set_number: i,
          set_type: 'working',
          load_type: 'absolute',
          target_reps_min,
          target_reps_max,
          target_rir,
        })
      } else {
        // Linear ramp: set 1 = 100%, set N = 100 + ramp_end_percent%
        const pct = 100 + ramp_end_percent * (i - 1) / (num_sets - 1)
        sets.push({
          programme_exercise_id: ex.id,
          set_number: i,
          set_type: 'working',
          load_type: 'percent_of_reference_set',
          reference_set_number: 1,
          load_percent: Math.round(pct),
          target_reps_min,
          target_reps_max,
          target_rir,
        })
      }
    } else {
      sets.push({
        programme_exercise_id: ex.id,
        set_number: i,
        set_type: 'working',
        load_type: 'absolute',
        target_reps_min,
        target_reps_max,
        target_rir,
      })
    }
  }

  const { error: setsErr } = await supabase.from('programme_sets').insert(sets)
  if (setsErr) return NextResponse.json({ error: setsErr.message }, { status: 500 })

  return NextResponse.json({ id: ex.id }, { status: 201 })
}
