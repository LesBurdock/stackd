import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Ajv from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import fs from 'fs'
import path from 'path'

// ─── Schema validation ────────────────────────────────────────────────────────

let _validate: ReturnType<Ajv['compile']> | null = null
function getValidator() {
  if (!_validate) {
    const ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(ajv)
    const schemaPath = path.join(process.cwd(), 'unified-training-plan.schema.json')
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'))
    // Ajv v8 supports $defs natively
    _validate = ajv.compile(schema)
  }
  return _validate
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

type Reps = number | string  // integer | "8-10" | "30s" | "MAX"

interface ExerciseEntry {
  week: number
  mesocycle: string
  day_num: number
  day_label: string
  series: string
  slot_role: string
  exercise_name: string
  variation?: string
  body_region?: string
  equipment?: string
  target_priority?: boolean
  sets: number
  reps: Reps
  tempo: string
  rest_sec: number
  target_weight_kg: number | string  // number or "TBD"
  weight_status?: string
  weight_basis?: string
  confidence?: string
  notes?: string
  load_scheme?: 'equal' | 'ramp'
  ramp_end_percent?: number
}

interface Plan {
  plan_name: string
  athlete: string
  generated_date: string
  weeks_total: number
  days_per_week: number
  model_name?: string
  cycle_number?: number
  target_priority_regions: string[]
  constraints: string[]
  peaking_focus?: { label: string; reason?: string; replaces?: string }
  exercises: ExerciseEntry[]
}

// ─── Mapping tables ───────────────────────────────────────────────────────────

const SLOT_ROLE_MAP: Record<string, string> = {
  'Warm-up/primer': 'warmup_primer',
  'Primary compound': 'primary_compound',
  'Secondary compound': 'secondary_compound',
  'Accessory/isolation': 'accessory_isolation',
  'Finisher/isolation': 'finisher_isolation',
}

const WEIGHT_BASIS_MAP: Record<string, string> = {
  'Direct (from own logged 1RM)': 'direct_1rm',
  'Inferred from similar/same-pattern exercise': 'inferred_similar_exercise',
  'Estimated from bodyweight/strength-ratio heuristic': 'estimated_heuristic',
}

const CONFIDENCE_MAP: Record<string, string> = {
  'High': 'high',
  'Medium': 'medium',
  'Low': 'low',
}

// ─── Exercise name/variation resolution ───────────────────────────────────────

// Fallback for plans that predate the exercise_name/variation split, or that otherwise
// leave variation unstated: split on the first " - " or " – " delimiter, same rule
// migration-010-split-exercise-names.sql used for the existing 125 rows. Imperfect by
// design -- known to get it wrong when an equipment/angle qualifier is prefixed BEFORE
// the movement name (e.g. "45° DB Bench press - Semipronated"). A plan generated against
// the current schema should state exercise_name and variation separately and never
// exercise this path; this is a fallback for legacy files only.
function splitLegacyExerciseName(exerciseName: string): { name: string; variation: string | null } {
  const match = exerciseName.match(/^(.*?) [-–] (.*)$/)
  if (!match) return { name: exerciseName.trim(), variation: null }
  const variation = match[2].trim()
  return { name: match[1].trim(), variation: variation || null }
}

function resolveNameVariation(entry: ExerciseEntry): { name: string; variation: string | null } {
  if (entry.variation && entry.variation.trim()) {
    return { name: entry.exercise_name.trim(), variation: entry.variation.trim() }
  }
  return splitLegacyExerciseName(entry.exercise_name)
}

// ─── Equipment inference (fallback only -- prefer the source's `equipment` field) ──────

function inferEquipment(text: string): string | null {
  if (/\bdb\b/i.test(text)) return 'Dumbbell'
  if (/\bbb\b/i.test(text)) return 'Barbell'
  if (/\bkb\b/i.test(text)) return 'Kettlebell'
  if (/\bez\b/i.test(text)) return 'EZ Bar'
  if (/smith/i.test(text)) return 'Smith Machine'
  if (/band/i.test(text)) return 'Band'
  if (/pulley|cable|mag|rope|d handle/i.test(text)) return 'Cable'
  if (/machine|leg press|hack squat|pendulum squat|leg curl|leg extension|row - seated/i.test(text)) return 'Machine'
  if (/chin up|pull up|\bdip\b|\bdips\b|plank|push up|sit up|dead bug|garhammer raise|burpee|mountain climber|hanging leg raise/i.test(text)) return 'Bodyweight'
  return null
}

function resolveEquipment(entry: ExerciseEntry, name: string, variation: string | null): string | null {
  if (entry.equipment && entry.equipment.trim()) return entry.equipment.trim()
  return inferEquipment(combinedExerciseText(name, variation))
}

// ─── Fuzzy exercise matching ──────────────────────────────────────────────────

function normalizeTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 2)
}

