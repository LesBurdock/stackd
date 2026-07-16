# Strength training app — project brief

A personal strength-training web app: design multi-week/multi-phase training programmes, log workouts at the gym, and track progress over time. Built for a single primary user (kg only, no multi-currency/unit concerns), but the schema supports multiple accounts.

Full UI reference mockups are in `strength-app-ui-mockups.html` (open in a browser) — covers most screens described below, though it predates the phase/programme structure change (Section on screens below) and doesn't yet have a dedicated **Phase detail** screen — Claude Code should design that one fresh, following the same visual style as the other drill-in screens in the file.

## Tech stack (decided — do not re-litigate)

- **Frontend + API**: Next.js (App Router), API routes in the same codebase
- **Hosting**: Vercel, Hobby (free) tier
- **Database + Auth**: Supabase (Postgres + Supabase Auth), a **new, separate Supabase project** — do not reuse any existing project
- **Charting**: Chart.js (see Progress screen)
- **Styling**: plain CSS or Tailwind, mobile-responsive from the start (this is a web app used on a phone at the gym, not a native app)

Auth: Supabase Auth's client SDK handles signup/login/session directly — no custom auth API routes needed. A single login screen toggles between "Log in" and "Sign up" (no separate pages).

---

## Core design principles (apply these everywhere, not just where stated)

