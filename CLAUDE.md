# Strength training app — project brief

A personal strength-training web app: design multi-week/multi-phase training programmes, log workouts at the gym, and track progress over time. Built for a single primary user (kg only, no multi-currency/unit concerns), but the schema supports multiple accounts.

**This file was updated after real building had already started.** If you're picking this up mid-project: run `migration-001-unify-schema.sql` against the live Supabase project first — it **wipes all existing programme/block/session/exercise data** (deliberate — decided there's nothing worth preserving from the earlier build) while keeping your login/`profiles` row intact, then adds the new columns to bring the schema in line with what's below. The "Build order" section further down still reflects real progress on the *code/screens* side (✅ marks, actual routes) — don't re-build anything marked complete, and treat the schema/principles/routes sections above it as the current target state.

Keep `unified-training-plan.schema.json` in the project root — it's the formal JSON Schema for any importable training plan; the `/api/blocks/import-json` route validates against it directly with Ajv (see API routes below).

Full UI reference mockups are in `strength-app-ui-mockups.html` (open in a browser) — includes an Import preview screen (from an earlier design pass that also had a paste-text option; that option is dropped, see below), but predates the phase/programme structure change, the file-based JSON import becoming the *only* import path, the week_number addition, and import becoming the primary creation path. It doesn't yet have a **Phase detail** screen or the **"Which week is this?"** step that should appear at the start of the Workout Logger for programmes with week-specific `programme_sets` (see Screens, item 9) — design both fresh, following the same visual style as the other screens in the file (the existing Import preview screen is a good visual reference for the block-import preview, adapted to file-upload instead of paste; the week-suggestion step is a small, single-purpose prompt — a suggested number, editable, one confirm action). The **Programmes home empty state in the mockup file is also stale** — it shows "Start your first training block" as the primary CTA; per Screens item 2 below, that needs to become "Import your first plan" with manual block creation as the secondary link.

**No AI text importer.** An earlier draft of this plan included a second import path — paste freeform text, have Claude parse it via the API. That's been dropped: file-upload JSON import (`/api/blocks/import-json`) against `unified-training-plan.schema.json` is the only import method. No `ANTHROPIC_API_KEY`, no Claude API calls anywhere in this app.

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
11. **Duration-based exercises are first-class, not a workaround.** Planks, carries, and interval work are prescribed in seconds, not reps. `prescription_type` on `programme_exercises` switches between `'reps'` and `'duration'`; `target_reps_min`/`max` and `target_duration_seconds` are mutually exclusive based on it. `"MAX"` reps (e.g. max-effort chin-ups) don't need this at all — that's just `set_type = 'amrap'` with reps left null.
12. **One unified plan JSON schema.** `unified-training-plan.schema.json` (in the project root alongside this file) is the single source of truth for any importable plan — reps as ranges/durations/MAX, a warm-up slot role, optional block-level `model_name`/`cycle_number`/`peaking_focus`, and a documented "weight decided live at the gym" state instead of a pre-planned number. `/api/blocks/import-json` validates against this exact file with Ajv.
13. **Imports must be lossless — no plan data gets silently dropped or collapsed.** A plan where the weight genuinely changes every week (not just autoregulated within a session) is represented with `programme_sets.week_number`: null when a prescription applies uniformly across the whole phase, populated with one row per `(set_number, week_number)` when it varies weekly. `workout_sessions.week_number` (suggested from session count, always editable, same "suggestions, never lock" rule) tells the logger which week's rows to pull. Every other field an imported plan carries — athlete name, original generation date, stated weeks/days-per-week, weight provenance and confidence — has a real column, not a value that gets thrown away on import.
14. **Import is the primary way exercises enter the library, not a pre-seeded starter set.** `exercises` no longer gets pre-seeded (the migration wipes the earlier seeded rows along with all other programme data — see intro note above). Both real source plans use verbose, gym-specific compound names, so a generic seed list wouldn't match well anyway. Every import matches against whatever's already in the user's library and creates new entries for anything unmatched; on a first-ever import that's everything, which is correct, not an error. Because names are this specific, exercise matching needs to be normalized/fuzzy, not exact-string comparison, or near-identical lifts across separate imports will keep spawning duplicates.
15. **Import is the primary programme-creation path, not a Phase 2 add-on.** The JSON file importer belongs in the core loop, not deferred to polish. The Programmes home first-time empty state leads with "Import your first plan," not manual block creation. The Programme Builder is still essential, but its expected role is editing an already-imported programme (fixing a misparsed exercise, adjusting sets/tempo/rest), not building one from a blank slate — building from scratch still works on the same screen, it's just no longer the default path a new user is nudged toward.

---

## Database schema (Supabase / Postgres — run as migrations in this order)

