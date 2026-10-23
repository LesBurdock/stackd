'use client'

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(LinearScale, PointElement, LineElement, BarElement, Tooltip)

// Ink + orange only, differentiated by dash pattern so colour is never the only cue
// (CLAUDE.md's Design handoff "Progress" paragraph). Cycles past 4 lines if needed.
const INK = '#16181D'
const ORANGE = '#FF9500'
const LINE_STYLES: { color: string; dash: number[] }[] = [
  { color: INK, dash: [] },
  { color: ORANGE, dash: [] },
  { color: INK, dash: [6, 4] },
  { color: ORANGE, dash: [6, 4] },
  { color: INK, dash: [2, 2] },
  { color: ORANGE, dash: [2, 2] },
]

export type ChartSeries = {
  id: string
  label: string
  points: { x: number; y: number }[] // x = ms timestamp
}

function formatTick(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const sharedScales = {
  x: {
    type: 'linear' as const,
    grid: { color: '#E3E1DA' },
    ticks: { color: '#62666F', font: { size: 11 }, callback: (v: unknown) => formatTick(Number(v)) },
  },
  y: {
    grid: { color: '#E3E1DA' },
    ticks: { color: '#62666F', font: { size: 11 } },
    beginAtZero: false,
  },
}

const sharedTooltip = {
  backgroundColor: '#16181D',
  titleColor: '#9A9DA4',
  bodyColor: '#FFFFFF',
  borderWidth: 0,
}

export default function ProgressChart({
  series,
  unit,
  metric,
}: {
  series: ChartSeries[]
  unit: string
  metric: string
}) {
  if (metric === 'volume') {
    // No board shows multiple concurrent volume bar series -- approximated here as one bar
    // dataset per series, each its own latest-bar-in-orange, rather than inventing a
    // grouped-bar treatment nothing in the design specifies.
    return (
      <Bar
        data={{
          datasets: series.map(s => {
            const maxX = Math.max(...s.points.map(p => p.x))
            return {
              label: s.label,
              data: s.points,
              backgroundColor: s.points.map(p => (p.x === maxX ? ORANGE : INK)),
              borderRadius: 3,
              barPercentage: 0.5,
            }
          }),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: true,
          parsing: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...sharedTooltip,
              callbacks: {
                title: items => (items[0]?.parsed.x != null ? formatTick(items[0].parsed.x) : ''),
                label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`,
              },
            },
          },
          scales: sharedScales,
        }}
      />
    )
  }

  return (
    <Line
      data={{
        datasets: series.map((s, i) => {
          const style = LINE_STYLES[i % LINE_STYLES.length]
          const maxX = Math.max(...s.points.map(p => p.x))
          return {
            label: s.label,
            data: s.points,
            borderColor: style.color,
            borderDash: style.dash,
            backgroundColor: style.color,
            borderWidth: 2,
            pointBackgroundColor: s.points.map(p => (p.x === maxX ? ORANGE : style.color)),
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1,
            pointRadius: s.points.map(p => (p.x === maxX ? 6 : 4)),
            pointHoverRadius: 7,
            fill: false,
            tension: 0,
            spanGaps: false,
          }
        }),
      }}
      options={{
        responsive: true,
        maintainAspectRatio: true,
        parsing: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...sharedTooltip,
            callbacks: {
              title: items => (items[0]?.parsed.x != null ? formatTick(items[0].parsed.x) : ''),
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`,
            },
          },
        },
        scales: sharedScales,
      }}
    />
  )
}
