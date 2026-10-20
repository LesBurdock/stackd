'use client'

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// Palette for up to several concurrent lines -- cycles if a group somehow has more.
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#06b6d4']

export type ChartSeries = {
  id: string
  label: string
  points: { x: number; y: number }[]  // x = ms timestamp
}

function formatTick(ms: number) {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function LineChart({ series, unit }: { series: ChartSeries[]; unit: string }) {
  return (
    <Line
      data={{
        datasets: series.map((s, i) => {
          const color = COLORS[i % COLORS.length]
          return {
            label: s.label,
            data: s.points,
            borderColor: color,
            backgroundColor: `${color}14`,
            borderWidth: 2,
            pointBackgroundColor: color,
            pointBorderColor: '#18181b',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
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
          legend: {
            display: true,
            labels: { color: '#a1a1aa', boxWidth: 10, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#27272a',
            borderColor: '#3f3f46',
            borderWidth: 1,
            titleColor: '#a1a1aa',
            bodyColor: '#ffffff',
            callbacks: {
              title: items => (items[0]?.parsed.x != null ? formatTick(items[0].parsed.x) : ''),
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#71717a',
              font: { size: 11 },
              callback: value => formatTick(Number(value)),
            },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#71717a', font: { size: 11 } },
            beginAtZero: false,
          },
        },
      }}
    />
  )
}