```sql
-- profiles: app-specific fields Supabase Auth doesn't own
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- exercises: NOT pre-seeded (the migration wipes all existing rows along with the rest of the
-- programme data — nothing preserved from the earlier build). Starts empty
-- on every account and grows organically via import matching (both importers) plus manual
-- "+ Add custom exercise". is_custom stays true for every row for now.
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
  prescription_type text not null default 'reps' check (prescription_type in ('reps', 'duration')),
  slot_role text check (slot_role in ('warmup_primer', 'primary_compound', 'secondary_compound', 'accessory_isolation', 'finisher_isolation')),
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
  -- week_number: null = this prescription applies to every week of the phase uniformly.
  -- Populated = week-specific; one row per (set_number, week_number) pair spanning the phase.
);

-- workout_sessions: one gym visit, an instance of a programme being performed
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  programme_id uuid not null references programmes(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  week_number int
  -- Only meaningful when the programme has week-specific programme_sets rows. Suggested (count of
  -- previously completed sessions of this programme within the current phase, +1), always editable.
);

-- session_exercises: an exercise as actually performed in a session
create table session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  programme_exercise_id uuid not null references programme_exercises(id),
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

-- logged_sets: the actual weight/reps/duration logged. This is the raw material for history/progress.
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
```

**These `create table` statements describe the current target shape, for reference — do not run them against the live project, the tables already exist.** Apply `migration-001-unify-schema.sql` instead, which truncates all existing programme/block/session/exercise data (login/`profiles` untouched) and then adds the new columns.

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
| `POST /api/blocks/import-json` | Import a whole training block from an uploaded `.json` file, losslessly | **No AI call — plain deterministic parsing.** Input is a **file upload** (`<input type="file" accept=".json">`, read client-side with `file.text()` → `JSON.parse()`), not pasted text. **Validate with Ajv against `unified-training-plan.schema.json`** (in the project root) before mapping anything. Once valid, map: `plan_name`→seeds `training_blocks.name`, `athlete`→`.athlete_name`, `generated_date`→`.plan_generated_date`, `weeks_total`→`.weeks_total`, `days_per_week`→`.days_per_week`, `model_name`→`.model_name`, `cycle_number`→`.cycle_number`, `peaking_focus.label`→name-matched `training_block_peak_lifts.exercise_id`, `.reason`→`.reason`, `.replaces`→`.replaces_note`, `target_priority_regions`→`training_blocks.target_priority_regions`, `constraints`→`training_blocks.constraints`, `mesocycle`→`training_block_phases.phase_label` (group consecutive rows sharing the same value into one phase; `duration_weeks` = count of distinct `week` values in that group), `day_num`+`day_label` grouped by `week`+`mesocycle`→one `programmes` row per distinct `day_label` with `phase_id` set to the parent phase — `day_num` itself is discarded after grouping, never stored, `series`→split into `superset_group`+`superset_order` (`"SIT"` → standalone, no group), `slot_role`→`programme_exercises.slot_role` directly, `exercise_name`→**not exact-string matched** against `exercises` — use normalized/fuzzy matching, since both plans use verbose compound names, `sets`→`num_sets`, `reps`→`target_reps_min`/`max` if integer or range, `target_duration_seconds`+`prescription_type='duration'` if a duration string, or `set_type='amrap'` with reps null if `"MAX"`, `tempo`/`rest_sec`→`tempo`/`rest_seconds` directly. **For `target_weight_kg`/`weight_status`/`weight_basis`/`confidence`**: compare values across all weeks for a given exercise slot — if identical throughout (autoregulated case), write **one** `programme_sets` row with `week_number = null`; if they vary by week, write **one row per `(set_number, week_number)` pair**, so no weekly value is ever dropped. `notes`→`programme_exercises.notes`. Imports every phase and every day-as-programme in the file, not a single programme — same preview-before-save behavior as any import. |

Reactivating an archived standalone programme and bulk-archiving are **not** custom routes — no cap to check, so they're plain Supabase client calls (a status update, or an `update ... where id in (...)`).

---

## Screens (see `strength-app-ui-mockups.html` for visual reference)