function similarity(a: string, b: string): number {
  const aSet = new Set(normalizeTokens(a))
  const bSet = new Set(normalizeTokens(b))
  const intersection = [...aSet].filter(t => bSet.has(t)).length
  const union = new Set([...aSet, ...bSet]).size
  return union === 0 ? 0 : intersection / union
}

function combinedExerciseText(name: string, variation?: string | null): string {
  return variation ? `${name} ${variation}` : name
}

// Name-only matching -- used for peaking_focus.label, which names a lift in general
// ("Squat"), not a specific variant, so variation is deliberately not part of the match.
function findBestMatch(name: string, exercises: Array<{ id: string; name: string }>) {
  let best: { id: string; name: string } | null = null
  let bestScore = 0.4  // minimum threshold
  for (const ex of exercises) {
    const score = similarity(name, ex.name)
    if (score > bestScore) {
      bestScore = score
      best = ex
    }
  }
  return best
}

// name+variation combined matching -- used for every actual exercise-entry match, since
// matching on name alone would incorrectly collapse different variations of the same
// base movement (e.g. two different chin-up grips) into one exercise.
function findBestExerciseMatch(
  name: string,
  variation: string | null,
  exercises: Array<{ id: string; name: string; variation: string | null }>
) {
  const target = combinedExerciseText(name, variation)
  let best: { id: string; name: string; variation: string | null } | null = null
  let bestScore = 0.4
  for (const ex of exercises) {
    const score = similarity(target, combinedExerciseText(ex.name, ex.variation))
    if (score > bestScore) {
      bestScore = score
      best = ex
    }
  }
  return best
}

// ─── Series parsing ───────────────────────────────────────────────────────────

function parseSeries(series: string): { superset_group: string | null; superset_order: number | null } {
  if (series === 'SIT') return { superset_group: null, superset_order: null }
  const match = series.match(/^([A-Z])([0-9]+)$/)
  if (match) return { superset_group: match[1], superset_order: parseInt(match[2]) }
  return { superset_group: null, superset_order: null }
}

function seriesOrderKey(series: string): number {
  if (series === 'SIT') return -1
  const match = series.match(/^([A-Z])([0-9]*)$/)
  if (!match) return 0
  const letter = match[1].charCodeAt(0) - 65  // A=0, B=1, ...
  const num = match[2] ? parseInt(match[2]) : 0
  return letter * 100 + num
}

// ─── Reps parsing ─────────────────────────────────────────────────────────────

function parseReps(reps: Reps): {
  target_reps_min: number | null
  target_reps_max: number | null
  target_duration_seconds: number | null
  set_type: 'working' | 'amrap'
  prescription_type: 'reps' | 'duration'
} {
  if (reps === 'MAX') {
    return { target_reps_min: null, target_reps_max: null, target_duration_seconds: null, set_type: 'amrap', prescription_type: 'reps' }
  }
  if (typeof reps === 'number') {
    return { target_reps_min: reps, target_reps_max: reps, target_duration_seconds: null, set_type: 'working', prescription_type: 'reps' }
  }
  const range = reps.match(/^(\d+)-(\d+)$/)
  if (range) {
    return { target_reps_min: parseInt(range[1]), target_reps_max: parseInt(range[2]), target_duration_seconds: null, set_type: 'working', prescription_type: 'reps' }
  }
  const dur = reps.match(/^(\d+)s$/)
  if (dur) {
    return { target_reps_min: null, target_reps_max: null, target_duration_seconds: parseInt(dur[1]), set_type: 'working', prescription_type: 'duration' }
  }
  return { target_reps_min: null, target_reps_max: null, target_duration_seconds: null, set_type: 'working', prescription_type: 'reps' }
}

// ─── Core plan parsing ────────────────────────────────────────────────────────

interface DbSet {
  set_number: number
  week_number: number | null
  target_weight: number | null
  target_reps_min: number | null
  target_reps_max: number | null
  target_duration_seconds: number | null
  set_type: 'working' | 'amrap'
  load_type: 'absolute'
  weight_status: string | null
  weight_basis: string | null
  weight_confidence: string | null
}

