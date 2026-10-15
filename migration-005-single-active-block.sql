-- Migration 005: only one active training block per user at a time.
-- Adds training_blocks.status ('planned' = "Up next", 'active', 'archived') and a
-- partial unique index so the DATABASE refuses a second active block per user,
-- regardless of what the app code does.
-- Standalone programmes (phase_id null) are unaffected. This does NOT reintroduce
-- the old cap on programmes -- it only constrains blocks.
--
-- Run order: AFTER 002, 003, 004. Test project first; pg_dump production before applying.

-- 1. PRE-CHECK: abort if any user has more than one block with an active phase.
--    Resolve by hand first (archive or finish the extras), then re-run.
do $$
declare dup record; msg text := '';
begin
  for dup in
    select b.user_id, count(distinct b.id) as n
    from training_blocks b
    join training_block_phases p on p.block_id = b.id
    where p.status = 'active'
    group by b.user_id
    having count(distinct b.id) > 1
  loop
    msg := msg || format(' user %s has %s blocks with an active phase;', dup.user_id, dup.n);
  end loop;
  if msg <> '' then
    raise exception 'ABORTED: %  Fix these before applying 005.', msg;
  end if;
end $$;

-- 2. Add the column (nullable first so the backfill can run).
alter table training_blocks add column if not exists status text;

-- 3. Backfill from existing phase statuses.
update training_blocks b set status = case
  when exists (select 1 from training_block_phases p where p.block_id = b.id and p.status = 'active') then 'active'
  when exists (select 1 from training_block_phases p where p.block_id = b.id)
       and not exists (select 1 from training_block_phases p where p.block_id = b.id and p.status <> 'archived') then 'archived'
  else 'planned'
end
where status is null;

-- 4. Lock it down.
alter table training_blocks alter column status set not null;
alter table training_blocks alter column status set default 'planned';
alter table training_blocks add constraint training_blocks_status_check
  check (status in ('planned', 'active', 'archived'));

-- 5. The rule itself: at most one active block per user.
create unique index if not exists one_active_block_per_user
  on training_blocks (user_id) where status = 'active';

-- Review:
select user_id, status, count(*) from training_blocks group by user_id, status order by user_id, status;
