import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: block } = await supabase
    .from('training_blocks')
    .select('id')
    .eq('id', blockId)
    .eq('user_id', user.id)
    .single()

  if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 })

  const body = await request.json()
  const phaseLabel: string = body.phase_label?.trim()

  if (!phaseLabel) return NextResponse.json({ error: 'Phase label is required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('training_block_phases')
    .select('order_index')
    .eq('block_id', blockId)
    .order('order_index', { ascending: false })
    .limit(1)

  const isFirst = !existing || existing.length === 0
  const nextOrder = isFirst ? 0 : (existing[0].order_index ?? 0) + 1
  const status = isFirst ? 'active' : 'planned'

  const { data: phase, error } = await supabase
    .from('training_block_phases')
    .insert({ block_id: blockId, phase_label: phaseLabel, order_index: nextOrder, status })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: phase.id }, { status: 201 })
}
