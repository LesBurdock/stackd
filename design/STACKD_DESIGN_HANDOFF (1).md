# Stackd – design handoff for impact assessment

**Purpose.** A design pass was done in a Design canvas (screens listed below). Before any UI is rebuilt, assess against the existing codebase: which design decisions are *pure UI* (styling/layout only) and which *change behaviour, data or navigation* ("go deeper"). Report back before changing code.

**Terminology (use these exact words in the UI and keep them consistent with the data model).** The word "Programme" does not appear anywhere in the UI.

| Level | UI term |
|---|---|
| The whole multi-week plan | **Training block** |
| Stage within a block (Accumulation, etc.) | **Phase** |
| A day's template (Full Body, Upper Body) | **Workout** |
| A logged gym visit | **Session** |

Buttons that act on a visit keep the verb (Start workout, Finish workout, Change workout); the finish confirmation sheet says "Finish session?". Counts of logged visits say Session ("Session 3 of 4", "6 of 12 sessions").

**Context.** Stackd = mobile-web strength training app for experienced lifters on periodised plans, used in the gym on a phone. Next.js (App Router) on Vercel, Supabase (Postgres + auth), kg only, two real users. Plans are generated externally as JSON (`unified-training-plan.schema.json`) and imported. No coaching/AI in the app. Principles: simple and clean, suggestions never locks, glanceable, big tap targets (44px min, 56-60px primary), fast to log a set mid-workout.

Design source: the Design canvas "Stackd visual directions" (screens named `Ledger*`). Treat the canvas as the reference for layout and flow; treat this document as the list of intended behaviour.

---

## A. Likely DEEPER than UI (check these first)

1. **Navigation structure: three bottom tabs: Today / Training / Progress.** Today is the landing screen. Training shows the active training block card (phases with progress), then an **Up next** section and a **Previous training blocks** section; drilling in goes Training block > Phase > Workout (read-only detail, with Edit). Progress tab: see item 13.
   - **Only one training block can be active at a time.** A newly imported block lands in Up next with a "Start this block" action, which is disabled until the current block is finished. Finishing is a **manual tap** ("Finish training block") offered after the last phase is complete, followed by a confirmation sheet. Finished blocks move to Previous training blocks and logged sessions are kept. Check: how is "active" stored, what happens to Today when no block is active, and whether standalone workouts (e.g. "Arms") sit outside blocks.
2. **"Session x of N" and phase progress counts are derived, not stored.**
   - Per workout: `completed sessions of that workout in the current phase` (usually 4). "Session 3 of 4" = 2 done, this is the 3rd.
   - Phase total = sum of workouts' required sessions (e.g. 4 full body + 4 lower + 4 upper = 12; "6 of 12"). A two-workout plan gives 8 of 8. Must be computed from the plan JSON, not hard-coded.
   - Needs: how a completed session is recorded per workout per phase; whether partially done sessions count; what happens when a phase is finished (manual advance allowed? undecided).
3. **Today suggests a workout, user can override ("Change workout").** Suggestion rule: the workout furthest behind in the current phase (not fixed order). Override is a bottom sheet listing the phase's workouts with progress. Needs a "next suggested workout" function and a way to start a session of a non-suggested workout. Overriding must not corrupt the rotation.
4. **Look-ahead on Training.** User can open future phases and see their workouts. Requires per-phase sets/reps/intensity in the plan JSON (check the schema supports it; if intensity is only resolved at runtime, say so).
5. **Logger behaviour** (see section C for full detail): per-set rows with last-session reference, suggested values as placeholders, RIR per set, "Log" per row, auto-start rest timer, unlogged sets saved as *skipped*, jump between exercises by tab (A, B1, B2, C1, C2, D).
6. **Supersets with two logging modes.**
   - *Alternate* (default): round view B1 set 1 > B2 set 1 > rest > B1 set 2... rest starts after B2 only.
   - *One at a time*: all sets of B1, rest after every set, then B2. Per-superset toggle that **resets for each superset**.
   - Moving to the next exercise is **never automatic**; waits for the user's tap.
   - Also applies to C1/C2. Triset handling is an open question.
