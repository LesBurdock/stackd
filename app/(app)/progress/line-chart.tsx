'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export default function LineChart({ labels, values, unit }: { labels: string[]; values: number[]; unit: string }) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#18181b',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#27272a',
            borderColor: '#3f3f46',
            borderWidth: 1,
            titleColor: '#a1a1aa',
            bodyColor: '#ffffff',
            callbacks: {
              label: ctx => `${ctx.parsed.y} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#71717a', font: { size: 11 } },
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
