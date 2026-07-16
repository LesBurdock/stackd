import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: block } = await supabase
    .from('training_blocks')
    .select('id')
    .eq('id', blockId)
    .eq('user_id', user.id)
    .single()

  if (!block) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  }

  const body = await request.json()
  const name: string = body.name?.trim()
  const phaseLabel: string | null = body.phase_label?.trim() || null

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Find the current max block_order
  const { data: existing } = await supabase
    .from('programmes')
    .select('block_order')
    .eq('block_id', blockId)
    .order('block_order', { ascending: false })
    .limit(1)

  const isFirst = !existing || existing.length === 0
  const nextOrder = isFirst ? 0 : (existing[0].block_order ?? 0) + 1
  const status = isFirst ? 'active' : 'planned'

  const { data: programme, error } = await supabase
    .from('programmes')
    .insert({
      user_id: user.id,
      name,
      phase_label: phaseLabel,
      block_id: blockId,
      block_order: nextOrder,
      status,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: programme.id }, { status: 201 })
}
