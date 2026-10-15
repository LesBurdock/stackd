-- Migration 004: add the `variation` column to exercises. Column ONLY -- no data is changed.
-- (Renamed/reduced from the earlier "split" version: selecting or inserting a column that
-- doesn't exist makes Supabase error, so the app code that reads/writes `variation` can only
-- be deployed AFTER this column exists. The actual data split now lives in migration 010,
-- which runs once that code is live.)
--
-- Purely additive and nullable: nothing existing is affected. Safe to apply to production
-- at any time, before the app code ships. Test project first; pg_dump production first.

alter table exercises add column if not exists variation text;

-- Review: should show the new column, all null.
select count(*) as total, count(variation) as with_variation from exercises;
