'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'

const LineChart = dynamic(() => import('./line-chart'), { ssr: false })

type Exercise = { id: string; name: string; category: string | null }
type DataPoint = { session_id: string; date: string; value: number }
type Metric = '1rm' | 'volume' | 'max_weight'

const METRIC_LABELS: Record<Metric, string> = {
  '1rm': 'Est. 1RM',
  volume: 'Volume',
  max_weight: 'Max weight',
}

const METRIC_UNITS: Record<Metric, string> = {
  '1rm': 'kg',
  volume: 'kg',
  max_weight: 'kg',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ProgressClient({ exercises }: { exercises: Exercise[] }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('1rm')
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)

  const selectedExercise = exercises.find(e => e.id === selectedId)

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    fetch(`/api/exercises/${selectedId}/history?metric=${metric}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedId, metric])

  function selectExercise(ex: Exercise) {
    setSelectedId(ex.id)
    setSearch(ex.name)
    setShowList(false)
    setData([])
  }

  const best = data.length > 0 ? Math.max(...data.map(d => d.value)) : null
  const latest = data.length > 0 ? data[data.length - 1].value : null
  const recent = [...data].reverse().slice(0, 5)

  const chartLabels = data.map(d => formatDate(d.date))
  const chartValues = data.map(d => d.value)

  return (
    <div className="flex flex-col gap-6">
      {/* Exercise selector */}
      <div className="relative">
        <label className="block text-xs text-zinc-500 mb-1.5">Exercise</label>
        <input
          type="search"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowList(true) }}
          onFocus={() => setShowList(true)}
          placeholder="Search exercises…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {showList && search.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500">No exercises found.</p>
            ) : (
              filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => selectExercise(ex)}
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-zinc-800 border-b border-zinc-800 last:border-0 transition-colors"
                >
                  {ex.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedId && (
        <>
          {/* Metric toggle */}
          <div className="flex rounded-xl border border-zinc-700 overflow-hidden">
            {(['1rm', 'volume', 'max_weight'] as Metric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  metric === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-zinc-500 text-center py-8">Loading…</p>
          ) : data.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <p className="text-sm text-zinc-500">No sessions logged for {selectedExercise?.name} yet.</p>
            </div>
          ) : (
            <>
              {/* Headline stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500 mb-1">Best</p>
                  <p className="text-2xl font-bold text-white">{best}<span className="text-sm font-normal text-zinc-500 ml-1">{METRIC_UNITS[metric]}</span></p>
                  <p className="text-xs text-zinc-600 mt-0.5">{METRIC_LABELS[metric]}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500 mb-1">Latest</p>
                  <p className="text-2xl font-bold text-white">{latest}<span className="text-sm font-normal text-zinc-500 ml-1">{METRIC_UNITS[metric]}</span></p>
                  <p className="text-xs text-zinc-600 mt-0.5">{METRIC_LABELS[metric]}</p>
                </div>
              </div>

              {/* Chart */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <LineChart
                  labels={chartLabels}
                  values={chartValues}
                  unit={METRIC_UNITS[metric]}
                />
              </div>

              {/* Recent sessions */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Recent sessions</h2>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
                  {recent.map(d => (
                    <div key={d.session_id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-zinc-400">{formatDate(d.date)}</span>
                      <span className="text-sm font-medium text-white">{d.value} {METRIC_UNITS[metric]}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {!selectedId && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-zinc-500 text-sm">Search for an exercise above to see your progress.</p>
        </div>
      )}
    </div>
  )
}
