-- Migration 001: introduce training_block_phases
-- Run once in the Supabase SQL editor.

-- 1. New phases table
create table training_block_phases (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  order_index int not null default 0,
  phase_label text not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'archived'))
);

-- 2. RLS for training_block_phases
alter table training_block_phases enable row level security;

create policy "select own" on training_block_phases for select using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);
create policy "insert own" on training_block_phases for insert with check (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);
create policy "update own" on training_block_phases for update using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);
create policy "delete own" on training_block_phases for delete using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_phases.block_id and training_blocks.user_id = auth.uid())
);

-- 3. Update programmes table
-- Widen any 'planned' rows before tightening the constraint
update programmes set status = 'active' where status = 'planned';

alter table programmes drop constraint if exists programmes_status_check;
alter table programmes drop column if exists block_id;
alter table programmes drop column if exists block_order;
alter table programmes drop column if exists phase_label;

alter table programmes add column phase_id uuid references training_block_phases(id) on delete set null;
alter table programmes add constraint programmes_status_check check (status in ('active', 'archived'));
