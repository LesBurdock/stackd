'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import type { ChartSeries } from './line-chart'

const LineChart = dynamic(() => import('./line-chart'), { ssr: false })

type Exercise = { id: string; name: string; group_name: string | null; variation: string | null; category: string | null }
type Metric = '1rm' | 'volume' | 'max_weight'
type SeriesPoint = { session_id: string; date: string; value: number }
type HistorySeries = { exercise_id: string; name: string; variation: string | null; label: string; points: SeriesPoint[] }
type Group = { key: string; label: string; exercises: Exercise[] }

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

const MAX_DEFAULT_VISIBLE = 4

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// group key = lower(trim(coalesce(group_name, name))) -- matches the API route's rule.
function groupKey(ex: Exercise) {
  return (ex.group_name ?? ex.name).toLowerCase().trim()
}

function buildGroups(exercises: Exercise[]): Group[] {
  const map = new Map<string, Group>()
  for (const ex of exercises) {
    const key = groupKey(ex)
    if (!map.has(key)) map.set(key, { key, label: ex.group_name ?? ex.name, exercises: [] })
    map.get(key)!.exercises.push(ex)
  }
  return [...map.values()]
}

function seriesStats(s: HistorySeries) {
  if (s.points.length === 0) return null
  return {
    best: Math.max(...s.points.map(p => p.value)),
    latest: s.points[s.points.length - 1].value,
    count: s.points.length,
  }
}

export default function ProgressClient({ exercises }: { exercises: Exercise[] }) {
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('1rm')
  const [series, setSeries] = useState<HistorySeries[]>([])
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)

  const groups = useMemo(() => buildGroups(exercises), [exercises])
  const selectedGroup = groups.find(g => g.key === selectedKey) ?? null

  const filteredGroups = groups.filter(g =>
    g.label.toLowerCase().includes(search.toLowerCase()) ||
    g.exercises.some(e => e.name.toLowerCase().includes(search.toLowerCase()))
  )

  useEffect(() => {
    if (!selectedGroup) return
    setLoading(true)
    const repId = selectedGroup.exercises[0].id
    fetch(`/api/exercises/${repId}/history?metric=${metric}&scope=group`)
      .then(r => r.json())
      .then(d => {
        const s: HistorySeries[] = d.series ?? []
        setSeries(s)
        setVisibleIds(prev => {
          // Same group as before (just a metric change) -- keep the current toggle state.
          const sameGroup = s.length === prev.size && s.every(x => prev.has(x.exercise_id))
          if (sameGroup) return prev
          const defaultIds = [...s]
            .sort((a, b) => b.points.length - a.points.length)
            .slice(0, MAX_DEFAULT_VISIBLE)
            .map(x => x.exercise_id)
          return new Set(defaultIds)
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedKey, metric])

  function selectGroup(g: Group) {
    setSelectedKey(g.key)
    setSearch(g.label)
    setShowList(false)
    setSeries([])
  }

  function toggleVisible(exerciseId: string) {
    setVisibleIds(prev => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
  }

  const hasAnyData = series.some(s => s.points.length > 0)

  const chartSeries: ChartSeries[] = series
    .filter(s => visibleIds.has(s.exercise_id))
    .map(s => ({
      id: s.exercise_id,
      label: s.label,
      points: s.points.map(p => ({ x: new Date(p.date).getTime(), y: p.value })),
    }))

  const recentAcrossGroup = useMemo(() => {
    return series
      .flatMap(s => s.points.map(p => ({ ...p, label: s.label })))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [series])

  return (
    <div className="flex flex-col gap-6">
      {/* Group selector */}
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
            {filteredGroups.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-500">No exercises found.</p>
            ) : (
              filteredGroups.map(g => (
                <button
                  key={g.key}
                  onClick={() => selectGroup(g)}
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-zinc-800 border-b border-zinc-800 last:border-0 transition-colors"
                >
                  {g.label}
                  {g.exercises.length > 1 && (
                    <span className="text-zinc-500"> · {g.exercises.length} variants</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedGroup && (
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
          ) : !hasAnyData ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
              <p className="text-sm text-zinc-500">No sessions logged for {selectedGroup.label} yet.</p>
            </div>
          ) : (
            <>
              {/* Line visibility toggles (only worth showing with more than one line) */}
              {series.length > 1 && (
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {series.map(s => (
                    <label key={s.exercise_id} className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={visibleIds.has(s.exercise_id)}
                        onChange={() => toggleVisible(s.exercise_id)}
                        className="rounded border-zinc-600 bg-zinc-800"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}

              {/* Chart */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                {chartSeries.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-8">No lines selected.</p>
                ) : (
                  <LineChart series={chartSeries} unit={METRIC_UNITS[metric]} />
                )}
              </div>

              {/* Per-line stats -- not one aggregate, weights aren't comparable across exercises */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                  {series.length > 1 ? 'By exercise' : 'Stats'}
                </h2>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
                  {series.map(s => {
                    const stats = seriesStats(s)
                    return (
                      <div key={s.exercise_id} className="flex items-center justify-between px-4 py-3">
                        <span className="text-sm text-zinc-300 truncate pr-3">{s.label}</span>
                        {stats ? (
                          <span className="text-xs text-zinc-500 shrink-0">
                            Best <span className="text-white font-medium">{stats.best}{METRIC_UNITS[metric]}</span>
                            {' · '}Latest <span className="text-white font-medium">{stats.latest}{METRIC_UNITS[metric]}</span>
                            {' · '}{stats.count} session{stats.count === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600 shrink-0">No sessions yet</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Recent sessions across the whole group */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Recent sessions</h2>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
                  {recentAcrossGroup.map(d => (
                    <div key={d.session_id + d.label} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="text-sm text-zinc-400">{formatDate(d.date)}</span>
                        {series.length > 1 && <span className="text-xs text-zinc-600 ml-2">{d.label}</span>}
                      </div>
                      <span className="text-sm font-medium text-white">{d.value} {METRIC_UNITS[metric]}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {!selectedGroup && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-zinc-500 text-sm">Search for an exercise above to see your progress.</p>
        </div>
      )}
    </div>
  )
}
