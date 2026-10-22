'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/card'
import Button from '@/components/button'
import FinishBlockButton from '@/components/finish-block-button'

export default function PhaseCompleteCard({
  phaseId,
  phaseLabel,
  nextPhaseLabel,
  blockId,
  blockName,
}: {
  phaseId: string
  phaseLabel: string
  nextPhaseLabel: string | null
  blockId: string
  blockName: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdvance() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/phases/${phaseId}/advance`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Failed to start the next phase.')
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <Card className="p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Phase complete</p>
      <h2 className="mt-1 text-2xl font-bold text-ink leading-tight">{phaseLabel} done</h2>

      <div className="mt-4">
        {nextPhaseLabel ? (
          <Button variant="primary" className="w-full" onClick={handleAdvance} disabled={busy}>
            {busy ? 'Starting…' : `Start ${nextPhaseLabel}`}
          </Button>
        ) : (
          <FinishBlockButton blockId={blockId} blockName={blockName} variant="primary" />
        )}
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </Card>
  )
}
