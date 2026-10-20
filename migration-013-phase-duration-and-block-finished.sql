-- Migration 013: store each phase's length and when a block was finished.
--   training_block_phases.duration_weeks : weeks in the phase (e.g. Accumulation 4, Peak 3, Deload 1).
--     Needed for "Session x of N" and the "6 of 12" phase counts. The importer will save it from now on
--     (count of distinct `week` values per mesocycle in the plan file).
--   training_blocks.finished_at          : set when a block is finished ("Finished today", date ranges).
-- Both columns are nullable and additive: safe before the code ships. The code that reads them must only be
-- deployed AFTER this migration (selecting a missing column errors).
-- Test project first; pg_dump production first.

alter table training_block_phases add column if not exists duration_weeks int;
alter table training_blocks add column if not exists finished_at timestamptz;

-- Backfill 1: phases whose prescriptions vary by week -> number of distinct weeks recorded.
update training_block_phases ph
set duration_weeks = s.weeks
from (
  select p.phase_id, count(distinct ps.week_number) as weeks
  from programmes p
  join programme_exercises pe on pe.programme_id = p.id
  join programme_sets ps on ps.programme_exercise_id = pe.id
  where p.phase_id is not null and ps.week_number is not null
  group by p.phase_id
) s
where ph.id = s.phase_id
  and ph.duration_weeks is null;

-- Backfill 2: the standard 12-week plans (Les's and Neil's real blocks). A block qualifies only if
-- weeks_total = 12 and it has exactly four phases labelled Accumulation, Intensification, Peak, Deload.
-- Those phases are 4 / 4 / 3 / 1 weeks (confirmed from both plan files). Any other block is left null.
update training_block_phases ph
set duration_weeks = case ph.phase_label
    when 'Accumulation' then 4
    when 'Intensification' then 4
    when 'Peak' then 3
    when 'Deload' then 1
  end
where ph.duration_weeks is null
  and ph.phase_label in ('Accumulation', 'Intensification', 'Peak', 'Deload')
  and ph.block_id in (
    select b.id
    from training_blocks b
    where b.weeks_total = 12
      and (select count(*) from training_block_phases x where x.block_id = b.id) = 4
      and (select count(distinct x.phase_label) from training_block_phases x
           where x.block_id = b.id
             and x.phase_label in ('Accumulation', 'Intensification', 'Peak', 'Deload')) = 4
  );

-- Backfill 3: archived blocks -> last completed session in the block, else created_at.
update training_blocks b
set finished_at = coalesce(
  (select max(s.completed_at)
   from workout_sessions s
   join programmes p on p.id = s.programme_id
   join training_block_phases ph on ph.id = p.phase_id
   where ph.block_id = b.id),
  b.created_at)
where b.status = 'archived'
  and b.finished_at is null;

-- Review: for the real 12-week blocks, weeks_sum should equal weeks_total (12) and phases_with_length should
-- be 4. Blocks showing fewer phases with a length are left for the importer / manual fix.
select b.name, b.status, b.weeks_total,
       count(ph.id) as phases,
       count(ph.duration_weeks) as phases_with_length,
       sum(ph.duration_weeks) as weeks_sum,
       b.finished_at
from training_blocks b
left join training_block_phases ph on ph.block_id = b.id
group by b.id, b.name, b.status, b.weeks_total, b.finished_at, b.created_at
order by b.created_at;
