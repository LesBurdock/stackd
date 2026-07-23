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
  if (!['active', 'archived'].includes(current.status)) {
    return NextResponse.json({ error: 'Phase must be active or archived to advance' }, { status: 400 })
  }

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

  // Ensure current phase is archived (may already be if toggled manually)
  await supabase.from('training_block_phases').update({ status: 'archived' }).eq('id', current.id)

  const { error: activateError } = await supabase
    .from('training_block_phases')
    .update({ status: 'active' })
    .eq('id', next.id)

  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
