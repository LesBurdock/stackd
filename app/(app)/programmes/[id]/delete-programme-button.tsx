'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeleteProgrammeButton({
  programmeId,
  programmeName,
  redirectTo,
}: {
  programmeId: string
  programmeName: string
  redirectTo: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${programmeName}"? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('programmes').delete().eq('id', programmeId)
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="shrink-0 text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
