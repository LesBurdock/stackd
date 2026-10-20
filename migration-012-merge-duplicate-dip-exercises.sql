-- Migration 012: merge the duplicate exercise rows "Dips" and "Dip" into one ("Dip").
-- Every table that references exercises(id) is re-pointed first (found automatically from the foreign keys),
-- so no workout history, template row or peak-lift link is lost; then the duplicate row is deleted.
-- Runs as one block: if any step fails, nothing is changed.
--
-- PREREQUISITES: 004 and 010 applied (so both rows already share group 'Dip').
-- Test project first; take a manual pg_dump of production first.
-- If only one of the two rows exists, it prints a notice and does nothing.

do $$
declare
  keep_id uuid;
  drop_id uuid;
  r record;
  moved bigint;
begin
  select id into keep_id from exercises where name = 'Dip'  order by id limit 1;
  select id into drop_id from exercises where name = 'Dips' order by id limit 1;

  if keep_id is null or drop_id is null then
    raise notice 'Nothing to merge (Dip: %, Dips: %).', keep_id, drop_id;
    return;
  end if;

  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = 'exercises'::regclass
  loop
    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using keep_id, drop_id;
    get diagnostics moved = row_count;
    raise notice 're-pointed % row(s) in %.%', moved, r.tbl, r.col;
  end loop;

  delete from exercises where id = drop_id;
  raise notice 'Merged "Dips" into "Dip".';
end $$;

-- Review: should show a single "Dip" row and no "Dips".
select name, group_name, variation from exercises where name in ('Dip', 'Dips');
