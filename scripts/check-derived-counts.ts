// Verification script for lib/derived-counts.ts (CLAUDE.md "Design handoff" stage 1, step 3).
// Fetches a real user's training blocks from stackd-test and prints the derived numbers
// (session labels, phase totals, phase-complete, block week) so they can be eyeballed against
// what's actually in the database -- not a test suite, a readability check against real data.
//
// Run: TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npx tsx scripts/check-derived-counts.ts
// Credentials are read from the environment only -- never hardcode them here, never paste them
// into chat. Needs .env.local (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY) to already point at stackd-test.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import {
  sessionLabel,
  phaseSessionTotals,
  isPhaseComplete,
  isBlockReadyToFinish,
  previousBlockDateLabel,
  type PhaseProgress,
} from '../lib/derived-counts'

function loadEnvLocal() {
  try {
    const text = readFileSync('.env.local', 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  } catch {}
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (.env.local)')
  if (!email || !password) {
    throw new Error('Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars (a stackd-test login) before running this.')
  }

  const supabase = createClient(url, anonKey)
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
  if (authErr) throw new Error(`Login failed: ${authErr.message}`)

  const { data: blocks, error: blocksErr } = await supabase
    .from('training_blocks')
    .select(`
      id, name, status, weeks_total, finished_at, created_at,
      training_block_phases(id, phase_label, order_index, status, duration_weeks,
        programmes(id, name, order_index))
    `)
    .order('created_at', { ascending: true })
  if (blocksErr) throw blocksErr

  type RawProgramme = { id: string; name: string; order_index: number | null }
  type RawPhase = {
    id: string
    phase_label: string
    order_index: number
    status: 'planned' | 'active' | 'archived'
    duration_weeks: number | null
    programmes: RawProgramme[]
  }

  for (const block of blocks ?? []) {
    console.log(`\n=== ${block.name} (${block.status}) weeks_total=${block.weeks_total} ===`)

    const phaseRows = [...(block.training_block_phases as unknown as RawPhase[])].sort((a, b) => a.order_index - b.order_index)
    const phases: PhaseProgress[] = []

    for (const ph of phaseRows) {
      const programmes = ph.programmes
      const workouts = []
      for (const prog of programmes) {
        const { count } = await supabase
          .from('workout_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('programme_id', prog.id)
          .eq('status', 'completed')
        const completedSessions = count ?? 0
        workouts.push({ programmeId: prog.id, name: prog.name, orderIndex: prog.order_index, completedSessions })
      }
      const phase: PhaseProgress = {
        id: ph.id,
        label: ph.phase_label,
        orderIndex: ph.order_index,
        status: ph.status,
        durationWeeks: ph.duration_weeks,
        workouts,
      }
      phases.push(phase)

      const { done, total } = phaseSessionTotals(phase)
      console.log(
        `  ${ph.phase_label.padEnd(16)} duration_weeks=${String(ph.duration_weeks).padEnd(4)} ` +
        `status=${ph.status.padEnd(9)} done=${done} total=${total ?? 'unknown'} complete=${isPhaseComplete(phase)}`
      )
      for (const w of workouts) {
        console.log(`      - ${w.name.padEnd(14)} ${sessionLabel(w.completedSessions, phase.durationWeeks)}`)
      }
    }

    console.log(`  Block ready to finish: ${isBlockReadyToFinish(phases)}`)

    if (block.status === 'archived') {
      // First/last completed session across the whole block, for the fallback date line.
      const programmeIds = phaseRows.flatMap(ph => ph.programmes.map(p => p.id))
      let firstDate: string | null = null
      let lastDate: string | null = null
      if (programmeIds.length > 0) {
        const { data: sessions } = await supabase
          .from('workout_sessions')
          .select('completed_at')
          .in('programme_id', programmeIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: true })
        if (sessions && sessions.length > 0) {
          firstDate = sessions[0].completed_at
          lastDate = sessions[sessions.length - 1].completed_at
        }
      }
      const label = previousBlockDateLabel(block.finished_at, firstDate, lastDate, block.weeks_total)
      console.log(`  Previous-blocks date line: ${label ?? '(no completed sessions -- name + phase count only)'}`)
    }
  }

  await supabase.auth.signOut()
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
