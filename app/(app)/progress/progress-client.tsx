'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import type { ChartSeries } from './line-chart'
import type { GroupEntry } from './page'
import type { Metric, Range } from '@/lib/progress-metrics'
import Card from '@/components/card'

const ProgressChart = dynamic(() => import('./line-chart'), { ssr: false })

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

const METRIC_LABELS: Record<Metric, string> = { e1rm: 'Est. 1RM', volume: 'Volume', weight: 'Weight', reps: 'Reps' }
const METRIC_UNITS: Record<Metric, string> = { e1rm: 'kg', volume: 'kg', weight: 'kg', reps: 'reps' }
const RANGES: Range[] = ['4W', '12W', '6M', 'All']
const MAX_DEFAULT_VISIBLE = 4

// Same two colours the chart uses, by series index, for the legend swatches -- dash pattern
// isn't shown in the swatch (the chart itself carries that distinction), colour is enough
// here since each row also has its own label.
const SWATCH_COLORS = ['bg-ink', 'bg-action', 'bg-ink', 'bg-action', 'bg-ink', 'bg-action']

function metricsForGroup(group: GroupEntry): Metric[] {
  return group.defaultMetric === 'reps' ? ['reps', 'volume', 'weight'] : ['e1rm', 'volume', 'weight']
}

// Bodyweight groups' "Weight" chip is really added load -- shown as "+kg" per the boards.
function metricLabel(m: Metric, group: GroupEntry) {
  if (m === 'weight' && group.defaultMetric === 'reps') return '+kg'
  return METRIC_LABELS[m]
}

function formatValue(value: number, metric: Metric, group: GroupEntry) {
  const unit = METRIC_UNITS[metric]
  const isAddedLoad = metric === 'weight' && group.defaultMetric === 'reps'
  const sign = isAddedLoad && value >= 0 ? '+' : ''
  return `${sign}${value} ${unit}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function ChipRow<T extends string>({ options, value, onChange, labelFor }: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labelFor: (v: T) => string
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt ? 'bg-action text-ink' : 'bg-tag-fill text-muted hover:text-ink'
          }`}
        >
          {labelFor(opt)}
        </button>
      ))}
    </div>
  )
}

