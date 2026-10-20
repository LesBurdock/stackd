-- Migration 009: support "Just today" edits and safe deletion of template rows that have history.
--
-- 1. session_exercises.overrides (jsonb): changes made for THIS session only. Logger shows
--    overrides when present, else the template. Allowed keys (all optional):
--      num_sets, target_reps_min, target_reps_max, target_duration_seconds,
--      tempo, rest_seconds, superset_group, superset_order, removed (true = not doing it today)
--    Swap-just-today and reorder-just-today need no override: the session row already has its
--    own exercise_id and order_index. Individual set weights are never overridden.
--
-- 2. Deleting a template exercise/set that already has history used to FAIL (no cascade).
--    Change both links to ON DELETE SET NULL. History survives because it keeps its own
--    exercise_id (session_exercises) -- the link to the template row is simply cleared.
--    Note: programme_exercise_id IS NULL now means "no template link" (added on the day,
--    migration 007, OR template row later deleted). Both are fine for all current uses.
--
-- Run order: AFTER 008 (007 must already have made programme_exercise_id nullable).
-- Test first; pg_dump production before applying. Additive/loosening only; no data changed.

alter table session_exercises add column if not exists overrides jsonb not null default '{}'::jsonb;

do $$
declare c text;
begin
  -- session_exercises.programme_exercise_id -> programme_exercises(id)
  for c in
    select con.conname from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    where t.relname = 'session_exercises' and con.contype = 'f'
      and con.confrelid = 'programme_exercises'::regclass
  loop
    execute format('alter table session_exercises drop constraint %I', c);
  end loop;
  alter table session_exercises
    add constraint session_exercises_programme_exercise_id_fkey
    foreign key (programme_exercise_id) references programme_exercises(id) on delete set null;

  -- logged_sets.programme_set_id -> programme_sets(id)
  for c in
    select con.conname from pg_constraint con
    join pg_class t on t.oid = con.conrelid
    where t.relname = 'logged_sets' and con.contype = 'f'
      and con.confrelid = 'programme_sets'::regclass
  loop
    execute format('alter table logged_sets drop constraint %I', c);
  end loop;
  alter table logged_sets
    add constraint logged_sets_programme_set_id_fkey
    foreign key (programme_set_id) references programme_sets(id) on delete set null;
end $$;

-- Review: both should show 'n' (SET NULL) in confdeltype.
select conname, confdeltype from pg_constraint
where conname in ('session_exercises_programme_exercise_id_fkey', 'logged_sets_programme_set_id_fkey');
