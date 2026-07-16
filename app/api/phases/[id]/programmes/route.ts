import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: phaseId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS on training_block_phases will reject if user doesn't own the block
  const { data: phase } = await supabase
    .from('training_block_phases')
    .select('id')
    .eq('id', phaseId)
    .single()

  if (!phase) return NextResponse.json({ error: 'Phase not found' }, { status: 404 })

  const body = await request.json()
  const name: string = body.name?.trim()

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: programme, error } = await supabase
    .from('programmes')
    .insert({ user_id: user.id, name, phase_id: phaseId, status: 'active' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: programme.id }, { status: 201 })
}
