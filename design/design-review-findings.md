# Stackd — design review findings (2026-10-20)

Reviewed: `STACKD_DESIGN_HANDOFF.md` and all 31 boards in `Stackd_visual_directions.pdf`, against `CLAUDE.md` and what is already built/live.

## 1. Verdict
- The design fits the data model. **No schema blocker.** The hierarchy, the derived "Session x of N", one active block, the Today suggestion, the two edit scopes, skipped sets, per-variation Progress lines and the full-screen rest timer all map onto what is specced or built.
- **One small new migration:** `training_blocks.finished_at` (see §5). Everything else uses migrations already planned (007, 008, 009).
- Wording follows the glossary on every board ("Programme" never appears).
- Three boards still carry old placeholder text the handoff says was fixed: LedgerFinish ("Week 3 · Intensification"), LedgerTodayOrangeLemon ("Deadlift peak"), and the sample block name "Deadlift Peak" throughout.

## 2. Already consistent (no work beyond building it)
- **Today suggestion = the workout furthest behind** in the current phase, tie broken by `order_index` (migration 006). Because it is derived from session counts, **an override cannot corrupt the rotation** — there is no rotation state stored. "Change workout" starts a session with the existing `POST /api/sessions` for any workout in the phase.
- **"Session x of N":** completed sessions of that workout in the phase + 1. Only `completed` sessions count (finishing with skipped sets still counts; `abandoned` and `in_progress` do not). **N = the phase's `duration_weeks`** (assumes each workout appears once a week, which holds for your plans). Phase totals ("6 of 12") are the sum over workouts. Peak = 3, Deload = 1 come out automatically.
- **One active block:** `status` + the unique index (005). "Start this block" disabled until the current block is finished.
- **Edits stay inside the current phase** automatically: a workout row belongs to one phase, so "Remaining sessions" edits the template in place for that phase only. Past sessions are never rewritten (history reads `logged_sets` → `session_exercises.exercise_id`).
- **Just today / Also apply to remaining sessions** = `session_exercises.overrides` (009) plus the template edit. Swap uses the session row's own `exercise_id`.
- **Skipped sets** saved at finish = `logged_sets.skipped` (008). "Not logged: C2 · set 3, D · set 3" is computed from planned vs logged.
- **Progress** per-variation lines and the legend rows match what Claude Code already built (per-line stats). Destructive red `#A8301B` closes the old "error colour" item.
- **Type:** IBM Plex Sans + Mono is the working default; the Barlow/uppercase board is optional and would not suit 73-character exercise names. Recommend Plex.
- Exercise tab letters (A–F, B1/B2) should be **derived from order and superset grouping, never stored**, so "Superset with next", reorder and delete just work (answers handoff item 8).
- Elapsed time on the finish sheet = `completed_at − started_at` (both exist).

## 3. Decisions I need from you (my recommendation first)
1. **Title everywhere = `exercise_group`, full name as a muted second line?** The handoff makes this the rule in the logger. Lists (workout detail, edit, change-workout, add-exercise) are not decided. *Recommend:* same rule everywhere — line 1 the group (or the name if it has no group), line 2 the full name muted, 1 line in lists, 2 in the logger. This makes `group_name` a display field and not Progress-only, so design should draw the second line in lists.
2. **Finishing phases and blocks.** The boards only show "Finish training block" after the last phase is done, and never show how a phase becomes Done. The built app has a manual phase toggle and an "advance phase" action. If a block can only be finished after all phases are done, you cannot start the next block early. *Recommend:* (a) when every workout reaches its N sessions, Today shows "Phase complete — start Intensification" (one tap); (b) a "Finish phase" action is also available any time on Phase detail; (c) "Finish training block early" is available from the block card (same confirm sheet).
3. **Weight fallback in the logger, now and not "later".** In your real plan 144 of 216 entries have no target weight. The logger needs: plan target if present, else **the same set's weight from the last session of that exercise**, else empty. That is a small piece of the later "starting-weight" feature; the performance-based progression rule itself stays later. OK?
4. **"Week N of 12" label.** The boards show it always; `CLAUDE.md` only showed it for workouts with week-specific sets and made it tap-to-edit. *Recommend:* always show it, derived as (weeks in earlier phases) + (completed sessions of this workout in the phase + 1), tap-to-edit kept as a hidden affordance.

Defaults I'm taking unless you object: e1RM tag shows the last session's value until the first set is logged, then updates live (client-side); warm-up sets are excluded from e1RM/volume/max weight; no phase boundaries on Progress charts in v1; superset mode toggle (Alternate / One at a time) is screen state only, resets per superset; rest after an alternate round is the last member's `rest_seconds`, and in one-at-a-time mode each exercise's own; "Add set" adds one extra logged set (no skipped row if left unlogged); "per hand" shows on Progress only when every line in the group is Dumbbell.

