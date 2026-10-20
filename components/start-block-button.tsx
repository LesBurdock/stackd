'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/button'

export default function StartBlockButton({
  blockId,
  disabledReason,
}: {
  blockId: string
  disabledReason: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/blocks/${blockId}/start`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Failed to start this block.')
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <Button
        variant="primary"
        className="w-full"
        disabled={!!disabledReason || busy}
        onClick={handleStart}
      >
        {busy ? 'Starting…' : 'Start this block'}
      </Button>
      {disabledReason && !error && (
        <p className="mt-2 text-center text-xs text-muted">{disabledReason}</p>
      )}
      {error && <p className="mt-2 text-center text-xs text-error">{error}</p>}
    </div>
  )
}
