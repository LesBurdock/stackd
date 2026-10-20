'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/card'
import Button from '@/components/button'
import TagPill from '@/components/tag-pill'
import ConfirmSheet from '@/components/confirm-sheet'

function minutesAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  return mins === 1 ? '1 min ago' : `${mins} min ago`
}

export default function ResumeSessionCard({
  sessionId,
  workoutName,
  startedAt,
}: {
  sessionId: string
  workoutName: string
  startedAt: string
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDiscard() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'abandoned' }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Failed to discard this session.')
      setBusy(false)
      return
    }
    setConfirmOpen(false)
    setBusy(false)
    router.refresh()
  }

  return (
    <Card className="p-4">
      <TagPill highlight>{`In progress · started ${minutesAgo(startedAt)}`}</TagPill>
      <h2 className="mt-3 text-3xl font-bold text-ink leading-tight">{workoutName}</h2>

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" className="w-full" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Resume workout
        </Button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-sm text-muted hover:text-ink transition-colors text-center"
        >
          Discard session
        </button>
      </div>

      <ConfirmSheet
        open={confirmOpen}
        title="Discard this session?"
        body="It's saved as abandoned, not deleted -- any sets you already logged are kept. You can start a fresh session any time."
        confirmLabel="Discard session"
        busy={busy}
        error={error}
        onConfirm={handleDiscard}
        onCancel={() => { setConfirmOpen(false); setError(null) }}
      />
    </Card>
  )
}
