'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeletePhaseButton({
  phaseId,
  phaseLabel,
  blockId,
  programmeCount,
}: {
  phaseId: string
  phaseLabel: string
  blockId: string
  programmeCount: number
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const programmeLine = programmeCount > 0
      ? `\n\nThis will also permanently delete the ${programmeCount} programme${programmeCount === 1 ? '' : 's'} inside it and all their exercises.`
      : ''
    if (!confirm(`Delete phase "${phaseLabel}"?${programmeLine}\n\nThis cannot be undone.`)) return

    setDeleting(true)
    const supabase = createClient()

    // Delete programmes first (cascade handles exercises/sets), then the phase
    await supabase.from('programmes').delete().eq('phase_id', phaseId)
    await supabase.from('training_block_phases').delete().eq('id', phaseId)

    router.push(`/blocks/${blockId}`)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="shrink-0 text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40"
    >
      {deleting ? 'Deleting…' : 'Delete phase'}
    </button>
  )
}
