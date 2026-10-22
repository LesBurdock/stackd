import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: block } = await supabase
    .from('training_blocks')
    .select('id, status')
    .eq('id', blockId)
    .single()

  if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  if (block.status !== 'planned') {
    return NextResponse.json({ error: 'Only a block in "Up next" can be started' }, { status: 409 })
  }

  const { data: activeBlock } = await supabase
    .from('training_blocks')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (activeBlock) {
    return NextResponse.json({ error: `Finish "${activeBlock.name}" first` }, { status: 409 })
  }

  const { data: firstPhase } = await supabase
    .from('training_block_phases')
    .select('id')
    .eq('block_id', blockId)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: updated, error } = await supabase
    .from('training_blocks')
    .update({ status: 'active' })
    .eq('id', blockId)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Failed to start block' }, { status: 500 })
  }

  if (firstPhase) {
    await supabase.from('training_block_phases').update({ status: 'active' }).eq('id', firstPhase.id)
  }

  return NextResponse.json(updated)
}
