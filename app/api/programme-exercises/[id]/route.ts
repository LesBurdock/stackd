import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS enforces ownership through the programmes join
  const { data: existing } = await supabase
    .from('programme_exercises')
    .select('id, programme_id, num_sets, load_scheme')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const {
    num_sets,
    target_reps_min,
    target_reps_max,
    target_rir,
    load_scheme,
    ramp_end_percent,
    rest_seconds,
    tempo,
    superset_group,
    superset_order,
    notes,
    order_index,
  } = body

  const updates: Record<string, unknown> = {}
  if (num_sets !== undefined) updates.num_sets = num_sets
  if (load_scheme !== undefined) updates.load_scheme = load_scheme
  if (ramp_end_percent !== undefined) updates.ramp_end_percent = ramp_end_percent
  if (rest_seconds !== undefined) updates.rest_seconds = rest_seconds
  if (tempo !== undefined) updates.tempo = tempo
  if (superset_group !== undefined) updates.superset_group = superset_group
  if (superset_order !== undefined) updates.superset_order = superset_order
  if (notes !== undefined) updates.notes = notes
  if (order_index !== undefined) updates.order_index = order_index

  const { error: updateErr } = await supabase
    .from('programme_exercises')
    .update(updates)
    .eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // If num_sets or load_scheme changed, regenerate programme_sets
  const newNumSets = num_sets ?? existing.num_sets
  const newLoadScheme = load_scheme ?? existing.load_scheme
  const setsChanged = num_sets !== undefined || load_scheme !== undefined || ramp_end_percent !== undefined

  if (setsChanged) {
    await supabase.from('programme_sets').delete().eq('programme_exercise_id', id)

    const reps_min = target_reps_min ?? 8
    const reps_max = target_reps_max ?? 12
    const rir = target_rir ?? null
    const rampPct = ramp_end_percent ?? 30

    const sets = []
    for (let i = 1; i <= newNumSets; i++) {
      if (newLoadScheme === 'ramp' && newNumSets > 1) {
        if (i === 1) {
          sets.push({ programme_exercise_id: id, set_number: i, set_type: 'working', load_type: 'absolute', target_reps_min: reps_min, target_reps_max: reps_max, target_rir: rir })
        } else {
          const pct = 100 + rampPct * (i - 1) / (newNumSets - 1)
          sets.push({ programme_exercise_id: id, set_number: i, set_type: 'working', load_type: 'percent_of_reference_set', reference_set_number: 1, load_percent: Math.round(pct), target_reps_min: reps_min, target_reps_max: reps_max, target_rir: rir })
        }
      } else {
        sets.push({ programme_exercise_id: id, set_number: i, set_type: 'working', load_type: 'absolute', target_reps_min: reps_min, target_reps_max: reps_max, target_rir: rir })
      }
    }
    const { error: setsErr } = await supabase.from('programme_sets').insert(sets)
    if (setsErr) return NextResponse.json({ error: setsErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('programme_exercises')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
