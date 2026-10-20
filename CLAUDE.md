# Strength training app — project brief

A personal strength-training web app: design multi-week/multi-phase training programmes, log workouts at the gym, and track progress over time. Built for a single primary user (kg only, no multi-currency/unit concerns), but the schema supports multiple accounts.

**Migration status: `migration-001`, `migration-002-global-exercises.sql` and `migration-003-backfill-exercise-metadata.sql` have ALL already been run against the live (production) Supabase project (002 and 003 were each tested on `stackd-test` first). `004` through `012` have NOT been run yet: **004** adds the nullable `exercises.variation` and `exercises.group_name` columns (columns only, no data change); **005** single active block; **006** workout `order_index`; **007** extra exercises in a session; **008** skipped sets; **009** per-session overrides + safe delete; **010** fills in `group_name` and `variation` for existing exercises from the reviewed mapping sheet (data only — it never changes `name`; uses the columns from 004); **011** adds `peaking_label` / `peaking_replaces` / `peaking_reason` to `training_blocks` (the import spec had mapped these to columns that never existed); **012** merges the duplicate "Dips" / "Dip" exercise rows (re-points every reference first, history is kept).** Do not re-run `migration-001` — it would wipe the real, live production data that now exists. Do not re-run `002` or `003` either. **Follow the "Database change workflow" section below for every pending migration** — test project first, then tell the user to take a manual `pg_dump` backup, then production. **Order matters in two places:** (a) `004` must be applied BEFORE the app code that reads or writes `variation` or `group_name` ships, because selecting or inserting a column that doesn't exist makes Supabase return an error; (b) `010` only fills the new columns, so it is safe any time after `004`, but never run it in an environment still running the earlier branch that displays name + variation together (it would print the variation twice) — see the next paragraph. `005`–`009` don't depend on `004` or `010` and are additive/loosening (new nullable or defaulted columns, one new unique index, two foreign keys changed to `on delete set null`), so they're safe to apply before their app code exists; apply them in numeric order. The app code each one needs is listed below. (What's live now: exercises are visible globally across accounts (`002`) and `muscle_group`/`equipment` are backfilled on existing rows (`003`) — except one known, deliberate gap: "Arnold Press - Seated - Bilateral" has `equipment = NULL` because nothing in its name states it's a dumbbell exercise, and `003` was written to leave genuine unknowns blank rather than guess wrong; fix that one manually once exercise editing exists. Still outstanding: existing exercises have no `group_name` / `variation` until `010`; `category` remains untouched and still has no defined purpose — a separate open decision, not a pending-migration symptom.) The "Build order" section further down reflects real progress on the *code/screens* side (✅ marks, actual routes) — don't re-build anything marked complete, and treat the schema/principles/routes sections above it as the current target state.

**Exercise naming model and required order (revised 2026-10-19 — replaces the earlier "split the name" design).** An exercise's `name` is the **full original name, shown everywhere in the app exactly as stored** (e.g. "Bench press - DB - Semi-Pronated - 35°"); nothing in the app splits or joins names. Two optional columns sit beside it: **`group_name`** (e.g. "Bench Press", "Kneeling Row") is used **only** to group exercises on the Progress tab — one picker entry, one chart line per exercise in the group; null means the exercise is its own group. **`variation`** (e.g. "DB - Semi-Pronated - 35°") is used **only** as that exercise's chart-line label; null means the line is labelled with the full name. **Rule for choosing a group:** the group is what you would pick in the Progress dropdown; the exercises inside one group should be genuinely comparable variants of the same lift (a seated row and a kneeling row are different groups; bench press at every angle and grip is one group). Weights are only comparable *within* one exercise (one chart line) — never merge, sum or average different exercises into one line. The existing 129 names were mapped to group + variation in the reviewed sheet `exercise-name-mapping.xlsx`, which is the source for migration 010. **Order:** (1) apply `migration-004` (adds both empty columns) to the test project, then to production after a `pg_dump`; (2) ship the code — every display site shows plain `name`, the import stores `exercise_group` / `variation` as given (no splitting, matching on `name` only), and Progress groups by group key (see API routes and Screens); (3) `migration-010` (fills group + variation, exact-name updates, test first, backup, then production) can run any time after (1), but **not** against an environment still running the earlier `exercise-variation-rollout` branch, which joins name + variation for display and would show the variation twice; (4) `migration-012` merges the duplicate Dips/Dip rows. That branch's name-splitting import and `formatExerciseName` helper are superseded and must be reworked before anything ships; do not deploy it to production as it stands.

**App code the other pending migrations need** (none of it blocks applying them, but each is incomplete until its code lands): **005** — import sets block `status` (active vs "Up next"), new `/api/blocks/[id]/start` and `/finish` routes, Programmes/Training home shows active card + Up next + Previous. **006** — import sets `programmes.order_index` from `day_num`; lists sort by it; Today uses it as the tie-break. **007** — `POST /api/sessions/[id]/exercises` and the logger's add-exercise flow. **008** — at finish, save unlogged planned sets as `skipped = true`, and add `and not skipped` to *both* progress/history source queries (`api/exercises/[id]/history/route.ts` and the "Last" reference in `sessions/[id]/page.tsx`). **009** — the logger resolves `overrides.x ?? template.x`; the `PATCH /api/sessions/[id]/exercises/[sessionExerciseId]` route. Before applying `009` to production, check that no read path breaks when `session_exercises.programme_exercise_id` is null (the audit found none that assume otherwise, but the logger and "Last" query should be re-checked).

