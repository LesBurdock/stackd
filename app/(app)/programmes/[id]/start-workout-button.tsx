'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/button'

export default function StartWorkoutButton({
  programmeId,
  disabled = false,
  disabledReason,
}: {
  programmeId: string
  disabled?: boolean
  disabledReason?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programme_id: programmeId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }
    router.push(`/sessions/${data.id}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" className="w-full" onClick={handleStart} disabled={disabled || loading}>
        {loading ? 'Starting…' : 'Start workout'}
      </Button>
      {disabled && disabledReason && <p className="text-xs text-muted text-center">{disabledReason}</p>}
      {error && <p className="text-sm text-error text-center">{error}</p>}
    </div>
  )
}