1. **Login / sign up** — single screen, toggle between modes
2. **Programmes home** — blocks primary (progress bar + current phase), standalone programmes secondary/quiet list, bottom nav (Programmes / Progress), settings gear icon. First-time empty state: **"Import your first plan"** as the primary CTA (import is the primary creation path — see Build order), "or create a training block manually" as the secondary link
3. **Training block detail** — name, peak lifts line ("Peaking: Squat, Overhead press"), freeform checkable goals, phase progress tracker (segmented bar), ordered phase list with status badges, "+ Add phase"
4. **Phase detail** — tapping a phase shows its concurrent programmes (e.g. Upper, Lower, Full body listed together), "+ Add programme" to add another to this phase, and the one-tap "finished this phase, start the next?" action that moves every programme in the phase forward together
5. **Programme detail** — read-only: sessions-completed count, exercise list with superset grouping shown, "Start workout" (primary) and "Edit" (secondary) actions
6. **Exercise library** — search, equipment filter chips, list with "Custom" badges, "+ Add custom exercise". Doubles as the picker when adding an exercise to a programme. **No pre-seeding** — empty on a fresh account (or after the migration clears the old seeded rows), grows via import matching
7. **Programme Builder** — add/reorder exercises; per-exercise form: sets, rep range, load scheme (equal/ramp toggle), tempo, rest, superset assignment. **Primarily an editing surface now**, not the main creation path — reached after import to fix/adjust something; still fully usable for building from scratch, just not the default expectation
8. **Import training block (from file)** — the only import path: a `.json` file picker (`<input type="file" accept=".json">`, no text-paste option) → parses via `/api/blocks/import-json` → editable preview (flags unmatched exercises as "new custom exercise", highlighted) → "Save" or "Discard". Reached from Programmes home alongside "New Block", and as an option inside an empty phase or empty builder
9. **Workout Logger** — if the programme has any week-specific `programme_sets`, a suggested-and-editable "Which week is this?" step appears first (skipped entirely otherwise); exercise chips for free navigation; supersets render as one combined screen (both exercises stacked); each set row shows last-time reference + editable weight/reps/RIR + live estimated 1RM; rest timer with sound; "Next exercise" advances the suggested order; "Finish workout" is a persistent header link, not tied to any exercise
10. **Progress** — exercise dropdown, 1RM/Volume/Intensity toggle switching the chart, headline stat card, recent-sessions list
11. **Archived programmes** — flat list, "Reactivate" per row — no cap to block against
12. **Settings** — display name, sign out

Two screens not yet designed (flagged as open, use judgment or ask if unclear): the custom exercise creation form, and resuming an interrupted (`status = 'in_progress'`) workout session.

---

## Build order

**Phase 1 — Core loop** ✅ COMPLETE
- Supabase project + full schema + RLS ✅
- Next.js scaffold on Vercel ✅
- Auth (login/signup toggle) ✅
- Programmes home (blocks primary, standalone secondary, empty state) ✅
- Training block detail (goals, phases, peak lifts) ✅
- Phase detail (concurrent programmes, advance phase) ✅
- Exercise library / picker (`/exercises?addTo=<programmeId>`) ✅
- Programme Builder (`/programmes/[id]/edit`) — add/reorder/delete exercises, per-exercise form ✅
- Programme detail (`/programmes/[id]`) — read-only, superset grouping, Start workout ✅
- Workout Logger (`/sessions/[id]`) — set logging, rest timer, ramp suggestions, Finish ✅
- API routes: POST /api/sessions, PATCH /api/sessions/[id], POST /api/sessions/[id]/sets ✅
- API routes: POST /api/programmes/[id]/exercises, PATCH+DELETE /api/programme-exercises/[id] ✅

**Phase 2 — Progress & polish**
- Progress page with Chart.js (Est. 1RM / Volume / Max weight toggle, headline stats, recent sessions) ✅
- Edit logged sets (tap the tick to correct a typo) ✅
- iOS zoom fix on inputs (font-size: 16px global rule) ✅
- Delete programme + delete phase (with cascade warning) ✅
- Phase status toggle (Planned / Active / Done) ✅
- chart.js + react-chartjs-2 installed ✅
- JSON file import (`/import` → `POST /api/blocks/import-json`) ✅
- Programmes home: active-phase workouts listed under each block card with inline Start button ✅
- Workout logger: Next exercise button prominent, Finish early quiet; Finish workout prominent on last screen ✅
- After finishing a workout, redirect to `/programmes` home ✅
- Remaining, **in priority order**: rest timer sound → custom exercise creation → keep-alive cron

**Phase 3 — Nice to haves**
RPE, richer exercise library (categories/filters), programme duplication, CSV export.

Note: training blocks (with phases holding several concurrent programmes) are already built (see Phase 1 above) — this note is kept only as a record of why that decision was made early, not as a pending task.

---

## Implementation notes

### Exercise seed data — REVERSED, see migration
The `exercises` table was previously seeded directly in Supabase (no seed file in the repo). **This is no longer the plan** — pre-seeding was decided against in favor of the library growing purely through import matching (design principle 15). `migration-001-unify-schema.sql` wipes it entirely (along with all other programme data — this was a deliberate full reset, not a targeted cleanup). Do not add a new seed script.

### Programme Builder UX
When adding an exercise via the picker, the API returns the new `programme_exercise` id. The picker redirects to `/programmes/[id]/edit?expanded=<newExId>` so the newly added exercise card auto-expands in the builder, making it clear the user should configure sets/reps before saving.

### Ramp load scheme
Set 1 is `load_type = 'absolute'` (user enters the opening weight at the gym). Sets 2–N are `load_type = 'percent_of_reference_set'` with `reference_set_number = 1`. Load percentages ramp linearly from `100 + ramp_end_percent/(N-1)` on set 2 up to `100 + ramp_end_percent` on set N. The logging API computes and returns `next_suggestion` after each set is logged.