**Known live bug (fix independently of any migration):** deleting an exercise from the Programme Builder that has ever been used in a session fails at the database (foreign key with no cascade), but `exercise-list.tsx` `remove()` ignores the response and calls `onDeleted()` regardless, so the exercise vanishes from the screen while still existing in the database. The UI must check the response and show an error on failure. (Migration `009` removes the underlying DB restriction; the UI fix is still needed.)

Keep `unified-training-plan.schema.json` in the project root — it's the formal JSON Schema for any importable training plan; the `/api/blocks/import-json` route validates against it directly with Ajv (see API routes below). **If you're swapping in an updated copy of this file, read its own `$comment` field first** — the schema carries its own changelog so version history travels with the file itself, not just this doc.

Full UI reference mockups are in `strength-app-ui-mockups.html` (open in a browser) — includes an Import preview screen (from an earlier design pass that also had a paste-text option; that option is dropped, see below), but predates the phase/programme structure change, the file-based JSON import becoming the *only* import path, the week_number addition, and import becoming the primary creation path. It doesn't yet have a **Phase detail** screen (the old "Which week is this?" step is dropped — it's now an editable "Week N" label in the logger header, see Screens, item 9) — design both fresh, following the same visual style as the other screens in the file (the existing Import preview screen is a good visual reference for the block-import preview, adapted to file-upload instead of paste). The **Programmes home empty state in the mockup file is also stale** — it shows "Start your first training block" as the primary CTA; per Screens item 2 below, that needs to become "Import your first plan" with manual block creation as the secondary link.

**No AI text importer.** An earlier draft of this plan included a second import path — paste freeform text, have Claude parse it via the API. That's been dropped: file-upload JSON import (`/api/blocks/import-json`) against `unified-training-plan.schema.json` is the only import method. No `ANTHROPIC_API_KEY`, no Claude API calls anywhere in this app.

## Glossary — user-facing terms vs code/database terms (READ FIRST)

The UI uses different words from the code and database for some levels. **User-facing text (labels, buttons, empty states, toasts, page titles) always uses the "On screen" column. Code, table names, column names, routes and filenames keep the "In code" column — do not rename them to match the UI.** Put all user-facing strings in one shared constants file so they live in one place.

| Level | On screen (UI) | In code / database |
|---|---|---|
| The whole multi-week plan | **Training block** | `training_blocks`, `/api/blocks` |
| A stage within a block (Accumulation, etc.) | **Phase** | `training_block_phases`, `/api/phases` |
| A day's template (Full Body 1, Upper) | **Workout** | `programmes`, `programme_exercises`, `programme_sets`, `/api/programmes` |
| One logged gym visit | **Session** | `workout_sessions`, `session_exercises`, `logged_sets`, `/api/sessions` |
| Bottom tab for the above | **Training** (tabs: Today / Training / Progress) | — |

**The word "programme" must never appear in the UI.** In this file and in the code, "programme" means a single day's template (the on-screen "Workout"), *not* the whole plan — the whole plan is a "training block" everywhere. Where older sections of this file say "Programmes home", "Programme Builder", "Archived programmes" or "standalone programmes", read them as the on-screen Training tab, Workout editor, Previous training blocks, and standalone workouts respectively.

On-screen verbs: buttons that act on a visit can say "Start workout" / "Finish workout" / "Change workout"; anything that counts or lists logged visits says "Session" ("Session 3 of 4", "Previous sessions"). The Training tab shows the active training block card, then **Up next** (planned blocks), then **Previous training blocks** (archived). The tab bar change from two tabs to Today / Training / Progress is pending design sign-off — see the design handoff; don't restructure navigation until told to.

