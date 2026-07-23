'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUSES = ['planned', 'active', 'archived'] as const
type Status = typeof STATUSES[number]

const LABEL: Record<Status, string> = { planned: 'Planned', active: 'Active', archived: 'Done' }

export default function PhaseStatusToggle({
  phaseId,
  initialStatus,
}: {
  phaseId: string
  initialStatus: Status
}) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(initialStatus)
  const [saving, setSaving] = useState(false)

  async function updateStatus(next: Status) {
    if (next === status) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('training_block_phases').update({ status: next }).eq('id', phaseId)
    setStatus(next)
    setSaving(false)
    router.refresh()
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-2">Phase status</p>
      <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            disabled={saving}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              status === s
                ? s === 'active' ? 'bg-blue-600 text-white'
                : s === 'archived' ? 'bg-indigo-600 text-white'
                : 'bg-zinc-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
