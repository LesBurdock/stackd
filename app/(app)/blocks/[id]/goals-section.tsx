'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Goal = {
  id: string
  description: string
  order_index: number
  achieved: boolean
}

export default function GoalsSection({ blockId, initialGoals }: { blockId: string; initialGoals: Goal[] }) {
  const router = useRouter()
  const [goals, setGoals] = useState(initialGoals)
  const [newText, setNewText] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function toggleGoal(goal: Goal) {
    const nextAchieved = !goal.achieved
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, achieved: nextAchieved } : g))

    const supabase = createClient()
    await supabase
      .from('training_block_goals')
      .update({
        achieved: nextAchieved,
        achieved_at: nextAchieved ? new Date().toISOString() : null,
      })
      .eq('id', goal.id)

    router.refresh()
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault()
    const description = newText.trim()
    if (!description) return

    setSaving(true)
    const maxOrder = goals.reduce((m, g) => Math.max(m, g.order_index), -1)
    const supabase = createClient()

    const { data } = await supabase
      .from('training_block_goals')
      .insert({ block_id: blockId, description, order_index: maxOrder + 1 })
      .select('id, description, order_index, achieved')
      .single()

    if (data) {
      setGoals(prev => [...prev, data as Goal])
      setNewText('')
      setShowInput(false)
    }

    setSaving(false)
    router.refresh()
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Goals</h2>

      <div className="flex flex-col gap-1">
        {goals.length === 0 && !showInput && (
          <p className="text-sm text-zinc-600 py-1">No goals yet.</p>
        )}

        {goals.map(goal => (
          <button
            key={goal.id}
            onClick={() => toggleGoal(goal)}
            className="flex items-start gap-3 py-2 text-left group"
          >
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
              goal.achieved
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-zinc-600 group-hover:border-zinc-400'
            }`}>
              {goal.achieved && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3 text-white">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              )}
            </span>
            <span className={`text-sm leading-snug ${goal.achieved ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>
              {goal.description}
            </span>
          </button>
        ))}

        {showInput ? (
          <form onSubmit={addGoal} className="flex items-center gap-2 mt-1">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setShowInput(false)}
              placeholder="Describe a goal…"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving || !newText.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowInput(false)}
              className="rounded-lg px-2 py-2 text-sm text-zinc-500 hover:text-white"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-2 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add a goal
          </button>
        )}
      </div>
    </section>
  )
}