1. **Suggestions, never locks.** Every planned value — target weight, reps, rest duration, even exercise order — is a pre-filled, editable suggestion in the Workout Logger. Nothing is ever locked. The user can always override in the moment.
2. **Plan vs. actual are separate tables.** `programmes`/`programme_exercises`/`programme_sets` are the template (design time). `workout_sessions`/`session_exercises`/`logged_sets` are what actually happened (gym time). Never conflate these — logging a real weight must never overwrite the plan.
3. **No freestyle logging.** Every `workout_sessions` row requires a `programme_id`. Every `session_exercises` row requires a `programme_exercise_id`. No ad-hoc exercises added mid-workout, no sessions without a linked programme.
4. **Superset pairing is visual/organizational, not an execution lock.** Two exercises sharing a `superset_group` render on **one combined screen** in the Workout Logger (both exercises' full set lists stacked together), so the user can either alternate between them set-by-set or do all of one then all of the other — same screen supports both without forcing either.
5. **Status changes are always manual, never automatic.** Archiving a programme, reactivating one, advancing a training block phase, marking a goal achieved — all user-initiated taps, never background/timer-driven.
6. **Training blocks are the primary structure; standalone programmes are the exception.** The Programmes home screen shows blocks first as prominent cards; standalone programmes sit in a smaller, de-emphasized list below.
7. **kg only.** No unit conversion, no `unit_preference` field anywhere.
8. **Bodyweight exercises use the same fields as everything else.** `weight` just means "added load" — 0 or blank for pure bodyweight, a real number for weighted variations (e.g. weighted pull-ups). No special-cased schema.
9. **A block phase can hold several concurrent programmes.** A "Accumulation" phase might have Upper, Lower, and Full body all running side by side (different days of the week) — not one programme per phase. Advancing a phase moves every programme in it forward together, in one action, not one at a time.
10. **No numeric cap on active programmes.** An earlier version of this plan capped "active" programmes at 3-4 to avoid clutter. That's gone — a phase with several concurrent programmes made the cap meaningless, and blocks already prevent clutter visually (one summary card regardless of how much is inside). Reactivating or creating a programme is never blocked.

---

## Database schema (Supabase / Postgres — run as migrations in this order)

```sql
-- profiles: app-specific fields Supabase Auth doesn't own
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- exercises: seeded global library + user-added custom exercises
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

-- training_blocks: a named periodized training cycle
create table training_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz not null default now()
);

-- training_block_phases: one phase of a block (e.g. Accumulation). Several programmes can share a phase.
create table training_block_phases (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  order_index int not null default 0,
  phase_label text not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'archived'))
);

-- training_block_goals: freeform text goals, manually checked off
create table training_block_goals (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  description text not null,
  order_index int not null default 0,
  achieved boolean not null default false,
  achieved_at timestamptz
);

-- training_block_peak_lifts: which exercises this block is peaking, chosen at block creation
create table training_block_peak_lifts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

-- programmes: a training plan/template. Either standalone (phase_id null) or belongs to a block phase.
-- Several programmes can share the same phase_id (e.g. Upper, Lower, Full body all in one phase).
-- status is ONLY meaningful for standalone programmes (phase_id null) -- phase-linked programmes
-- take their active/archived state entirely from training_block_phases.status instead.
create table programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  phase_id uuid references training_block_phases(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- programme_exercises: an exercise within a programme, with ordering, superset grouping, and load scheme
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
  notes text
);

-- programme_sets: the planned/target sets. One row per set, generated from num_sets + load_scheme.
create table programme_sets (
  id uuid primary key default gen_random_uuid(),
  programme_exercise_id uuid not null references programme_exercises(id) on delete cascade,
  set_number int not null,
  target_weight numeric,
  target_reps_min int,
  target_reps_max int,
  target_rir int,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'dropset', 'amrap')),
  load_type text not null default 'absolute' check (load_type in ('absolute', 'percent_of_reference_set', 'percent_of_1rm')),
  load_percent numeric,
  reference_set_number int
);

-- workout_sessions: one gym visit, an instance of a programme being performed
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  programme_id uuid not null references programmes(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned'))
);

-- session_exercises: an exercise as actually performed in a session
create table session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  programme_exercise_id uuid not null references programme_exercises(id),
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

-- logged_sets: the actual weight/reps logged. This is the raw material for history/progress.
create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references session_exercises(id) on delete cascade,
  programme_set_id uuid references programme_sets(id),
  set_number int not null,
  weight numeric not null default 0,
  reps int not null,
  rir int,
  rpe int
);
```

---

## Row Level Security — enable on every table, no exceptions

RLS is the real security boundary here, not the API routes. Apply to every table above. All policies scope to `auth.uid()`.

### Direct-owned tables (`programmes`, `workout_sessions`, `training_blocks`)

Same four-policy shape per table:

```sql
alter table programmes enable row level security;

create policy "select own" on programmes for select using (user_id = auth.uid());
create policy "insert own" on programmes for insert with check (user_id = auth.uid());
create policy "update own" on programmes for update using (user_id = auth.uid());
create policy "delete own" on programmes for delete using (user_id = auth.uid());
```

Repeat identically for `workout_sessions` and `training_blocks`.

### `profiles`

```sql
alter table profiles enable row level security;

create policy "select own profile" on profiles for select using (id = auth.uid());
create policy "update own profile" on profiles for update using (id = auth.uid());
```

### Single-hop indirect tables (owned via one parent join)

Applies to `programme_exercises` (via `programmes`), `session_exercises` (via `workout_sessions`), `training_block_goals`, `training_block_peak_lifts`, and `training_block_phases` (via `training_blocks`):

```sql
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
```

Apply the same shape to the other four tables, swapping the join target (`workout_sessions` for `session_exercises`; `training_blocks` for the three block child tables).

### Two-hop indirect tables (`programme_sets`, `logged_sets`)

```sql
alter table programme_sets enable row level security;

create policy "select own" on programme_sets for select using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
-- repeat for insert (with check), update, delete
```

Same shape for `logged_sets`, joining through `session_exercises` → `workout_sessions`.

### `exercises` — mixed public/private table

```sql
alter table exercises enable row level security;

create policy "view global or own custom" on exercises for select using (
  is_custom = false or created_by_user_id = auth.uid()
);
create policy "insert own custom" on exercises for insert with check (
  is_custom = true and created_by_user_id = auth.uid()
);
create policy "update own custom" on exercises for update using (created_by_user_id = auth.uid());
create policy "delete own custom" on exercises for delete using (created_by_user_id = auth.uid());
```

Custom exercises are private per-user by default — this is deliberate, not a gap.

---

## API routes — only where real logic lives

Everything else (reading lists, editing a name, toggling a goal) goes straight through the Supabase client from the frontend, protected by RLS above. Don't write custom CRUD routes for simple reads/writes.

| Method & route | Purpose | Logic required |
|---|---|---|
| `POST /api/programmes/[id]/exercises` | Add exercise to programme | Generate `programme_sets` rows from `num_sets`; compute ramp interpolation if `load_scheme = 'ramp'` (linear steps from set 1 to `1 + ramp_end_percent/100`) |
| `PATCH /api/programme-exercises/[id]` | Edit sets/reps/load scheme | Add/remove `programme_sets` rows and recompute ramp percentages if `num_sets` or `load_scheme` changes |
| `POST /api/blocks` | Create a training block | Create `training_blocks` row + initial `training_block_peak_lifts` rows together |
| `POST /api/blocks/[id]/phases` | Add the next phase to a block | Auto-compute `order_index` (max existing + 1); set new phase's `status` to `active` if it's the block's first phase, else `planned` |
| `POST /api/phases/[id]/programmes` | Add a programme to a phase | Create `programmes` row with `phase_id` set — several can share one phase (Upper, Lower, Full body) |
| `POST /api/phases/[id]/advance` | Move to next phase | Atomically: current active phase → `archived`, next `planned` phase (lowest `order_index`) → `active`. Since every `programmes` row in a phase shares that phase's status, this moves all concurrent programmes in it forward together |
| `POST /api/sessions` | Start a workout | Given `programme_id`, create `workout_sessions` row + one `session_exercises` row per `programme_exercises` row in that programme |
| `POST /api/sessions/[id]/sets` | Log a set | Insert `logged_sets` row; compute and return the suggested weight for the *next* set in the ramp: `reference_weight * (load_percent / 100)`, rounded to `exercises.rounding_increment` |
| `PATCH /api/sessions/[id]` | Finish or abandon session | Set `completed_at` + `status`; available at any point, not gated on reaching the last exercise |
| `GET /api/exercises/[id]/history?metric=1rm\|volume\|intensity` | Progress chart data | Join `logged_sets` → `session_exercises` → `workout_sessions`, group by session, compute 1RM (Epley: `weight * (1 + reps/30)`), volume (`Σ weight*reps`), or intensity (`weight / estimated_1rm`), ordered by `workout_sessions.completed_at` |

Reactivating an archived standalone programme and bulk-archiving are **not** custom routes anymore — no cap to check, so they're plain Supabase client calls (a status update, or an `update ... where id in (...)`).

---

## Screens (see `strength-app-ui-mockups.html` for visual reference)

1. **Login / sign up** — single screen, toggle between modes
2. **Programmes home** — blocks primary (progress bar + current phase), standalone programmes secondary/quiet list, bottom nav (Programmes / Progress), settings gear icon. First-time empty state: "Start your first training block" as the primary CTA
3. **Training block detail** — name, peak lifts line ("Peaking: Squat, Overhead press"), freeform checkable goals, phase progress tracker (segmented bar), ordered phase list with status badges, "+ Add phase"
4. **Phase detail** — tapping a phase shows its concurrent programmes (e.g. Upper, Lower, Full body listed together), "+ Add programme" to add another to this phase, and the one-tap "finished this phase, start the next?" action that moves every programme in the phase forward together
5. **Programme detail** — read-only: sessions-completed count, exercise list with superset grouping shown, "Start workout" (primary) and "Edit" (secondary) actions
6. **Exercise library** — search, equipment filter chips, list with "Custom" badges, "+ Add custom exercise". Doubles as the picker when adding an exercise to a programme
7. **Programme Builder** — add/reorder exercises; per-exercise form: sets, rep range, load scheme (equal/ramp toggle), tempo, rest, superset assignment
8. **Workout Logger** — exercise chips for free navigation; supersets render as one combined screen (both exercises stacked); each set row shows last-time reference + editable weight/reps/RIR + live estimated 1RM; rest timer with sound; "Next exercise" advances the suggested order; "Finish workout" is a persistent header link, not tied to any exercise
9. **Progress** — exercise dropdown, 1RM/Volume/Intensity toggle switching the chart, headline stat card, recent-sessions list
10. **Archived programmes** — flat list, "Reactivate" per row — no cap to block against
11. **Settings** — display name, sign out

Two screens not yet designed (flagged as open, use judgment or ask if unclear): the custom exercise creation form, and resuming an interrupted (`status = 'in_progress'`) workout session.

---

## Build order

**Phase 1 — Core loop**
Supabase project + full schema + RLS (above) → Next.js scaffold on Vercel → auth → exercise library (seeded) → Programme Builder → Workout Logger → basic history table (no chart yet).

**Phase 2 — Progress & polish**
Progress chart (1RM/Volume/Intensity) → live last-time reference + live 1RM in logger → RIR → rest timer sound → bulk archive → custom exercise creation → keep-alive cron (Supabase free-tier project pauses after 7 days idle).

**Phase 3 — Nice to haves**
RPE, richer exercise library (categories/filters), programme duplication, CSV export.

Note: training blocks (with phases holding several concurrent programmes) should be built in **Phase 1**, not deferred — the `phase_id` field is part of the core `programmes` table shape from the start, so retrofitting it later would mean an awkward migration.

---

## Seed data needed

`exercises` table needs ~50-100 seeded rows (`is_custom = false`, `created_by_user_id = null`) before the app is usable — squat, bench, deadlift, OHP, rows, curls, and common variations. Not included here; generate a reasonable starter set covering barbell/dumbbell/bodyweight across major muscle groups.
