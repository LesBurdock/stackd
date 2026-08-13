-- Migration: wipe all programme/training data, then bring the schema up to date
-- Keeps: auth.users (Supabase-managed) and your profiles row — login stays intact.
-- Wipes: every programme, block, phase, session, and exercise. Nothing here is guarded
-- or reversible — this is a deliberate fresh start, not a cautious partial migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Wipe all programme/training/exercise data
-- ─────────────────────────────────────────────────────────────────────────────

truncate table
  logged_sets,
  session_exercises,
  workout_sessions,
  programme_sets,
  programme_exercises,
  programmes,
  training_block_goals,
  training_block_peak_lifts,
  training_block_phases,
  training_blocks,
  exercises
cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Bring the schema up to date. Tables are now empty, so every addition below
--    applies instantly — no backfill, no constraint conflicts to worry about.
-- ─────────────────────────────────────────────────────────────────────────────

-- training_blocks: provenance + specialization fields
alter table training_blocks
  add column if not exists model_name text,
  add column if not exists cycle_number int,
  add column if not exists target_priority_regions text[],
  add column if not exists constraints text[],
  add column if not exists athlete_name text,
  add column if not exists plan_generated_date date,
  add column if not exists weeks_total int,
  add column if not exists days_per_week int;

-- programme_exercises: duration-based prescriptions + slot classification
alter table programme_exercises
  add column if not exists prescription_type text not null default 'reps'
    check (prescription_type in ('reps', 'duration')),
  add column if not exists slot_role text
    check (slot_role in ('warmup_primer', 'primary_compound', 'secondary_compound', 'accessory_isolation', 'finisher_isolation'));

-- programme_sets: duration targets, weight provenance, per-week progression
alter table programme_sets
  add column if not exists target_duration_seconds int,
  add column if not exists weight_status text,
  add column if not exists weight_basis text
    check (weight_basis in ('direct_1rm', 'inferred_similar_exercise', 'estimated_heuristic')),
  add column if not exists weight_confidence text
    check (weight_confidence in ('high', 'medium', 'low')),
  add column if not exists week_number int;
  -- week_number: null = this prescription applies to every week of the phase uniformly.
  -- Populated = week-specific; one row per (set_number, week_number) pair spanning the phase.

-- workout_sessions: which week of the phase this session represents (suggested, editable)
alter table workout_sessions
  add column if not exists week_number int;

-- logged_sets: duration-based logging, reps no longer always required
alter table logged_sets
  add column if not exists duration_seconds int;

alter table logged_sets
  alter column reps drop not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. exercises is now empty and ready to populate purely through import
-- matching + manual custom entries, per the updated plan.
-- ─────────────────────────────────────────────────────────────────────────────