interface ParsedExercise {
  exercise_name: string
  variation: string | null
  matched_exercise_id: string | null
  matched_exercise_name: string | null
  matched_exercise_variation: string | null
  is_new: boolean
  equipment: string | null
  muscle_group: string[] | null
  order_index: number
  superset_group: string | null
  superset_order: number | null
  slot_role: string | null
  prescription_type: 'reps' | 'duration'
  num_sets: number
  load_scheme: 'equal' | 'ramp'
  ramp_end_percent: number | null
  tempo: string | null
  rest_seconds: number | null
  notes: string | null
  sets: DbSet[]
  superset_set_count_mismatch: boolean
}

interface ParsedProgramme {
  name: string
  order_index: number
  exercises: ParsedExercise[]
}

interface ParsedPhase {
  phase_label: string
  order_index: number
  programmes: ParsedProgramme[]
}

interface ParseResult {
  block: {
    name: string
    athlete_name: string | null
    model_name: string | null
    cycle_number: number | null
    weeks_total: number
    days_per_week: number
    plan_generated_date: string | null
    target_priority_regions: string[]
    constraints: string[]
    peaking_focus: { label: string; reason?: string; replaces?: string } | null
  }
  phases: ParsedPhase[]
  stats: {
    phase_count: number
    programme_count: number
    exercise_count: number
    new_exercise_count: number
    matched_exercise_count: number
    superset_mismatch_count: number
  }
}

