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
      className="shrink-0 text-xs text-error hover:brightness-110 disabled:opacity-50 transition-[filter] px-3 py-1.5 rounded-lg border border-error/30 hover:border-error/50"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