---

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
3. **No freestyle sessions — but exercises can be added to today's session.** Every `workout_sessions` row requires a `programme_id` (no sessions without a linked workout). A `session_exercises` row normally has a `programme_exercise_id`, but it may be **null (migration 007)**, meaning the exercise was added on the day (design: Edit → "Just today" → Add exercise). Extras have no prescription: no planned sets/reps/tempo, a default rest (90s) until changed, sets added via "Add set"; last-session reference still comes from history by `exercise_id`. Extras never alter the template (`programme_exercises`) — changing future sessions is a separate "Remaining sessions" edit, not part of this. On finish there are no planned sets to mark skipped for extras; only logged sets are saved.
4. **Superset pairing is visual/organizational, not an execution lock.** Two exercises sharing a `superset_group` render on **one combined screen** in the Workout Logger (both exercises' full set lists stacked together), so the user can either alternate between them set-by-set or do all of one then all of the other — same screen supports both without forcing either.
5. **Status changes are always manual, never automatic.** Archiving a programme, reactivating one, advancing a training block phase, marking a goal achieved — all user-initiated taps, never background/timer-driven.
6. **Training blocks are the primary structure; standalone programmes are the exception.** The Programmes home screen shows blocks first as prominent cards; standalone programmes sit in a smaller, de-emphasized list below.
7. **kg only.** No unit conversion, no `unit_preference` field anywhere.
8. **Bodyweight exercises use the same fields as everything else.** `weight` just means "added load" — 0 or blank for pure bodyweight, a real number for weighted variations (e.g. weighted pull-ups). No special-cased schema.
9. **A block phase can hold several concurrent programmes.** A "Accumulation" phase might have Upper, Lower, and Full body all running side by side (different days of the week) — not one programme per phase. Advancing a phase moves every programme in it forward together, in one action, not one at a time.
10. **No numeric cap on active programmes.** An earlier version of this plan capped "active" programmes at 3-4 to avoid clutter. That's gone — a phase with several concurrent programmes made the cap meaningless, and blocks already prevent clutter visually (one summary card regardless of how much is inside). Reactivating or creating a programme is never blocked.
11. **Duration-based exercises are first-class, not a workaround.** Planks, carries, and interval work are prescribed in seconds, not reps. `prescription_type` on `programme_exercises` switches between `'reps'` and `'duration'`; `target_reps_min`/`max` and `target_duration_seconds` are mutually exclusive based on it. `"MAX"` reps (e.g. max-effort chin-ups) don't need this at all — that's just `set_type = 'amrap'` with reps left null.
12. **One unified plan JSON schema.** `unified-training-plan.schema.json` (in the project root alongside this file) is the single source of truth for any importable plan — reps as ranges/durations/MAX, a warm-up slot role, optional block-level `model_name`/`cycle_number`/`peaking_focus`, and a documented "weight decided live at the gym" state instead of a pre-planned number. Also carries an optional `equipment` field plus optional `exercise_group` and `variation` per exercise — `exercise_name` is always the full display name, `exercise_group` is the Progress grouping label (e.g. "Chin Up"), `variation` is the chart-line label (e.g. "Supinated - Mid") — added specifically so plan generation states these directly rather than the importer inferring or splitting anything after the fact. It also carries optional `load_scheme` (`equal`/`ramp`) and `ramp_end_percent` (spread across sets) per exercise — omitted means equal weights. Fix data-quality problems like this at the schema/generation level, not by adding more inference logic at import time. `/api/blocks/import-json` validates against this exact file with Ajv.
13. **Imports must be lossless — no plan data gets silently dropped or collapsed.** A plan where the weight genuinely changes every week (not just autoregulated within a session) is represented with `programme_sets.week_number`: null when a prescription applies uniformly across the whole phase, populated with one row per `(set_number, week_number)` when it varies weekly. `workout_sessions.week_number` (suggested from session count, always editable, same "suggestions, never lock" rule) tells the logger which week's rows to pull. Every other field an imported plan carries — athlete name, original generation date, stated weeks/days-per-week, weight provenance and confidence — has a real column, not a value that gets thrown away on import.
14. **The exercise library is fully global, not per-account.** `exercises` has no pre-seeded starter set (see below), but once created, every exercise is visible to every account on the app — RLS scopes `insert`/`update`/`delete` to the creator (`created_by_user_id = auth.uid()`), but `select` is open to any authenticated user (migration 002). Both real source plans use verbose, gym-specific compound names, so a generic seed list wouldn't match well anyway. Every import matches against the **entire global library**, not just the importing user's own exercises, and creates new entries for anything unmatched — on the very first import ever done by anyone, that's everything, which is correct, not an error. Because names are this specific, exercise matching needs to be normalized/fuzzy, not exact-string comparison, or near-identical lifts across separate imports (even from different accounts) will keep spawning duplicates.
15. **Import is the primary programme-creation path, not a Phase 2 add-on.** The JSON file importer belongs in the core loop, not deferred to polish. The Programmes home first-time empty state leads with "Import your first plan," not manual block creation. The Programme Builder is still essential, but its expected role is editing an already-imported programme (fixing a misparsed exercise, adjusting sets/tempo/rest), not building one from a blank slate — building from scratch still works on the same screen, it's just no longer the default path a new user is nudged toward.
16. **Every database change is a numbered migration file, tested against the test project, backed up before touching production — no exceptions, ever.** See "Database change workflow" below for the full standing procedure. Never hand over freehand SQL to paste into the Supabase SQL Editor without a corresponding numbered file, and never let a production migration run without first telling the user to take a manual `pg_dump` backup — Free tier has no automatic backups on either project, so this manual step is the only recovery path that exists.
17. **Only one active training block per user at a time.** `training_blocks.status` is `'planned'` (shown as "Up next"), `'active'`, or `'archived'`, enforced by a partial unique index (`one_active_block_per_user`, migration 005) so the DB itself refuses a second active block. Importing a block while one is active saves it as `planned`/"Up next" with a manual "Start this block" action; starting it requires finishing (archiving) the current block first. Finishing a block is a manual tap after the final phase (manual-only status changes, never automatic). Reactivating a previous block follows the same rule. Standalone programmes are outside this rule, and this does not bring back the programme cap (principle 10) — it constrains blocks only.

---

## Database schema (Supabase / Postgres — run as migrations in this order)

```sql
-- profiles: app-specific fields Supabase Auth doesn't own
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- exercises: NOT pre-seeded, and GLOBAL -- visible to every account (migration 002), not
-- scoped per-user. Starts empty and grows via import matching (against the full global
-- list, not just the importing user's own exercises) plus manual "+ Add custom exercise".
-- Ownership (created_by_user_id) still governs who can edit/delete a row, just not who
-- can see it. is_custom stays true for every row -- vestigial, see RLS section below.
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- name: the FULL exercise name exactly as the plan/user writes it (e.g. "Bench press - DB -
  -- Semi-Pronated - 35°"). Shown everywhere in the app as stored; never split or joined.
  -- Import matching uses this column only.
  group_name text,
  -- group_name: optional Progress-tab grouping label (e.g. "Bench Press", "Kneeling Row").
  -- Progress shows one picker entry per group and one chart line per exercise in it. Null =
  -- the exercise is its own group; group key = lower(trim(coalesce(group_name, name))).
  -- Added by migration 004; existing rows filled by migration 010.
  variation text,
  -- variation: optional short label for this exercise's chart line within its group (e.g.
  -- "DB - Semi-Pronated - 35°"). Null = the line is labelled with the full name. Display-only
  -- for Progress; never part of the displayed name and never used for matching.
  category text,
  -- category: NEVER GIVEN A DEFINED PURPOSE anywhere in this spec -- no mapping, no UI
  -- feature depends on it. Either drop this column, or decide what it should hold
  -- (e.g. "Compound"/"Isolation" as a fixed property of the exercise, distinct from
  -- programme_exercises.slot_role, which is contextual per-programme) -- don't populate
  -- it until one of those is actually decided.
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
  peaking_label text,    -- migration 011: peaking_focus.label as written
  peaking_replaces text, -- migration 011: peaking_focus.replaces
  peaking_reason text,   -- migration 011: peaking_focus.reason
  status text not null default 'planned' check (status in ('planned','active','archived')), -- migration 005; max one 'active' per user (partial unique index)
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
  order_index int, -- migration 006: workout order within a phase; display order + Today tie-break only, never a schedule. Nullable -> fall back to created_at, then name
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
  programme_exercise_id uuid references programme_exercises(id) on delete set null, -- nullable (007): null = added during this session OR template row later deleted (009)
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0,
  overrides jsonb not null default '{}'::jsonb -- migration 009: this-session-only changes, see "Editing a workout" in Implementation notes
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
  rpe int,
  skipped boolean not null default false -- migration 008: planned set never logged, saved at finish. EVERY progress/history/Last/e1RM/volume query must exclude skipped sets
);
```

**These `create table` statements describe the current target shape, for reference — do not run them against the live project, the tables already exist.** `migration-001-unify-schema.sql` was already applied (it truncated all existing programme/block/session/exercise data at the time — login/`profiles` untouched — and added the new columns); **do not run it again now that real production data exists, it would wipe it.** Any further schema change needs its own new numbered migration per the "Database change workflow" section below.

---

## Database change workflow — test environment, migrations, backups

This section is a standing instruction for how *any* database change gets made from here on, not a one-time setup note. Follow it every time, not just when it's convenient — Free tier has no automatic backups on either project, so the discipline here is the only safety net that exists.

**The test environment (separate org, `stackd-test` project, Vercel Preview vars) already exists** — set up and confirmed working, and used to test `migration-002` and `migration-003` before they went to production. Before applying any pending migration (`004`–`011`), confirm the test project's schema is still current (it may need catching up if production has moved since) rather than assuming it's permanently in sync.

### The test environment (set up once)

1. **A separate Supabase organization** hosts the test project — orgs are free regardless of plan; only projects are capped at 2 active per org, and the real account is likely already at that cap. A new org sidesteps the limit rather than forcing a pause on something real.
2. **A test project inside that org** (e.g. `stackd-test`), with every migration applied to it — same schema shape as production, no real data.
3. **Vercel Preview-scoped environment variables** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) point at the test project. Production-scoped vars keep pointing at the real one. Local `.env.local` also points at the test project, so local dev never touches real data either.
4. **Work happens on git branches, never directly on `main`.** Pushing a branch gets an automatic Vercel Preview Deployment using the test database. Merging to `main` is the only thing that touches production, and it should always be a deliberate act, not a side effect of finishing a feature.

