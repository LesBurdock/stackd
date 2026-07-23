'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StartWorkoutButton({ programmeId }: { programmeId: string }) {
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
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-4 py-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Starting…' : 'Start workout'}
      </button>
    </div>
  )
}
