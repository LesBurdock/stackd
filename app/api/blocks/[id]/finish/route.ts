import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Also used for "Finish training block early" -- same route, same rules, regardless of how
// many phases are actually done.
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
  if (block.status !== 'active') {
    return NextResponse.json({ error: 'Only an active block can be finished' }, { status: 409 })
  }

  const { data: phases } = await supabase
    .from('training_block_phases')
    .select('id')
    .eq('block_id', blockId)

  const phaseIds = (phases ?? []).map(p => p.id)

  if (phaseIds.length > 0) {
    const { data: programmes } = await supabase
      .from('programmes')
      .select('id')
      .in('phase_id', phaseIds)
    const programmeIds = (programmes ?? []).map(p => p.id)

    if (programmeIds.length > 0) {
      const { count } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .in('programme_id', programmeIds)
        .eq('status', 'in_progress')

      if (count && count > 0) {
        return NextResponse.json({ error: 'Finish or abandon the session first' }, { status: 409 })
      }
    }
  }

  const { data: updated, error } = await supabase
    .from('training_blocks')
    .update({ status: 'archived', finished_at: new Date().toISOString() })
    .eq('id', blockId)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: error?.message ?? 'Failed to finish block' }, { status: 500 })
  }

  if (phaseIds.length > 0) {
    await supabase.from('training_block_phases').update({ status: 'archived' }).in('id', phaseIds)
  }

  return NextResponse.json(updated)
}