If asked to help set this up, walk through these four steps concretely — which Supabase dashboard screens to click through, exact Vercel Environment Variables settings, exact `git checkout -b` commands — don't just restate the summary above.

### Migrations — always a numbered file, never freehand SQL

**Every schema change is a new file — `migration-012-whatever.sql`, `migration-013-whatever.sql`, and so on — never typed directly into the Supabase SQL Editor and run ad hoc.** If asked to make a schema change, always produce the file first, named with the next sequential number, following the same style as `migration-001` through `migration-003` (a comment explaining what it does and why, at the top). Refuse to just hand over a bare SQL snippet for the person to paste in without a corresponding numbered file — the numbering is what keeps a record of what's actually been applied and in what order, and that record is worthless if some changes bypass it.

**Destructive changes (drop a column, change a type, delete rows) always split into two migrations, not one:**
- Migration A: add the new thing, backfill it, and get the app code switched over to using it — nothing removed yet, so a mistake here is always recoverable
- Migration B, later, once it's confirmed nothing references the old thing anymore: the actual removal

Don't collapse these into one migration even if it seems more efficient — the whole point is that migration A alone leaves a safe rollback point.

### Applying a migration — the required order, every time

1. Run the new migration against the **test** project first (via its SQL Editor, or however migrations get applied there)
2. Verify it via the test/preview deployment — don't skip this because the change "looks simple"
3. **Before running anything against the production project, explicitly tell the user to take a manual backup first**, and give the exact command:
   ```bash
   pg_dump "postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres" \
     --no-owner --no-acl -f backup-$(date +%Y%m%d-%H%M).sql
   ```
   (connection string from Supabase dashboard → production project → Settings → Database → Connection string, "Session pooler" variant for a one-off command). This step is not optional and not skippable for "small" changes — Free tier has no restore button, so this manual dump is the only thing standing between a mistake and permanent data loss.
