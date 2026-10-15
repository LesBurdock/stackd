-- Migration 006: add programmes.order_index (on screen: Workout order within a phase).
-- Purpose: display order + tie-break for the Today suggestion ("furthest behind" ties
-- at the start of a phase). It is a SUGGESTION only -- it never schedules or locks
-- anything; any workout can still be done on any day.
-- Nullable: manually created workouts and standalone workouts (phase_id null) may be null;
-- the app falls back to created_at, then name.
--
-- Run order: AFTER 005. Test project first; pg_dump production before applying.

alter table programmes add column if not exists order_index int;

-- Best-effort backfill for programmes that already exist. The original day_num was
-- discarded on import, so the true order can't be recovered from the database.
-- Bulk imports share one created_at, so name is the tie-break ("Full Body 1" before
-- "Full Body 2"). This will NOT be right for every plan (e.g. "Upper"/"Lower").
-- REVIEW the result below and fix any wrong rows by hand with a numbered follow-up.
update programmes p
set order_index = r.rn
from (
  select id, row_number() over (partition by phase_id order by created_at, name) as rn
  from programmes
  where phase_id is not null
) r
where p.id = r.id and p.order_index is null;

-- Review: workouts per phase in their new order.
select ph.phase_label, p.order_index, p.name
from programmes p
join training_block_phases ph on ph.id = p.phase_id
order by ph.block_id, ph.order_index, p.order_index;