function parsePlan(plan: Plan, existingExercises: Array<{ id: string; name: string; variation: string | null }>): ParseResult {
  const entries = plan.exercises

  // Build ordered phase groups (consecutive entries sharing the same mesocycle)
  type PhaseGroup = { label: string; weeks: Set<number>; entries: ExerciseEntry[] }
  const phaseGroups: PhaseGroup[] = []
  let currentPhase: PhaseGroup | null = null

  for (const entry of entries) {
    if (!currentPhase || currentPhase.label !== entry.mesocycle) {
      currentPhase = { label: entry.mesocycle, weeks: new Set(), entries: [] }
      phaseGroups.push(currentPhase)
    }
    currentPhase.weeks.add(entry.week)
    currentPhase.entries.push(entry)
  }

  // Cache for exercise matching (by resolved name+variation, not the raw source string)
  const matchCache = new Map<string, { id: string; name: string; variation: string | null } | null>()
  function getMatch(name: string, variation: string | null) {
    const key = `${name}|||${variation ?? ''}`
    if (!matchCache.has(key)) {
      matchCache.set(key, findBestExerciseMatch(name, variation, existingExercises))
    }
    return matchCache.get(key)!
  }

  let totalExercises = 0
  let newExercises = 0
  let supersetMismatches = 0

  const phases: ParsedPhase[] = phaseGroups.map((pg, phaseIdx) => {
    // Find distinct day_labels in order of first appearance (by day_num)
    const dayOrder = new Map<string, number>()  // day_label → first day_num seen
    for (const e of pg.entries) {
      if (!dayOrder.has(e.day_label)) dayOrder.set(e.day_label, e.day_num)
    }
    const dayLabels = [...dayOrder.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(d => d[0])

    const programmes: ParsedProgramme[] = dayLabels.map((dayLabel, dayIdx) => {
      const dayEntries = pg.entries.filter(e => e.day_label === dayLabel)

      // Group by (series, resolved name+variation) — each group is one programme_exercise
      type SlotKey = string
      const slotMap = new Map<SlotKey, ExerciseEntry[]>()
      for (const e of dayEntries) {
        const { name: effName, variation: effVariation } = resolveNameVariation(e)
        const key = `${e.series}|||${effName}|||${effVariation ?? ''}`
        if (!slotMap.has(key)) slotMap.set(key, [])
        slotMap.get(key)!.push(e)
      }

      // Sort slots by series order
      const sortedSlots = [...slotMap.entries()].sort((a, b) => {
        const seriesA = a[0].split('|||')[0]
        const seriesB = b[0].split('|||')[0]
        return seriesOrderKey(seriesA) - seriesOrderKey(seriesB)
      })

      const exercises: ParsedExercise[] = sortedSlots.map(([key, slotEntries], exIdx) => {
        const [series] = key.split('|||')
        const firstEntry = slotEntries[0]
        const { name: effName, variation: effVariation } = resolveNameVariation(firstEntry)

        const { superset_group, superset_order } = parseSeries(series)
        const repsParsed = parseReps(firstEntry.reps)

        // Collect (week, target_weight_kg) per week for this slot
        const weightByWeek = new Map<number, number | null>()
        for (const e of slotEntries) {
          const w = typeof e.target_weight_kg === 'number' ? e.target_weight_kg : null
          weightByWeek.set(e.week, w)
        }

        // Check if weight varies across weeks
        const weightValues = [...weightByWeek.values()]
        const isUniform = weightValues.every(v => v === weightValues[0])

        const num_sets = firstEntry.sets

        let sets: DbSet[]
        if (isUniform) {
          // One row per set_number, week_number = null
          sets = Array.from({ length: num_sets }, (_, i) => ({
            set_number: i + 1,
            week_number: null,
            target_weight: weightValues[0],
            ...repsParsed,
            load_type: 'absolute' as const,
            weight_status: firstEntry.weight_status ?? null,
            weight_basis: firstEntry.weight_basis ? (WEIGHT_BASIS_MAP[firstEntry.weight_basis] ?? null) : null,
            weight_confidence: firstEntry.confidence ? (CONFIDENCE_MAP[firstEntry.confidence] ?? null) : null,
          }))
        } else {
          // One row per (set_number, week_number)
          sets = []
          for (const [week, weight] of [...weightByWeek.entries()].sort((a, b) => a[0] - b[0])) {
            const weekEntry = slotEntries.find(e => e.week === week)
            const weekReps = weekEntry ? parseReps(weekEntry.reps) : repsParsed
            for (let s = 1; s <= num_sets; s++) {
              sets.push({
                set_number: s,
                week_number: week,
                target_weight: weight,
                ...weekReps,
                load_type: 'absolute' as const,
                weight_status: weekEntry?.weight_status ?? null,
                weight_basis: weekEntry?.weight_basis ? (WEIGHT_BASIS_MAP[weekEntry.weight_basis] ?? null) : null,
                weight_confidence: weekEntry?.confidence ? (CONFIDENCE_MAP[weekEntry.confidence] ?? null) : null,
              })
            }
          }
        }

        const match = getMatch(effName, effVariation)
        const isNew = !match
        totalExercises++
        if (isNew) newExercises++

        const equipment = resolveEquipment(firstEntry, effName, effVariation)
        const muscle_group = firstEntry.body_region ? [firstEntry.body_region] : null

        return {
          exercise_name: effName,
          variation: effVariation,
          matched_exercise_id: match?.id ?? null,
          matched_exercise_name: match?.name ?? null,
          matched_exercise_variation: match?.variation ?? null,
          is_new: isNew,
          equipment,
          muscle_group,
          order_index: exIdx,
          superset_group,
          superset_order,
          slot_role: SLOT_ROLE_MAP[firstEntry.slot_role] ?? null,
          prescription_type: repsParsed.prescription_type,
          num_sets,
          load_scheme: firstEntry.load_scheme ?? 'equal',
          ramp_end_percent: firstEntry.load_scheme === 'ramp' ? (firstEntry.ramp_end_percent ?? null) : null,
          tempo: firstEntry.tempo ?? null,
          rest_seconds: firstEntry.rest_sec ?? null,
          notes: firstEntry.notes ?? null,
          sets,
          superset_set_count_mismatch: false,  // computed below, once every exercise for this day exists
        }
      })

      // Flag superset groups whose member exercises don't all agree on num_sets. Never a
      // block -- the logger runs the combined-screen round view for the lower count and
      // the longer exercise's leftover sets are logged on their own. Only set count is
      // expected to match within a superset; reps/tempo/rest/load_scheme are legitimately
      // per-exercise and never shared or merged.
      const setsByGroup = new Map<string, Set<number>>()
      for (const ex of exercises) {
        if (!ex.superset_group) continue
        if (!setsByGroup.has(ex.superset_group)) setsByGroup.set(ex.superset_group, new Set())
        setsByGroup.get(ex.superset_group)!.add(ex.num_sets)
      }
      const mismatchedGroups = new Set(
        [...setsByGroup.entries()].filter(([, sizes]) => sizes.size > 1).map(([g]) => g)
      )
      for (const ex of exercises) {
        ex.superset_set_count_mismatch = ex.superset_group ? mismatchedGroups.has(ex.superset_group) : false
        if (ex.superset_set_count_mismatch) supersetMismatches++
      }

      return { name: dayLabel, order_index: dayIdx + 1, exercises }
    })

    return { phase_label: pg.label, order_index: phaseIdx, programmes }
  })

  return {
    block: {
      name: plan.plan_name,
      athlete_name: plan.athlete ?? null,
      model_name: plan.model_name ?? null,
      cycle_number: plan.cycle_number ?? null,
      weeks_total: plan.weeks_total,
      days_per_week: plan.days_per_week,
      plan_generated_date: plan.generated_date ?? null,
      target_priority_regions: plan.target_priority_regions ?? [],
      constraints: plan.constraints ?? [],
      peaking_focus: plan.peaking_focus ?? null,
    },
    phases,
    stats: {
      phase_count: phases.length,
      programme_count: phases.reduce((n, p) => n + p.programmes.length, 0),
      exercise_count: totalExercises,
      new_exercise_count: newExercises,
      matched_exercise_count: totalExercises - newExercises,
      // counts exercise rows flagged, not groups -- a mismatched pair counts as 2
      superset_mismatch_count: supersetMismatches,
    },
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { plan, preview = false } = body as { plan: Plan; preview?: boolean }

  // Validate against the schema
  let validate: ReturnType<Ajv['compile']>
  try {
    validate = getValidator()
  } catch {
    return NextResponse.json({ error: 'Schema file not found. Make sure unified-training-plan.schema.json is in the project root.' }, { status: 500 })
  }

  const valid = validate(plan)
  if (!valid) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ')
    return NextResponse.json({ error: `Invalid plan format: ${errors}` }, { status: 422 })
  }

  // Fetch every exercise visible to this user for fuzzy matching (global library, migration 002)
  const { data: existingExercises } = await supabase
    .from('exercises')
    .select('id, name, variation')

  const result = parsePlan(plan, existingExercises ?? [])

  // Does this user already have an active block? Determines whether the new block saves
  // as 'active' (and its first phase with it) or 'planned'/"Up next" (migration 005's
  // single-active-block rule). Computed for preview too, since it's a cheap read and the
  // save path needs the same answer.
  const { data: existingActiveBlock } = await supabase
    .from('training_blocks')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  const willBeActive = !existingActiveBlock

  if (preview) {
    return NextResponse.json({ ...result, will_be_active: willBeActive })
  }

  // ── Save to database ──────────────────────────────────────────────────────

  // 1. Create training block
  const { data: block, error: blockErr } = await supabase
    .from('training_blocks')
    .insert({
      user_id: user.id,
      name: result.block.name,
      athlete_name: result.block.athlete_name,
      model_name: result.block.model_name,
      cycle_number: result.block.cycle_number,
      weeks_total: result.block.weeks_total,
      days_per_week: result.block.days_per_week,
      plan_generated_date: result.block.plan_generated_date,
      target_priority_regions: result.block.target_priority_regions,
      constraints: result.block.constraints,
      peaking_label: result.block.peaking_focus?.label ?? null,
      peaking_reason: result.block.peaking_focus?.reason ?? null,
      peaking_replaces: result.block.peaking_focus?.replaces ?? null,
      status: willBeActive ? 'active' : 'planned',
    })
    .select('id')
    .single()

  if (blockErr || !block) {
    return NextResponse.json({ error: 'Failed to create block' }, { status: 500 })
  }

  // 2. Deduplicate new exercises across the whole plan (by name+variation), create them
  const newExercisesByKey = new Map<string, { name: string; variation: string | null; equipment: string | null; muscle_group: string[] | null }>()
  for (const phase of result.phases) {
    for (const prog of phase.programmes) {
      for (const ex of prog.exercises) {
        if (ex.is_new) {
          const key = `${ex.exercise_name}|||${ex.variation ?? ''}`
          if (!newExercisesByKey.has(key)) {
            newExercisesByKey.set(key, { name: ex.exercise_name, variation: ex.variation, equipment: ex.equipment, muscle_group: ex.muscle_group })
          }
        }
      }
    }
  }

  const exerciseIdMap = new Map<string, string>()  // "name|||variation" key → db id

  // Seed with already-matched exercises
  for (const phase of result.phases) {
    for (const prog of phase.programmes) {
      for (const ex of prog.exercises) {
        if (!ex.is_new && ex.matched_exercise_id) {
          exerciseIdMap.set(`${ex.exercise_name}|||${ex.variation ?? ''}`, ex.matched_exercise_id)
        }
      }
    }
  }

  // Insert new exercises (deduplicated), populating muscle_group/equipment -- leaving
  // these blank was a real bug in an earlier build.
  if (newExercisesByKey.size > 0) {
    const toInsert = [...newExercisesByKey.values()].map(e => ({
      name: e.name,
      variation: e.variation,
      is_custom: true,
      created_by_user_id: user.id,
      muscle_group: e.muscle_group,
      equipment: e.equipment,
    }))
    const { data: created, error: exErr } = await supabase
      .from('exercises')
      .insert(toInsert)
      .select('id, name, variation')

    if (exErr || !created) {
      return NextResponse.json({ error: 'Failed to create exercises' }, { status: 500 })
    }
    for (const ex of created) {
      exerciseIdMap.set(`${ex.name}|||${ex.variation ?? ''}`, ex.id)
    }
  }

  // 3. Create peak lifts (fuzzy-match peaking_focus.label against all exercises, by name
  // only -- a label names a lift in general, not a specific variant). The raw label and
  // reason/replaces are already stored on training_blocks above regardless of whether a
  // match is found here, so nothing is lost if the label doesn't match any exercise.
  if (result.block.peaking_focus?.label) {
    const allExercises: Array<{ id: string; name: string }> = [
      ...(existingExercises ?? []),
      ...[...newExercisesByKey.entries()].map(([key, e]) => ({ id: exerciseIdMap.get(key)!, name: e.name })),
    ]
    // Label might be "Dip / Leg Press" — try each part
    const labelParts = result.block.peaking_focus.label.split(/\s*\/\s*/)
    const peakLiftInserts: Array<{ block_id: string; exercise_id: string; order_index: number }> = []
    let idx = 0
    for (const part of labelParts) {
      const match = findBestMatch(part.trim(), allExercises)
      if (match) {
        peakLiftInserts.push({ block_id: block.id, exercise_id: match.id, order_index: idx++ })
      }
    }
    if (peakLiftInserts.length > 0) {
      await supabase.from('training_block_peak_lifts').insert(peakLiftInserts)
    }
  }

  // 4. Create phases, programmes, exercises, sets
  for (const phase of result.phases) {
    const { data: dbPhase, error: phaseErr } = await supabase
      .from('training_block_phases')
      .insert({
        block_id: block.id,
        order_index: phase.order_index,
        phase_label: phase.phase_label,
        status: willBeActive && phase.order_index === 0 ? 'active' : 'planned',
      })
      .select('id')
      .single()

    if (phaseErr || !dbPhase) {
      return NextResponse.json({ error: 'Failed to create phase' }, { status: 500 })
    }

    for (const prog of phase.programmes) {
      const { data: dbProg, error: progErr } = await supabase
        .from('programmes')
        .insert({
          user_id: user.id,
          name: prog.name,
          phase_id: dbPhase.id,
          status: 'active',
          order_index: prog.order_index,
        })
        .select('id')
        .single()

      if (progErr || !dbProg) {
        return NextResponse.json({ error: 'Failed to create programme' }, { status: 500 })
      }

      for (const ex of prog.exercises) {
        const exerciseId = exerciseIdMap.get(`${ex.exercise_name}|||${ex.variation ?? ''}`)
        if (!exerciseId) continue

        const { data: dbEx, error: exErr } = await supabase
          .from('programme_exercises')
          .insert({
            programme_id: dbProg.id,
            exercise_id: exerciseId,
            order_index: ex.order_index,
            num_sets: ex.num_sets,
            superset_group: ex.superset_group,
            superset_order: ex.superset_order,
            slot_role: ex.slot_role,
            prescription_type: ex.prescription_type,
            tempo: ex.tempo,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            load_scheme: ex.load_scheme,
            ramp_end_percent: ex.ramp_end_percent,
          })
          .select('id')
          .single()

        if (exErr || !dbEx) {
          return NextResponse.json({ error: 'Failed to create programme exercise' }, { status: 500 })
        }

        if (ex.sets.length > 0) {
          const setsToInsert = ex.sets.map(s => ({
            programme_exercise_id: dbEx.id,
            set_number: s.set_number,
            week_number: s.week_number,
            target_weight: s.target_weight,
            target_reps_min: s.target_reps_min,
            target_reps_max: s.target_reps_max,
            target_duration_seconds: s.target_duration_seconds,
            set_type: s.set_type,
            load_type: s.load_type,
            weight_status: s.weight_status,
            weight_basis: s.weight_basis,
            weight_confidence: s.weight_confidence,
          }))
          const { error: setsErr } = await supabase.from('programme_sets').insert(setsToInsert)
          if (setsErr) {
            return NextResponse.json({ error: 'Failed to create programme sets' }, { status: 500 })
          }
        }
      }
    }
  }

  return NextResponse.json({ blockId: block.id })
}