4. Only after the backup exists, run the same tested migration file against production
5. Verify against production directly afterward

Never suggest skipping step 3, even for a change that seems purely additive — the discipline needs to be unconditional to actually hold, not applied selectively based on a judgment call about risk that might be wrong.

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

### `exercises` — globally readable, owner-controlled

```sql
alter table exercises enable row level security;

create policy "any authenticated user can view any exercise" on exercises for select using (true);
create policy "insert own" on exercises for insert with check (created_by_user_id = auth.uid());
create policy "update own" on exercises for update using (created_by_user_id = auth.uid());
create policy "delete own" on exercises for delete using (created_by_user_id = auth.uid());
```

**Decided (migration 002): exercises are visible to every account on the app, deliberately.** This app currently has two real users who know each other and want a shared exercise pool — if either of you swaps an exercise in a programme, you should be able to browse what the other has already added, not just your own. Ownership (`created_by_user_id`) still controls who can edit or delete a given row; it just no longer controls who can see it. `is_custom` is now vestigial — every row is `true`, since there's no more global-seeded-vs-custom distinction to make — left in the schema rather than dropped, since it's harmless and there's live data in the table already.

**Worth knowing if this app ever grows beyond two trusted users**: "global" here really does mean *every* account on the app, not a household/team scoped to just the two of you — that's a deliberate simplification (no team/household concept exists in this schema), not an oversight. If a third unrelated person ever signs up, they'd see this same shared pool too.

---

## API routes — only where real logic lives

Everything else (reading lists, editing a name, toggling a goal) goes straight through the Supabase client from the frontend, protected by RLS above. Don't write custom CRUD routes for simple reads/writes.

