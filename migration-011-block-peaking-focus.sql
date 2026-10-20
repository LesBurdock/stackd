-- Migration 011: give training_blocks real columns for the plan's `peaking_focus`.
-- The import spec mapped peaking_focus.reason / .replaces onto training_block_peak_lifts,
-- but that table has no such columns (only id, block_id, exercise_id, order_index), so
-- that text had nowhere to go -- a lossless-import gap (design principle 13).
-- These three values describe the block's peaking focus AS A WHOLE (the label can name
-- several lifts, e.g. "Dip / Leg Press"), so they belong on training_blocks, not repeated
-- on each peak-lift row. training_block_peak_lifts rows are still created by name-matching
-- the label to exercises where possible; the raw label is kept here regardless, so nothing
-- is lost if a label can't be matched to an exercise.
--
-- Additive and nullable; safe at any time. Test project first; pg_dump production first.

alter table training_blocks add column if not exists peaking_label text;
alter table training_blocks add column if not exists peaking_replaces text;
alter table training_blocks add column if not exists peaking_reason text;

-- Review: columns exist, all null on existing blocks.
select count(*) as blocks, count(peaking_label) as with_label from training_blocks;
