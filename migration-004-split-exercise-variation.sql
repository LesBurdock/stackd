-- Migration 004: split `exercises.name` into a base movement name + a separate
-- `variation` column (e.g. "Chin Up" + "Supinated - Mid" instead of one compound
-- string). Run through the test-environment-first workflow (Database change
-- workflow section above) -- this touches all 125 existing rows.

-- 1. Add the new column
alter table exercises add column if not exists variation text;

-- 2. Explicit fixes for two known-bad cases found by testing the general split
--    rule against every real exercise name before writing this migration --
--    both have equipment/angle qualifiers prefixed BEFORE the movement name,
--    which breaks the "split on the first dash" assumption the general rule
--    below relies on. Fix these two by exact name match before the general
--    rule runs, so they don't get the wrong split.
update exercises
set name = 'Bench press', variation = '45° - DB - Semipronated'
where name = '45° DB Bench press - Semipronated';

update exercises
set name = 'Y Raise', variation = 'Prone - DB - 45° - Bench'
where name = 'Y - Raise - Prone - DB - 45° - Bench';

-- 3. General rule for everything else: split on the first " - " or " – "
--    (hyphen or en-dash, both surrounded by spaces). Exercises with no such
--    delimiter (e.g. "Plank", "Dip") keep their full name with variation left
--    null -- there's nothing to split, and that's correct, not a miss.
update exercises
set
  variation = nullif(trim(substring(name from ' [-–] (.*)$')), ''),
  name = trim(regexp_replace(name, ' [-–] .*$', ''))
where variation is null
  and name not in ('Bench press', 'Y Raise'); -- don't re-touch the two rows just fixed above

-- 4. Sanity check after running -- eyeball this before moving on. Anything with
--    a very short base name (<=3 chars) or a base name that doesn't look like
--    a real movement is worth a manual look, same reasoning as the equipment
--    backfill: a wrong automated split is worse than one left for a human to
--    fix by hand.
select name, variation from exercises order by name;