| Method & route | Purpose | Logic required |
|---|---|---|
| `POST /api/programmes/[id]/exercises` | Add exercise to programme | Generate `programme_sets` rows from `num_sets`; compute ramp interpolation if `load_scheme = 'ramp'` (linear steps from set 1 to `1 + ramp_end_percent/100`) |
| `PATCH /api/programme-exercises/[id]` | Edit sets/reps/load scheme (**the "Remaining sessions" edit**) | Add/remove `programme_sets` rows and recompute ramp percentages if `num_sets` or `load_scheme` changes. Edits the template in place; for week-specific rows only touch `week_number >=` the current week — see "Editing a workout" in Implementation notes. Deleting a template row that has history is allowed (links become null, migration 009) |
| `POST /api/blocks` | Create a training block | Create `training_blocks` row + initial `training_block_peak_lifts` rows together |
| `POST /api/blocks/[id]/phases` | Add the next phase to a block | Auto-compute `order_index` (max existing + 1); set new phase's `status` to `active` if it's the block's first phase, else `planned` |
| `POST /api/phases/[id]/programmes` | Add a programme to a phase | Create `programmes` row with `phase_id` set — several can share one phase (Upper, Lower, Full body) |
| `POST /api/phases/[id]/advance` | Move to next phase | Atomically: current active phase → `archived`, next `planned` phase (lowest `order_index`) → `active`. Since every `programmes` row in a phase shares that phase's status, this moves all concurrent programmes in it forward together |
| `POST /api/sessions` | Start a workout | Given `programme_id`, create `workout_sessions` row + one `session_exercises` row per `programme_exercises` row in that programme |
| `POST /api/blocks/[id]/start` | Start an "Up next" block | Only allowed if the user has no other `active` block (else 409 — user must finish the current one first); sets `status = 'active'` |
| `POST /api/blocks/[id]/finish` | Finish a block | Manual only; sets `status = 'archived'` (and any remaining non-archived phases to `archived`) |
| `POST /api/sessions/[id]/exercises` | Add an extra exercise to today's session | Insert `session_exercises` row with `programme_exercise_id = null`, the chosen `exercise_id` (from the global library picker), `order_index` = last + 1. Session must belong to the user and not be completed. Never touches `programme_exercises` |
| `PATCH /api/sessions/[id]/exercises/[sessionExerciseId]` | "Just today" edit | Merge the changed keys into `session_exercises.overrides` (allowed keys listed in migration 009), or set `exercise_id` (swap) / `order_index` (reorder) on the session row. Never touches the template. Session must be the user's and in progress |
| `POST /api/sessions/[id]/sets` | Log a set | Insert `logged_sets` row; compute and return the suggested weight for the *next* set in the ramp: `reference_weight * (load_percent / 100)`, rounded to `exercises.rounding_increment` |
| `PATCH /api/sessions/[id]` | Finish or abandon session | Set `completed_at` + `status`; available at any point, not gated on reaching the last exercise |
| `GET /api/exercises/[id]/history?metric=1rm\|volume\|max_weight&scope=group\|exercise` | Progress chart data | Returns **`{ series: [{ exercise_id, name, variation, label, points: [{ session_id, date, value }] }] }`** — always a `series` array. `scope=group` (default) returns one series for every exercise sharing the selected exercise's group key (`lower(trim(coalesce(group_name, name)))`; an exercise with no `group_name` is a group of one); `scope=exercise` returns only the given exercise. `label` = `variation` if set, else `name`. Per series: join `logged_sets` → `session_exercises` → `workout_sessions` (matching `session_exercises.exercise_id`), group by session, compute 1RM (Epley: `weight * (1 + reps/30)`), volume (`Σ weight*reps`), or max weight (heaviest logged set; the earlier `intensity` metric was dropped — the built code uses `max_weight`). **Exclude skipped sets (`and not skipped`) once migration 008 lands**, ordered by `workout_sessions.completed_at`. Each series has points only on its own session dates |
| `POST /api/blocks/import-json` | Import a whole training block from an uploaded `.json` file, losslessly | **No AI call — plain deterministic parsing.** Input is a **file upload** (`<input type="file" accept=".json">`, read client-side with `file.text()` → `JSON.parse()`), not pasted text. **Validate with Ajv against `unified-training-plan.schema.json`** (in the project root) before mapping anything. Once valid, map: `plan_name`→seeds `training_blocks.name`, `athlete`→`.athlete_name`, `generated_date`→`.plan_generated_date`, `weeks_total`→`.weeks_total`, `days_per_week`→`.days_per_week`, `model_name`→`.model_name`, `cycle_number`→`.cycle_number`, `peaking_focus.label`→`training_blocks.peaking_label` (the raw text, always stored) **and** name-matched to `training_block_peak_lifts.exercise_id` where an exercise matches (a label like "Dip / Leg Press" may match several lifts, or none — unmatched is fine, the label is still kept), `peaking_focus.reason`→`training_blocks.peaking_reason`, `peaking_focus.replaces`→`training_blocks.peaking_replaces` (block-level columns, migration 011 — these describe the whole focus, so they are NOT on the peak-lift rows), `target_priority_regions`→`training_blocks.target_priority_regions`, `constraints`→`training_blocks.constraints`, `mesocycle`→`training_block_phases.phase_label` (group consecutive rows sharing the same value into one phase; `duration_weeks` = count of distinct `week` values in that group), `day_num`+`day_label` grouped by `week`+`mesocycle`→one `programmes` row per distinct `day_label` with `phase_id` set to the parent phase — `day_num` is NOT stored as a day, but its order is kept: set `programmes.order_index` = the rank of that `day_num` within the phase (1, 2, 3…; migration 006) — used only for list order and as the Today-suggestion tie-break, never as a schedule, `series`→split into `superset_group`+`superset_order` (`"SIT"` → standalone, no group), `slot_role`→`programme_exercises.slot_role` directly, `exercise_name`→**matched against `exercises.name` only** (it is the full name; `group_name` and `variation` take no part in matching), checked against the full global `exercises` table (every account's exercises, not just the importing user's own — RLS makes `exercises` globally readable, see RLS section). Use normalized matching on top of the existing fuzzy match: case-insensitive, trimmed, whitespace collapsed, and hyphen / en-dash / em-dash treated as the same character, so a plan that spells a known exercise with different capitalisation or a typographic dash matches the existing row instead of creating a duplicate. **Nothing is split or joined — `exercise_name` is stored exactly as given.** Optional `exercise_group`→`exercises.group_name` and `variation`→`exercises.variation` are stored as given when a **new** exercise is created; when the name matches an existing exercise whose `group_name` or `variation` is null, fill it in from the plan; **never overwrite a non-null value** (the user may have edited it). A missing `exercise_group` leaves `group_name` null (the exercise is its own group). The earlier legacy fallback that split compound names on the first dash is removed **When creating a new (unmatched) exercise, populate `muscle_group` and `equipment` — do not leave them blank, this was a real bug in an earlier build:** `body_region`→`muscle_group` (as a one-element array, e.g. `['Chest']` — this mapping is explicit in Section 2 and must actually be implemented, not just documented). `equipment`→**prefer the source's `equipment` field directly if present** (added to the schema specifically so plan generation states this rather than the importer guessing it after the fact — far more reliable, since real understanding of what equipment a lift uses beats keyword-matching a name string). **Only if the source omits `equipment` (older plans predating the field)**, fall back to keyword matching on the exercise name (and `variation` if present): `DB`→Dumbbell, `BB`→Barbell, `KB`→Kettlebell, `EZ`→EZ Bar, `Smith`→Smith Machine, `Band`→Band, `pulley`/`cable`/`mag`/`rope`/`d handle`→Cable, `machine` or known machine-pattern names (`leg press`, `hack squat`, `pendulum squat`, `leg curl`, `leg extension`, `row - seated`)→Machine, known bodyweight-pattern names (`chin up`, `pull up`, `dip`, `plank`, `push up`, `sit up`, `dead bug`, `garhammer raise`, `burpee`, `mountain climber`, `hanging leg raise`)→Bodyweight, **otherwise leave `equipment` null rather than guessing** — a wrong guess is worse than a blank field the user can fix manually. `sets`→`num_sets`, `reps`→`target_reps_min`/`max` if integer or range, `target_duration_seconds`+`prescription_type='duration'` if a duration string, or `set_type='amrap'` with reps null if `"MAX"`, `tempo`/`rest_sec`→`tempo`/`rest_seconds` directly. **For `target_weight_kg`/`weight_status`/`weight_basis`/`confidence`**: compare values across all weeks for a given exercise slot — if identical throughout (autoregulated case), write **one** `programme_sets` row with `week_number = null`; if they vary by week, write **one row per `(set_number, week_number)` pair**, so no weekly value is ever dropped. `load_scheme`→`programme_exercises.load_scheme` and `ramp_end_percent`→`.ramp_end_percent` directly (omitted → `'equal'`/null; the schema guarantees `ramp_end_percent` is present whenever `load_scheme` is `'ramp'`; across weeks, take the value from the first week). The user can still change either in the Workout editor. `notes`→`programme_exercises.notes`. **Block status on import:** if the user has no active block, the new block is `active` (first phase `active`, rest `planned`); if they already have one, it saves as `planned` ("Up next") with all phases `planned`. Imports every phase and every day-as-programme in the file, not a single programme — same preview-before-save behavior as any import. |

