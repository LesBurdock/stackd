'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/button'
import ConfirmSheet from '@/components/confirm-sheet'

export default function FinishPhaseButton({
  phaseId,
  phaseLabel,
}: {
  phaseId: string
  phaseLabel: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/phases/${phaseId}/advance`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Failed to finish this phase.')
      setBusy(false)
      return
    }
    router.push('/programmes')
    router.refresh()
  }

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        Finish phase
      </Button>
      <ConfirmSheet
        open={open}
        title={`Finish ${phaseLabel}?`}
        body="The next planned phase becomes active. Sessions you haven't logged stay exactly as they are."
        confirmLabel="Finish phase"
        busy={busy}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => { setOpen(false); setError(null) }}
      />
    </>
  )
}