export default function ProgressClient({ groups }: { groups: GroupEntry[] }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('e1rm')
  const [range, setRange] = useState<Range>('All')
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
    fetch(`/api/exercises/${repId}/history?metric=${metric}&scope=group&range=${range}`)
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
  }, [selectedKey, metric, range])

  function chooseGroup(g: GroupEntry) {
    setSelectedKey(g.key)
    setMetric(g.defaultMetric)
    setRange('All')
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
  const visibleSeries = series.filter(s => visibleIds.has(s.exercise_id))
  const singleLine = visibleSeries.length === 1 ? visibleSeries[0] : null

  const chartSeries: ChartSeries[] = visibleSeries.map(s => ({
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

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <p className="text-sm text-muted">Nothing logged yet.</p>
        <p className="text-xs text-faint max-w-xs">Progress charts show up here once you've completed a few sessions.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Picker trigger */}
      <div>
        <label className="block text-xs text-muted mb-1.5">Exercise</label>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left rounded-[var(--radius-control)] border border-border bg-white px-4 py-3 text-ink"
        >
          {selectedGroup ? selectedGroup.label : 'Choose an exercise…'}
        </button>
      </div>

      {/* Picker sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-md h-[80vh] flex flex-col rounded-t-2xl bg-white px-4 pt-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-ink">Choose exercise</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="text-sm text-muted hover:text-ink transition-colors">
                Cancel
              </button>
            </div>
            <input
              type="search"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search exercises…"
              className="w-full rounded-[var(--radius-control)] border border-border bg-white px-4 py-3 text-ink placeholder-faint focus:border-ink focus:outline-none"
            />
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto pb-6">
              {filteredGroups.length === 0 ? (
                <p className="px-1 py-3 text-sm text-muted">No exercises found.</p>
              ) : (
                filteredGroups.map(g => (
                  <button
                    key={g.key}
                    onClick={() => chooseGroup(g)}
                    className="w-full text-left px-1 py-3 border-b border-divider last:border-0 hover:opacity-70 transition-opacity"
                  >
                    <p className="text-sm font-medium text-ink">{g.label}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {g.sessionCount} session{g.sessionCount === 1 ? '' : 's'}
                      {g.latestValue !== null && ` · ${METRIC_LABELS[g.defaultMetric]} ${formatValue(g.latestValue, g.defaultMetric, g)}`}
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
          <ChipRow options={metricsForGroup(selectedGroup)} value={metric} onChange={setMetric} labelFor={m => metricLabel(m, selectedGroup)} />
          <ChipRow options={RANGES} value={range} onChange={setRange} labelFor={r => r} />

          {loading ? (
            <p className="text-sm text-muted text-center py-8">Loading…</p>
          ) : !hasAnyData ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted">
                {range === 'All'
                  ? `No sessions logged for ${selectedGroup.label} yet.`
                  : `No sessions for ${selectedGroup.label} in this range.`}
              </p>
            </Card>
          ) : (
            <>
              {/* Headline -- only when exactly one line is visible, per "a group with one
                  exercise looks like a single-line chart"; with several lines shown at
                  once, the legend rows below carry each line's own stats instead. */}
              {singleLine && singleLine.latest !== null && (
                <div>
                  <p className="text-4xl font-bold text-ink">
                    {formatValue(singleLine.latest, metric, selectedGroup)}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {metricLabel(metric, selectedGroup)} · latest session
                    {singleLine.change !== null && singleLine.sessions > 1 &&
                      ` · ${singleLine.change >= 0 ? '+' : ''}${singleLine.change} ${METRIC_UNITS[metric]} since ${range === 'All' ? 'the start' : range}`}
                  </p>
                  {selectedGroup.perHand && <p className="text-xs text-muted mt-0.5">per hand</p>}
                </div>
              )}

              <Card className="p-4">
                {chartSeries.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">No lines selected.</p>
                ) : !visibleSeries.some(s => s.points.length > 0) ? (
                  <p className="text-sm text-muted text-center py-8">
                    No sessions {range === 'All' ? 'for the selected line' : 'in this range for the selected line'}.
                  </p>
                ) : (
                  <ProgressChart series={chartSeries} unit={METRIC_UNITS[metric]} metric={metric} />
                )}
              </Card>

              {/* Legend rows -- swatch, label, sessions, latest, change; clicking toggles
                  the line (replaces the old separate checkbox row + stats table). */}
              <Card className="divide-y divide-divider">
                {series.map((s, i) => {
                  const active = visibleIds.has(s.exercise_id)
                  return (
                    <button
                      key={s.exercise_id}
                      onClick={() => toggleVisible(s.exercise_id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-opacity ${active ? '' : 'opacity-40'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2.5 rounded-full shrink-0 ${SWATCH_COLORS[i % SWATCH_COLORS.length]}`} />
                        <span className="text-sm text-ink truncate">{s.label}</span>
                      </div>
                      <span className="text-xs text-muted shrink-0 text-right">
                        {s.sessions > 0 ? (
                          <>
                            Best {formatValue(s.best!, metric, selectedGroup)}
                            {' · '}Latest {formatValue(s.latest!, metric, selectedGroup)}
                            {' · '}{s.sessions} session{s.sessions === 1 ? '' : 's'}
                          </>
                        ) : (
                          range === 'All' ? 'No sessions yet' : 'No sessions in this range'
                        )}
                      </span>
                    </button>
                  )
                })}
              </Card>

              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Recent sessions</h2>
                <Card className="divide-y divide-divider">
                  {recentAcrossGroup.map(d => (
                    <div key={d.session_id + d.label} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="text-sm text-muted">{formatDate(d.date)}</span>
                        {series.length > 1 && <span className="text-xs text-faint ml-2">{d.label}</span>}
                      </div>
                      <span className="text-sm font-medium text-ink">{formatValue(d.value, metric, selectedGroup)}</span>
                    </div>
                  ))}
                </Card>
              </section>
            </>
          )}
        </>
      )}

      {!selectedGroup && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className="text-sm text-muted">Choose an exercise above to see your progress.</p>
        </div>
      )}
    </div>
  )
}
