import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const name: string = body.name?.trim()
  const peakLiftIds: string[] = body.peak_lift_exercise_ids ?? []

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data: block, error: blockError } = await supabase
    .from('training_blocks')
    .insert({ user_id: user.id, name })
    .select('id')
    .single()

  if (blockError) {
    return NextResponse.json({ error: blockError.message }, { status: 500 })
  }

  if (peakLiftIds.length > 0) {
    const rows = peakLiftIds.map((exercise_id, index) => ({
      block_id: block.id,
      exercise_id,
      order_index: index,
    }))
    const { error: liftsError } = await supabase
      .from('training_block_peak_lifts')
      .insert(rows)

    if (liftsError) {
      return NextResponse.json({ error: liftsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: block.id }, { status: 201 })
}
