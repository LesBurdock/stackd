'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import type { ChartSeries } from './line-chart'
import type { GroupEntry } from './page'
import type { Metric } from '@/lib/progress-metrics'

const LineChart = dynamic(() => import('./line-chart'), { ssr: false })

type HistorySeries = {
  exercise_id: string
  name: string
  variation: string | null
  label: string
  points: { session_id: string; date: string; value: number }[]
  best: number | null
  latest: number | null
  change: number | null
  sessions: number
}

const METRIC_LABELS: Record<Metric, string> = {
  e1rm: 'Est. 1RM',
  volume: 'Volume',
  weight: 'Weight',
  reps: 'Reps',
}

const METRIC_UNITS: Record<Metric, string> = {
  e1rm: 'kg',
  volume: 'kg',
  weight: 'kg',
  reps: 'reps',
}

const MAX_DEFAULT_VISIBLE = 4

function formatValue(value: number, metric: Metric) {
  return `${value} ${METRIC_UNITS[metric]}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function seriesStats(s: HistorySeries) {
  if (s.points.length === 0) return null
  return { best: s.best!, latest: s.latest!, count: s.sessions }
}

export default function ProgressClient({ groups }: { groups: GroupEntry[] }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [series, setSeries] = useState<HistorySeries[]>([])
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

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

  function chooseGroup(g: GroupEntry) {
    setSelectedKey(g.key)
    setMetric(g.defaultMetric)
    setSheetOpen(false)
    setSearch('')
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
      {/* Picker trigger */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1.5">Exercise</label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
        >
          {selectedGroup ? selectedGroup.label : 'Choose an exercise…'}
        </button>
      </div>

      {/* Picker sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-md h-[80vh] flex flex-col rounded-t-2xl bg-zinc-950 border-t border-zinc-800 px-4 pt-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Choose exercise</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="text-sm text-zinc-400 hover:text-white">
                Cancel
              </button>
            </div>
            <input
              type="search"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto pb-6">
              {filteredGroups.length === 0 ? (
                <p className="px-1 py-3 text-sm text-zinc-500">No exercises found.</p>
              ) : (
                filteredGroups.map(g => (
                  <button
                    key={g.key}
                    onClick={() => chooseGroup(g)}
                    className="w-full text-left px-1 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">{g.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {g.sessionCount} session{g.sessionCount === 1 ? '' : 's'}
                      {g.latestValue !== null && ` · ${METRIC_LABELS[g.defaultMetric]} ${formatValue(g.latestValue, g.defaultMetric)}`}
                      {g.exercises.length > 1 && ` · ${g.exercises.length} variants`}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <>
          {/* Metric toggle -- chips per the boards land in step 3; plain toggle for now */}
          <div className="flex rounded-xl border border-zinc-700 overflow-hidden">
            {(['e1rm', 'volume', 'weight', 'reps'] as Metric[]).map(m => (
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

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                {chartSeries.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-8">No lines selected.</p>
                ) : (
                  <LineChart series={chartSeries} unit={METRIC_UNITS[metric]} />
                )}
              </div>

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

      {!selectedGroup && groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-zinc-500 text-sm">No sessions logged yet.</p>
        </div>
      )}
      {!selectedGroup && groups.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-zinc-500 text-sm">Choose an exercise above to see your progress.</p>
        </div>
      )}
    </div>
  )
}
