import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: phaseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: current } = await supabase
    .from('training_block_phases')
    .select('id, block_id, order_index, status')
    .eq('id', phaseId)
    .single()

  if (!current) return NextResponse.json({ error: 'Phase not found' }, { status: 404 })
  if (current.status !== 'active') return NextResponse.json({ error: 'Phase is not active' }, { status: 400 })

  const { data: next } = await supabase
    .from('training_block_phases')
    .select('id')
    .eq('block_id', current.block_id)
    .eq('status', 'planned')
    .gt('order_index', current.order_index)
    .order('order_index', { ascending: true })
    .limit(1)
    .single()

  if (!next) return NextResponse.json({ error: 'No planned phase to advance to' }, { status: 400 })

  const { error: archiveError } = await supabase
    .from('training_block_phases')
    .update({ status: 'archived' })
    .eq('id', current.id)

  if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 })

  const { error: activateError } = await supabase
    .from('training_block_phases')
    .update({ status: 'active' })
    .eq('id', next.id)

  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