## 4. Gaps for design (not drawn)
1. **Resume an in-progress session** (Today card when a session is open). Not in the handoff's list; needed whenever the app closes mid-workout.
2. **Today states:** all workouts in the phase done; no active block; first-time (reuse the Training empty state).
3. **Timed and MAX sets.** The plan allows "30s" and "MAX" and Les's plan has Plank — the Reps input must become seconds/blank. Also keep Plank off the Reps-chart default.
4. **Triset (3 members)** round view; and **superset members with different reps** — the boards show one shared "3 × 8–10" tag, but only the set count is shared in the model, so reps/tempo must show per exercise when they differ.
5. **Spread %:** choosing ↑ in the edit sheet needs a percentage field (`ramp_end_percent`).
6. **Rest screen after the last set of an exercise:** what does "Up next" show, given moving on is never automatic?
7. **Add / remove an exercise inside a live session** (handoff says not drawn), and what "Add set" does.
8. **No-target-weight state** (empty fields with a dash) and **Last = —** after a swap.
9. **Error and failed-save states**, especially a failed Log tap on gym wifi (brick red text + retry); loading states.
10. **Custom exercise form**, and the **person icon** (settings).
11. **Deload look** (1 session per workout) and long block names (2 lines).
12. Add-exercise filter chips use body region (data exists as `muscle_group`); the built library uses equipment chips — pick one or both.
13. Progress picker subtitle: each group shows its own default metric ("best 9 reps", "e1RM 187.5 kg").

## 5. Data and backend implied
- **Migration 013 (new):** `training_blocks.finished_at timestamptz`, set by `/api/blocks/[id]/finish`. Needed for "Finished today" and the "Jun – Aug 2026 · 12 weeks" lines on previous blocks (start date can be derived from the first session).
- 007 (add exercise), 008 (skipped), 009 (overrides) — ship each with its own stage, test first.
- **Progress API:** add `range` (4W/12W/6M/All) and `metric=reps` (best reps in one set per session); "Weight" and "+kg" = the existing `max_weight`; default metric per exercise (bodyweight → Reps, otherwise e1RM); a picker query listing groups the user has logged with session count and latest value; Volume drawn as bars.
- **New derived functions:** next suggested workout; per-workout and per-phase session counts; block week; phase/block "complete" detection. No new tables.
- **Rest timer rebuild** (absolute end time, persisted, Wake Lock, count up, vibrate) — already in the spec.
- Fonts: IBM Plex Sans/Mono via `next/font`. Orange `#FF9500` always with dark ink text; lemon only on dark surfaces.
- Les's plan has `day_label` "Upper / Lower / Full": change it to "Upper Body / Lower Body / Full Body" in the file or at generation.

## 6. Where the built app conflicts with the design
- Two-tab nav (design: Today / Training / Progress).
- Logger header shows the full name only (design: group title + full name line).
- Progress: no range chips, no headline number layout, line chart for every metric (design: Volume as bars), no group picker sheet with counts.
- Phase detail has "+ Add programme"/advance controls the design does not show (see decision 2).
- Workout editing is the old Builder form; design replaces it with the edit-mode list and the per-exercise sheet.
- Library filter chips (see gap 12).

## 7. Suggested order of work
1. Restyle: tokens, fonts, 3-tab nav, Training tab (including `finished_at`/migration 013). Low risk, no behaviour change.
2. Derived counts + Today + Change workout + Phase/Workout drill-in (look-ahead comes free).
3. Progress restyle + range + reps metric + picker (independent; the multi-line chart already exists).
4. Logger rebuild: rows, Last column, weight fallback, rest takeover, finish sheet, skipped sets (008).
5. Edit scopes: workout-detail edit mode and the logger's "Just today" sheet (007, 009).
6. Superset modes (Alternate / One at a time), timed and MAX sets.

## 8. Handoff section E — short answers
1. Per-phase sets/reps: yes (each phase has its own workouts); look-ahead is possible.
2. Completed sessions are `workout_sessions` rows with `status = 'completed'`; "x of N" is derived per workout per phase.
3. Yes: templates are edited in place for the phase; history never reads the template.
4. Existing rest timer is not phone-lock safe; rebuild is specced.
5. Skipped vs not-yet-logged: yes, once 008 is applied.
6. Navigation today is two tabs; Today is new.
7. e1RM: client-side live in the logger, server-side in the history route (Epley).
