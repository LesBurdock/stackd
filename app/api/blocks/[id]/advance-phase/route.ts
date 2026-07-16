import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: blockId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the block belongs to this user
  const { data: block } = await supabase
    .from('training_blocks')
    .select('id')
    .eq('id', blockId)
    .eq('user_id', user.id)
    .single()

  if (!block) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  }

  // Get all phases ordered
  const { data: phases } = await supabase
    .from('programmes')
    .select('id, status, block_order')
    .eq('block_id', blockId)
    .order('block_order', { ascending: true })

  if (!phases) {
    return NextResponse.json({ error: 'No phases found' }, { status: 400 })
  }

  const activePhase = phases.find(p => p.status === 'active')
  if (!activePhase) {
    return NextResponse.json({ error: 'No active phase to advance from' }, { status: 400 })
  }

  const nextPhase = phases.find(
    p => p.status === 'planned' && (p.block_order ?? 0) > (activePhase.block_order ?? 0)
  )
  if (!nextPhase) {
    return NextResponse.json({ error: 'No planned phase to advance to' }, { status: 400 })
  }

  // Archive active, activate next — two updates (no transaction needed for a personal app)
  const { error: archiveError } = await supabase
    .from('programmes')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', activePhase.id)

  if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 })
  }

  const { error: activateError } = await supabase
    .from('programmes')
    .update({ status: 'active' })
    .eq('id', nextPhase.id)

  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