7. **Rest timer is a full-screen takeover** after Log (visible from across the room), then a solid-colour "REST OVER" screen showing the next set and its target. Counts up as "over by +0:08". Needs timer state that survives screen lock/backgrounding (verify how it works today).
8. **Editing, and where the scope choice lives.** Scope ("Just today" vs "Remaining sessions") only exists inside a live session.
   - **From the read-only workout detail (Edit):** there is no session, so every edit applies to **remaining sessions only**, with no scope control. Covers add, delete, reorder, edit sets/reps/tempo/rest/spread, swap, "Superset with next". Boards: LedgerWorkoutEdit, LedgerExerciseEdit, LedgerAddExercise, LedgerRemoveConfirm.
   - **From the logger (Edit on the exercise):** edits default to **Just today** (this session only). A switch, "Also apply to remaining sessions" (default Off), also updates the workout template. Save button reads "Save for today". Board: LedgerLoggerEdit.
   - In both cases sessions already logged keep the values they had. Needs: a per-session override of a workout's exercises (including swap, sets/reps changes and adding or removing an exercise for one session), plus template edits that never rewrite past sessions. The logger Edit entry is designed for the exercise sheet only; "add exercise" or "remove exercise" during a live session is not drawn (same pattern would apply).
9. **Shared per-pair fields.** In a superset, sets x reps, tempo and spread are shared by B1/B2 (tempo shared vs per-exercise is an open question); e1RM is per exercise.
10. **Derived values shown in the logger:** e1RM per exercise, spread vs equal ("spread =" equal weights across sets, "spread up20%" ramp), suggested weight/reps from last session, "Last" column (previous session's sets x reps @RIR). For weighted bodyweight moves (e.g. chin-up) weight is "+kg" (added weight) and e1RM is shown as "+6 kg". Check what is computed/stored today and whether e1RM updates live as sets are logged (open question).
11. **Finish flow:** Finish on the last exercise tab and in the header; confirmation sheet; unlogged sets saved as skipped.
12. **Empty states:** first-time Training ("Import your first training block"; designed), first-time Today (not designed). Not fully designed.

13. **Progress tab (new).** It is not session history. It shows one lift at a time: the user picks an exercise (sheet listing exercises they have logged, with session count and latest value), then a measure (**e1RM / Volume / Weight**) and a range (4W / 12W / 6M / All). The chart plots one value per logged session: e1RM = best set that session (Epley estimate); Volume = sets x reps x weight summed over the session; Weight = heaviest working set. Headline number = latest session; stats = best, change since the start of the range, session count. Needs queries aggregating logged sets per exercise per session, Bodyweight and weighted-bodyweight moves (chin-up, dip, leg raise) default to a **Reps** chart (best reps in a single set per session) with the switch **Reps / Volume / +kg**; added load is shown as a stat ("Added load +5 kg"). Loaded lifts default to e1RM. Suggested rule: an exercise set up with bodyweight ("+kg") defaults to Reps, everything else to e1RM; a per-exercise override is optional. Open: which e1RM formula (Epley is a placeholder), whether warm-ups are excluded, and whether the chart should mark phase boundaries.

## B. Likely PURE UI (restyle only)

- Colour, type and spacing tokens (see section D; decided).
- Corner radii, card styling, tag/pill styling, divider usage.
- Bottom-nav active indicator (a bar on the active tab).
- Superset grouping shown with a vertical rule and spacing (no boxes).
- Done/current/upcoming set-row treatment (done = check, current = highlighted row with large inputs, upcoming = faded).
- Progress shown as segmented bars (one segment per session).

## C. Screen inventory (canvas boards, final set)

Grouped in the canvas as rows. Treat every board as final unless marked.

| Row | Board | What it shows |
|---|---|---|
| Today | LedgerToday | Landing: Up next chip, next workout card, Session x of N, Start workout, Change workout |
| | LedgerChangeWorkout, LedgerTodayUpper | Change-workout bottom sheet; Today after override |
| Logging | LedgerLogger | Single exercise (Chin Up): header, exercise tabs, tag pills (sets x reps, tempo, spread, e1RM), set table with Last / +kg / Reps / RIR / Log, Add set, Next exercise |
| | LedgerLoggerEdit | Edit exercise during a live session: defaults to Just today, with an "Also apply to remaining sessions" switch |
| | LedgerRest, LedgerRestDone | Full-screen rest takeover (lemon countdown), then rest-over screen (solid orange) |
| | LedgerLast, LedgerFinish | Last exercise tab (bottom action becomes Finish workout); "Finish session?" sheet |
| Superset | LedgerSuperset, LedgerSupersetB2, LedgerSupersetRest, LedgerSupersetSolo | Round-based superset logger (B1, B2, shared rest, one-at-a-time mode) |
| Training | LedgerTrainingList | Active block card with phase list and progress, Up next (imported block, disabled "Start this block"), Previous training blocks |
| | LedgerTrainingReady, LedgerTrainingFinishSheet, LedgerTrainingNext | Block ready to finish, confirm sheet, then no active block with "Start this block" enabled |
| | LedgerTrainingEmpty | First-time empty state ("Import your first training block") |
| Training drill-in and edit | LedgerPhase, LedgerWorkout | Phase detail (its workouts); read-only workout detail with joined superset pairs and Edit |
| | LedgerWorkoutEdit, LedgerExerciseEdit, LedgerAddExercise, LedgerRemoveConfirm | Edit mode, per-exercise sheet, add exercise, delete confirmation (destructive button is brick red `#A8301B`) |
| Progress | LedgerProgressVariations | Group with several variations: one chart line per variation plus a legend of rows |
| | LedgerProgress, LedgerProgressVolume, LedgerProgressWeight | e1RM / Volume / Weight chart for one lift |
| | LedgerProgressChinUp | Same screen for a bodyweight move: Reps / Volume / +kg, reps chart (only Reps is drawn; Volume and +kg follow the same layout) |
| | LedgerProgressPicker | Exercise picker sheet |
| Open decision | LedgerTodayOrangeLemon | Today drawn in the Athletic display type (Barlow Condensed, uppercase). Optional; only matters if that type is chosen |

Not designed yet: first-time Today (no active block), Volume and +kg views for chin-up, session history (deliberately not on Progress).

Sample data is placeholder only (Full Body: A Chin Up 4x6-8; B1/B2 Chest-supported Row + Incline DB Press 3x8-10; C1/C2 Lateral Raise + Cable Pushdown; D Hanging Leg Raise; block "Deadlift Peak", phases Accumulation / Intensification / Peak / Deload).

## D. Visual direction (decided; all boards now use it)

- Base ("Ledger"): background `#F6F5F1`, ink `#16181D`, muted `#62666F`, divider `#E3E1DA`, border `#CFCCC3`, tag fill `#ECEAE3`, faint `#9A9DA4`; IBM Plex Sans + IBM Plex Mono (mono for numbers/tags). Roughly 60% stone, 30% ink, 10% accents.
- **Orange `#FF9500` = action colour** ("what to tap next / where you are"). Used for: primary buttons (Start workout, Log, Skip, Finish, Save, Start this block, Choose file), the current-set marker (left bar), the active exercise tab underline, the current-session segment in progress bars, the active bottom-tab bar, the selected-row tick, the latest point on Progress charts, and the whole rest-over screen. **Always dark ink text on orange fills**, never white.
- **Lemon `#FFD60A` = highlight.** Used for: the rest countdown and its progress bar (on the dark takeover), the e1RM tag, the "Up next" chip (Today, Phase detail). Use lemon only on dark surfaces or as a filled shape with dark text, never as text on the light background.
- Ink stays for: done progress segments, done check circles, selected segmented-control and range-chip states, body text and rules.
- **Error / destructive: brick red `#A8301B`** with white text, used only for destructive confirms (Remove from remaining sessions). Do not use orange for errors.
- Type: **IBM Plex stays the working default.** The Athletic alternative (Barlow Condensed, uppercase) exists as one optional Today board; adopting it is a styling-only change.
- No gradients, shadows or borders-as-decoration; corners 8-12px on controls, 12px on cards.

## E. Open questions to answer from the code/data model

1. Does the plan JSON schema already contain per-phase sets/reps/intensity needed for look-ahead?
2. How are completed sessions stored, and can "x of N" be derived per workout per phase?
3. How are plan edits stored? Can the workout template be edited for all future sessions without losing the record of what past sessions prescribed?
4. Is there existing rest-timer state, and does it survive backgrounding?
5. Are skipped sets distinguishable from not-yet-logged sets in the schema?
6. What is the current navigation? Is there a Today/Training/Progress split, or a different structure?
7. Is e1RM computed server-side or client-side, and when?

## G. Checked against a real plan (lesley-training-plan.json + schema, 20 Oct 2026)

12 weeks, 3 days/week, 6 exercises/day = 216 entries. Phases (`mesocycle`): Accumulation weeks 1-4, Intensification 5-8, Peak 9-11, Deload 12. Workouts (`day_label`): Upper, Lower, Full. Series A-F on every day. No supersets (no A1/A2), no ramps (`load_scheme` omitted), no `peaking_focus`.

**Decisions made after this check (these override the open items below)**
- **Exercise title and description.** The logger title is the `exercise_group` ("Chin Up"). The full `exercise_name` is shown in the description line below it. The schema's "name shown unchanged" rule is met because the full name is displayed in full. (Resolves item 3.)
- **Exercise notes** (`notes`) go in the same description area, under the full name, in muted 13px text, clamped to 2 lines with a "More" expand. Real notes are 71 and 182 characters; the short one fits in 2 lines, the long one needs the expand. (Resolves item 7.)
- **Edits stay inside the current phase.** "Remaining sessions" means remaining sessions in this phase, for every edit path (workout detail Edit, and the logger's "Also apply to remaining sessions"). Sessions already logged keep their values. Boards say "in this phase". (Resolves item 5.)
- **Workout names:** the plan generator writes "Upper Body", "Lower Body", "Full Body" in `day_label`. (Resolves item 2.)
- **Progress shows one line per variation.** The picker lists `exercise_group`s. A group with several variations (Bench Press) draws one line per `variation`, with a legend of rows under the chart (line swatch, variation label, session count, latest value, change). Line styles: ink solid, orange solid, ink dashed, so colour is never the only cue; a 4th variation would need another dash pattern. A group with one variation shows a single line and no legend. Board: LedgerProgressVariations. (Resolves item 11.)
- Placeholder text on the boards was corrected ("Week 3 of 12 - Accumulation", no "Deadlift peak"). Sample exercise names and the block name on the boards are still placeholders.

**What the design already matches**
- Hierarchy: plan = Training block, `mesocycle` = Phase, `day_label` = Workout, one entry per exercise per week = Session. "Phase 1 of 4" and three workouts are right.
- Six exercise tabs (A-F), 4-digit tempo, `rest_sec`, `equipment: "Bodyweight"` for Chin Up, per-phase prescriptions in the file (so Look-ahead is possible), `exercise_group` + `variation` for Progress.

**Where the design assumed something the data does not say** (each needs a decision or a design change)
1. **Sessions per workout per phase is not always 4.** It equals the weeks in the phase: Accumulation 4, Intensification 4, Peak 3, Deload 1 (phase totals 12 / 12 / 9 / 3 sessions). Counts must be derived from the entries, never hard-coded. Deload reads "Session 1 of 1".
2. **Workout names.** `day_label` is "Upper", "Lower", "Full"; the boards say "Upper Body", "Lower Body", "Full Body". Preferred fix: the plan generator writes the longer names. Otherwise "Full" shows on its own in 44px type.
3. **Long exercise names.** `exercise_name` is shown unchanged and runs to 73 characters (e.g. "Leg Curl - Lying - Unilateral - Dorsiflex - 1 Leg first"). The boards use short names with a subtitle ("Chin Up", "Supinated - mid grip"). Decide: (A) show the full name wrapping to 2-3 lines at a smaller size in the logger and 2-line truncation in lists, or (B) show `exercise_group` as the title and `variation` as the subtitle in the logger. B reads better but breaks the schema rule that the name is never split. Recommendation: A in the logger, group names only in the Progress picker.
4. **Reps are single numbers here** (9, 11, 5, 3), not ranges. Tags read "4 x 9". The design only shows ranges ("6-8"). Schema also allows "30s" and "MAX": no screen is designed for a timed set or a max-reps set (the Reps input would change).
5. **Prescriptions change per phase.** Chin Up: 4x9 rest 90 > 4x5 rest 120 > 3x3 rest 150 > 2x5 rest 60. Some exercises are swapped between phases (different `exercise_name`). "Remaining sessions" edits to sets/reps/rest should probably stay **inside the current phase**, otherwise a 4x9 edit would overwrite the Peak 3x3. Confirm the rule; it also decides what "Swap exercise" means.
6. **Weights are "TBD" for 144 of 216 entries** (everything from Intensification on, status "Pending - set from Accumulation block performance"). The design always shows a suggested weight. Needed: a "no target yet" state, falling back to the last logged session of the same exercise, else empty. If a swap changes the name, there is no history and "Last" shows a dash. Not designed.
7. **`notes` exists on 36 entries** (e.g. "Locked exercise - stays the same all program", and a warning that Plank reps are a placeholder). The logger has nowhere to show a note. Needs a small muted line under the exercise title (expandable if long). Not designed.
8. **Superset toggle in Edit.** In the file a superset is a series name with a number (B1/B2). "Superset with next" would have to rename series and shift the letters. Ask how the code stores that; the plan itself contains no supersets, so the superset boards cannot be tested with this file.
9. **Spread tag.** `load_scheme` is omitted in this plan, which means equal weights. Hide the "spread" tag in that case instead of showing "spread =".
10. **Bodyweight rule for Progress.** `equipment === "Bodyweight"` gives the Reps chart by default, but Plank is also Bodyweight and is a hold, not reps. Treat timed or placeholder-rep exercises separately (or leave Plank off the Reps default).
11. **Progress has 15 groups, and a group can hold several variations** (Bench Press has 15 deg decline, 65 deg and 45 deg semi-pronated). The boards draw one line. Needs one line per `variation` (label from `variation`) with a small legend or chips. The picker lists the 15 groups, not 40 exercises. Not designed.
12. **Placeholder text on the boards that the data contradicts:** "Accumulation - Deadlift peak" (this plan has no peaking focus: drop the subtitle), "Week 3 - Intensification" in the logger header (weeks are plan-wide; Intensification is weeks 5-8, so use e.g. "Week 6 of 12 - Intensification"), the block name "Deadlift Peak" (real name: "Lesley - 12-Week Training Plan (Chin-Up Locked)", long; allow 2 lines).

**Still not designed because of this data:** timed/MAX sets, the TBD-weight state, the Deload phase look (1 session per workout).

## F. What to produce

An impact report with three lists: (1) pure UI changes, with the files/components affected; (2) changes needing logic, data model or schema changes (with migrations), ordered by risk; (3) things already built that conflict with this design. Include a suggested order of work. The database changes from the first assessment are already done; use this report for the remaining UI work.
