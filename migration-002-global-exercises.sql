-- Migration 002: make `exercises` globally readable across every account.
-- Ownership (create_by_user_id) still governs who can edit/delete a given row --
-- this only changes who can SEE the table, not who controls it.

-- Drop the old mixed public/private policy -- it assumed a distinction between
-- "global seeded" (is_custom = false) and "your own custom" rows, which no longer
-- applies now that visibility is simply everyone-can-read.
drop policy if exists "view global or own custom" on exercises;

create policy "any authenticated user can view any exercise"
  on exercises for select
  using (true);

-- Insert/update/delete stay owner-only -- Neil can add exercises visible to everyone,
-- but only he can edit or delete the ones he created, same for you.
drop policy if exists "insert own custom" on exercises;
create policy "insert own"
  on exercises for insert
  with check (created_by_user_id = auth.uid());

-- update/delete policies ("update own custom" / "delete own custom") already scope to
-- created_by_user_id = auth.uid() and don't need to change.

-- Note: `is_custom` is now vestigial -- it always ends up true, since there's no more
-- global-seeded/custom distinction to make. Left in place rather than dropped, since
-- there's live data in this table already and the column is harmless either way.
