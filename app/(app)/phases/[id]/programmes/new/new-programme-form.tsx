'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UI_STRINGS } from '@/lib/ui-strings'
import Button from '@/components/button'

export default function NewProgrammeForm({ phaseId, blockId }: { phaseId: string; blockId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(UI_STRINGS.workoutNameRequiredError); return }
    setError('')
    setLoading(true)

    const res = await fetch(`/api/phases/${phaseId}/programmes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setLoading(false); return }

    router.push(`/phases/${phaseId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
          {UI_STRINGS.workoutNameLabel}
        </label>
        <input
          id="name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Upper body, Lower body, Full body"
          className="w-full rounded-[var(--radius-control)] border border-border bg-white px-4 py-3 text-ink placeholder-faint focus:border-ink focus:outline-none"
        />
        <p className="mt-2 text-xs text-muted">
          {UI_STRINGS.multiWorkoutsPerPhaseHelpText}
        </p>
      </div>

      {error && (
        <p className="rounded-[var(--radius-control)] bg-white border border-error/30 px-4 py-3 text-sm text-error">{error}</p>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading ? UI_STRINGS.addWorkoutButtonLoading : UI_STRINGS.addWorkoutButton}
      </Button>
    </form>
  )
}
