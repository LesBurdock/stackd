'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/button'
import ConfirmSheet from '@/components/confirm-sheet'

// Shared by "Finish training block" (shown once every phase is done) and "Finish training
// block early" (always available from the active block card) -- same route, same confirm copy.
export default function FinishBlockButton({
  blockId,
  blockName,
  variant,
}: {
  blockId: string
  blockName: string
  variant: 'primary' | 'quiet'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/blocks/${blockId}/finish`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Failed to finish this block.')
      setBusy(false)
      return
    }
    setOpen(false)
    setBusy(false)
    router.refresh()
  }

  return (
    <>
      {variant === 'primary' ? (
        <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
          Finish training block
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted hover:text-ink transition-colors"
        >
          Finish training block early
        </button>
      )}

      <ConfirmSheet
        open={open}
        title={`Finish ${blockName}?`}
        body="It moves to Previous training blocks. Every session you logged is kept."
        confirmLabel="Finish training block"
        busy={busy}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => { setOpen(false); setError(null) }}
      />
    </>
  )
}
