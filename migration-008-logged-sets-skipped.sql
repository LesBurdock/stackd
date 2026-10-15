-- Migration 008: distinguish a SKIPPED set from a not-yet-logged one.
-- When a session is finished, any planned set that was never logged is saved as a
-- logged_sets row with skipped = true (weight 0, reps/duration null). Not-yet-logged
-- sets simply have no row while the session is in progress.
--
-- IMPORTANT for app code: every progress / history / "Last" / e1RM / volume query must
-- exclude skipped sets (add `and not skipped`), or skipped rows (weight 0) will pollute charts.
--
-- Run order: AFTER 007. Test project first; pg_dump production before applying.
-- Additive and non-destructive: existing rows get skipped = false.

alter table logged_sets add column if not exists skipped boolean not null default false;

-- Review: should be 0 right after applying.
select count(*) as skipped_sets from logged_sets where skipped;