Reactivating an archived standalone programme and bulk-archiving are **not** custom routes — no cap to check, so they're plain Supabase client calls (a status update, or an `update ... where id in (...)`).

---

## Screens (see `strength-app-ui-mockups.html` for visual reference)

1. **Login / sign up** — single screen, toggle between modes
2. **Programmes home** (on screen: the **Training** tab) — one full active-block card (progress bar + current phase), then an "Up next" section for planned blocks (each with "Start this block"), a "Previous training blocks" section for archived blocks, standalone programmes secondary/quiet list, bottom nav (Programmes / Progress), settings gear icon. First-time empty state: **"Import your first plan"** as the primary CTA (import is the primary creation path — see Build order), "or create a training block manually" as the secondary link
3. **Training block detail** — name, peak lifts line ("Peaking: Squat, Overhead press"), freeform checkable goals, phase progress tracker (segmented bar), ordered phase list with status badges, "+ Add phase"
4. **Phase detail** — tapping a phase shows its concurrent programmes (e.g. Upper, Lower, Full body listed together), "+ Add programme" to add another to this phase, and the one-tap "finished this phase, start the next?" action that moves every programme in the phase forward together
5. **Programme detail** — read-only: sessions-completed count, exercise list with superset grouping shown, "Start workout" (primary) and "Edit" (secondary) actions
6. **Exercise library** — search, equipment filter chips, scrollable list. **No "Custom" badge anymore** — since `is_custom` is vestigial (always true, no more global-seeded distinction), that badge has nothing meaningful left to distinguish; consider showing who added each exercise instead, now that the list is shared (e.g. a small "added by Neil" / "added by you" label), since that's the genuinely useful distinction in a global list. "+ Add custom exercise" still creates a new global entry. **No pre-seeding, and fully global** — starts empty, grows via import matching (against the *entire* shared list across every account, not just your own) plus manual additions from either account. Doubles as the picker when adding an exercise to a programme
7. **Programme Builder** — add/reorder exercises; per-exercise form: sets, rep range, load scheme (equal/ramp toggle), tempo, rest, superset assignment. **Primarily an editing surface now**, not the main creation path — reached after import to fix/adjust something; still fully usable for building from scratch, just not the default expectation
8. **Import training block (from file)** — the only import path: a `.json` file picker (`<input type="file" accept=".json">`, no text-paste option) → parses via `/api/blocks/import-json` → editable preview (flags unmatched exercises as "new custom exercise", highlighted; **also flags superset pairs/groups (B1/B2, A1/A2…) whose `sets` differ** as a warning — never a block: the logger round view runs for the lower count and the leftover sets of the longer exercise are logged on their own. Within a superset only the set count is expected to match; `reps`, `tempo`, `rest` and `load_scheme` are legitimately per exercise and never shared or merged) → "Save" or "Discard". Reached from Programmes home alongside "New Block", and as an option inside an empty phase or empty builder
9. **Workout Logger** — **no separate "Which week is this?" step (dropped)** — instead the logger header shows a small tappable **"Week N" label**, prefilled from the same derived count as "Session x of N" (completed sessions of that workout in the phase + 1, mapped to the phase's weeks), editable by tapping it ("suggestions, never locks"); it only appears when the workout has week-specific `programme_sets` and is hidden otherwise, and the chosen value is saved to `workout_sessions.week_number`; exercise chips for free navigation; supersets render as one combined screen (both exercises stacked); each set row shows last-time reference + editable weight/reps/RIR + live estimated 1RM; rest timer with sound; "Next exercise" advances the suggested order; "Finish workout" is a persistent header link, not tied to any exercise
10. **Progress** — a **group picker** (searchable; one entry per group key, so "Bench Press" appears once however many variations exist; an exercise with no `group_name` appears under its own name) → Est. 1RM / Volume / Max weight toggle (applies to every line) → **one chart with one line per exercise in the chosen group**: real date x-axis (each line has points only on its own session dates, so use a time/linear axis with `{x: date, y: value}` points, not a shared category-label array), visible data points, no smoothing, legend on, line label = `variation` or else the full name, tick boxes to show/hide lines (default: the up to 4 most-trained lines) → a small **per-line stats table** (best, latest, session count — not one aggregate, because weights are not comparable across different exercises) → recent-sessions list across the group, each row labelled with its exercise. A combined "best across variations" view is a possible later option, not part of v1. When a group has one exercise the screen looks exactly like the current single-line chart
11. **Archived programmes** — flat list, "Reactivate" per row; reactivating a block is refused (with a prompt to finish the current one) if another block is active
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
- Remaining, **in priority order**: **JSON file import — treat as top priority, effectively "Phase 1.5"**, since import is now the primary programme-creation path per the updated principles above, even though the original Phase 1 shipped without it → rest timer sound → custom exercise creation → keep-alive cron

**Phase 3 — Nice to haves**
RPE, richer exercise library (categories/filters), programme duplication, CSV export.

Note: training blocks (with phases holding several concurrent programmes) are already built (see Phase 1 above) — this note is kept only as a record of why that decision was made early, not as a pending task.

---

## Implementation notes

### Exercise seed data — REVERSED, see migration
The `exercises` table was previously seeded directly in Supabase (no seed file in the repo). **This is no longer the plan** — pre-seeding was decided against in favor of the library growing purely through import matching (design principle 15). `migration-001-unify-schema.sql` **already wiped it entirely** (along with all other programme data — this was a deliberate one-time full reset, not a targeted cleanup, and it's already happened — do not run it again). Do not add a new seed script.

### Editing a workout — two scopes (decided)
- **Where the scope choice appears.** Only inside a live session (the logger). Edit from a Workout's read-only detail page has no session, so it always means **Remaining sessions**. In the logger, edits default to **Just today**, with an option to also apply to remaining sessions. (Design chat must reflect this.)
- **Remaining sessions = edit the template in place.** History never reads the template — progress, "Last" and e1RM all come from `logged_sets` → `session_exercises.exercise_id` — so editing the template cannot damage past sessions. No versioning, no snapshot table.
- **Week-aware.** For exercises with week-specific `programme_sets` (`week_number` populated), a Remaining-sessions edit only touches rows where `week_number >=` the current session's week; earlier weeks are left unchanged. Changing the set count adds/removes set rows for those weeks only. For uniform rows (`week_number` null) edit the row directly.
- **Just today = `session_exercises.overrides`** (jsonb, migration 009; allowed keys listed there). The logger resolves each value as `overrides.x ?? template.x`. Swap and reorder use the session row's own `exercise_id` / `order_index`; add-exercise is migration 007's null-link row; delete-just-today sets `overrides.removed = true`. Individual set weights are never overridden (weights are entered at the gym anyway).
- **Deleting template rows that have history is safe** (migration 009 makes both links `on delete set null`). History keeps its own `exercise_id`. No soft-delete needed.
- **Skipped sets (migration 008).** At finish, unlogged planned sets are saved with `skipped = true`; excluded from all progress queries. Extras and `removed` exercises create no skipped rows.

### Rest timer (needs rebuilding — current version is not phone-lock safe)
The built timer is a `useState` countdown driven by `setInterval` (`logger.tsx`), with no start timestamp and no persistence, so it drifts or freezes when the phone locks or the tab is backgrounded and resets on refresh. Rebuild: store the **absolute end time** (`Date.now() + seconds`), compute remaining = end − now on every tick and on `visibilitychange`, and persist the end time (e.g. `localStorage`, keyed by session) so a refresh resumes it; count **up** past zero ("over by +0:08"). Use the Screen Wake Lock API to keep the screen on while the logger is open, and vibrate/play a sound when it hits zero (browsers can't reliably play audio while the phone is locked — don't promise it). Rest sound is a separate backlog item still unbuilt.

### Navigation (BottomNav)
`components/bottom-nav.tsx` is currently rendered on only two pages (`programmes/page.tsx`, `progress/page.tsx`). The new Today / Training / Progress tab bar should appear on all three top-level pages (and Today is new), but not inside the logger.

### Programme Builder UX
When adding an exercise via the picker, the API returns the new `programme_exercise` id. The picker redirects to `/programmes/[id]/edit?expanded=<newExId>` so the newly added exercise card auto-expands in the builder, making it clear the user should configure sets/reps before saving.

### Ramp load scheme
Set 1 is `load_type = 'absolute'` (user enters the opening weight at the gym). Sets 2–N are `load_type = 'percent_of_reference_set'` with `reference_set_number = 1`. Load percentages ramp linearly from `100 + ramp_end_percent/(N-1)` on set 2 up to `100 + ramp_end_percent` on set N. The logging API computes and returns `next_suggestion` after each set is logged.
