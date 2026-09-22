-- One-time schema bootstrap for the stackd-test Supabase project.
--
-- NOT a numbered migration (migration-00N-*.sql) -- those track changes applied to
-- PRODUCTION over time. This file instead stands up a brand-new, empty test project
-- to match production's CURRENT actual shape: migration-001-unify-schema.sql already
-- applied there, migrations 002/003/004 still pending. So:
--   - every table below matches the "Database schema" section of CLAUDE.md, EXCEPT
--     `exercises.variation` is omitted -- that column is added by migration-004
--     (`alter table exercises add column if not exists variation text;`), which
--     hasn't run on production yet, so production's real `exercises` table doesn't
--     have it either. Confirmed live: the export query against production errored
--     with "column variation does not exist" until this was corrected.
--   - every table's RLS matches the documented RLS section exactly, EXCEPT `exercises`,
--     which uses the ORIGINAL pre-002 policy (production hasn't run 002 yet, so its
--     exercises table is still per-account-scoped, not global)
--
-- Run this once, in full, in the stackd-test project's SQL Editor. Safe to run against
-- an empty project -- there is no guard here because there is nothing to protect yet.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  muscle_group text[],
  equipment text,
  default_rest_seconds int not null default 90,
  rounding_increment numeric not null default 2.5,
  is_custom boolean not null default false,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table training_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  model_name text,
  cycle_number int,
  target_priority_regions text[],
  constraints text[],
  athlete_name text,
  plan_generated_date date,
  weeks_total int,
  days_per_week int,
  created_at timestamptz not null default now()
);

create table training_block_phases (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  order_index int not null default 0,
  phase_label text not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'archived'))
);

create table training_block_goals (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  description text not null,
  order_index int not null default 0,
  achieved boolean not null default false,
  achieved_at timestamptz
);

create table training_block_peak_lifts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

create table programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  phase_id uuid references training_block_phases(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table programme_exercises (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0,
  num_sets int not null default 1,
  superset_group text,
  superset_order int,
  tempo text,
  rest_seconds int,
  load_scheme text not null default 'equal' check (load_scheme in ('equal', 'ramp')),
  ramp_end_percent numeric,
  prescription_type text not null default 'reps' check (prescription_type in ('reps', 'duration')),
  slot_role text check (slot_role in ('warmup_primer', 'primary_compound', 'secondary_compound', 'accessory_isolation', 'finisher_isolation')),
  notes text
);

create table programme_sets (
  id uuid primary key default gen_random_uuid(),
  programme_exercise_id uuid not null references programme_exercises(id) on delete cascade,
  set_number int not null,
  target_weight numeric,
  target_reps_min int,
  target_reps_max int,
  target_duration_seconds int,
  target_rir int,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'dropset', 'amrap')),
  load_type text not null default 'absolute' check (load_type in ('absolute', 'percent_of_reference_set', 'percent_of_1rm')),
  load_percent numeric,
  reference_set_number int,
  weight_status text,
  weight_basis text check (weight_basis in ('direct_1rm', 'inferred_similar_exercise', 'estimated_heuristic')),
  weight_confidence text check (weight_confidence in ('high', 'medium', 'low')),
  week_number int
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  programme_id uuid not null references programmes(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  week_number int
);

create table session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  programme_exercise_id uuid not null references programme_exercises(id),
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references session_exercises(id) on delete cascade,
  programme_set_id uuid references programme_sets(id),
  set_number int not null,
  weight numeric not null default 0,
  reps int,
  duration_seconds int,
  rir int,
  rpe int
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS -- direct-owned tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table programmes enable row level security;
create policy "select own" on programmes for select using (user_id = auth.uid());
create policy "insert own" on programmes for insert with check (user_id = auth.uid());
create policy "update own" on programmes for update using (user_id = auth.uid());
create policy "delete own" on programmes for delete using (user_id = auth.uid());

alter table workout_sessions enable row level security;
create policy "select own" on workout_sessions for select using (user_id = auth.uid());
create policy "insert own" on workout_sessions for insert with check (user_id = auth.uid());
create policy "update own" on workout_sessions for update using (user_id = auth.uid());
create policy "delete own" on workout_sessions for delete using (user_id = auth.uid());

alter table training_blocks enable row level security;
create policy "select own" on training_blocks for select using (user_id = auth.uid());
create policy "insert own" on training_blocks for insert with check (user_id = auth.uid());
create policy "update own" on training_blocks for update using (user_id = auth.uid());
create policy "delete own" on training_blocks for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS -- profiles
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles enable row level security;
create policy "select own profile" on profiles for select using (id = auth.uid());
create policy "update own profile" on profiles for update using (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS -- single-hop indirect tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table programme_exercises enable row level security;
create policy "select own" on programme_exercises for select using (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);
create policy "insert own" on programme_exercises for insert with check (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);
create policy "update own" on programme_exercises for update using (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);
create policy "delete own" on programme_exercises for delete using (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);

alter table session_exercises enable row level security;
create policy "select own" on session_exercises for select using (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);
create policy "insert own" on session_exercises for insert with check (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);
create policy "update own" on session_exercises for update using (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);
create policy "delete own" on session_exercises for delete using (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);

alter table training_block_goals enable row level security;
create policy "select own" on training_block_goals for select using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);
create policy "insert own" on training_block_goals for insert with check (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);
create policy "update own" on training_block_goals for update using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);
create policy "delete own" on training_block_goals for delete using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);

alter table training_block_peak_lifts enable row level security;
create policy "select own" on training_block_peak_lifts for select using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);
create policy "insert own" on training_block_peak_lifts for insert with check (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);
create policy "update own" on training_block_peak_lifts for update using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);
create policy "delete own" on training_block_peak_lifts for delete using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);

alter table training_block_phases enable row level security;
create policy "select own" on training_block_phases for select using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);
create policy "insert own" on training_block_phases for insert with check (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);
create policy "update own" on training_block_phases for update using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);
create policy "delete own" on training_block_phases for delete using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS -- two-hop indirect tables
-- ─────────────────────────────────────────────────────────────────────────────

alter table programme_sets enable row level security;
create policy "select own" on programme_sets for select using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
create policy "insert own" on programme_sets for insert with check (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
create policy "update own" on programme_sets for update using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
create policy "delete own" on programme_sets for delete using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);

alter table logged_sets enable row level security;
create policy "select own" on logged_sets for select using (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);
create policy "insert own" on logged_sets for insert with check (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);
create policy "update own" on logged_sets for update using (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);
create policy "delete own" on logged_sets for delete using (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS -- exercises (PRE-002 policy -- per-account scoped, not global)
-- ─────────────────────────────────────────────────────────────────────────────

alter table exercises enable row level security;

create policy "view global or own custom" on exercises for select using (
  is_custom = false or created_by_user_id = auth.uid()
);
create policy "insert own custom" on exercises for insert with check (
  is_custom = true and created_by_user_id = auth.uid()
);
create policy "update own custom" on exercises for update using (created_by_user_id = auth.uid());
create policy "delete own custom" on exercises for delete using (created_by_user_id = auth.uid());
