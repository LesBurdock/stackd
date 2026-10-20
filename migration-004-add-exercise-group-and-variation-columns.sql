-- Migration 004: add the `variation` and `group_name` columns to exercises. Columns ONLY -- no data is changed.
--   variation  : optional short label for an exercise's line on the Progress chart (e.g. 'DB - Neutral - 35°').
--   group_name : optional Progress-tab grouping label (e.g. 'Bench Press'). Null = the exercise is its own group.
-- `name` is NOT touched: it stays the full original name, shown everywhere as stored.
--
-- (Revised 2026-10-19: the earlier version of this file added only `variation`. It is safe to re-run on the
-- test project where `variation` already exists -- both statements use `if not exists`. Production has never
-- had 004. Selecting or inserting a column that doesn't exist makes Supabase error, so app code that reads or
-- writes these columns may only be deployed AFTER this migration. The data fill is migration 010.)
--
-- Purely additive and nullable: nothing existing is affected. Test project first; pg_dump production first.

alter table exercises add column if not exists variation text;
alter table exercises add column if not exists group_name text;

-- Review: both columns should exist; group_name all null (variation too, except any stale test values).
select count(*) as total, count(variation) as with_variation, count(group_name) as with_group from exercises;
