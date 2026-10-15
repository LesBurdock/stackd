-- Migration 007: allow an exercise to be added to a single session on the day.
-- session_exercises.programme_exercise_id becomes nullable. NULL means "added during
-- this session" (an extra), so no separate flag column is needed. Sessions themselves
-- still require a programme_id -- there is still no freestyle SESSION, only extra
-- exercises inside a session that belongs to a workout.
-- Nothing else changes: logged_sets.programme_set_id is already nullable, and progress
-- queries join through session_exercises.exercise_id, so extras appear in history/charts.
--
-- Run order: AFTER 006. Test project first; pg_dump production before applying.
-- Additive and non-destructive (loosens a constraint; no data touched).

alter table session_exercises alter column programme_exercise_id drop not null;

-- Review: should return 0 extras right after applying.
select count(*) as extra_exercises from session_exercises where programme_exercise_id is null;
