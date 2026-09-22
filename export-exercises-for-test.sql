-- Run this in PRODUCTION's SQL Editor (not the test project).
-- It doesn't modify anything -- it's a read-only SELECT that builds one INSERT
-- statement per row in `exercises`, as a single copy-pasteable text blob.
--
-- created_by_user_id is hardcoded to NULL in the generated statements: the test
-- project's auth.users is a completely separate table, so any production user id
-- would be a dangling reference there and violate the `references auth.users(id)`
-- foreign key on insert.
--
-- The SQL Editor runs as a role that bypasses RLS, so this returns all ~125 rows
-- regardless of which of the two production accounts created each one.
--
-- No `variation` column here -- that's added by migration-004, which hasn't run on
-- production yet, so production's real `exercises` table doesn't have it.

select string_agg(
  format(
    'insert into exercises (id, name, category, muscle_group, equipment, default_rest_seconds, rounding_increment, is_custom, created_by_user_id, created_at) values (%L, %L, %L, %L, %L, %L, %L, %L, NULL, %L);',
    id, name, category, muscle_group, equipment,
    default_rest_seconds, rounding_increment, is_custom, created_at
  ),
  E'\n'
) as insert_statements
from exercises;

-- Next steps:
--   1. Run the query above in production's SQL Editor.
--   2. Click into the single `insert_statements` result cell and copy its full text
--      (it'll be one long value containing ~125 semicolon-terminated INSERT lines).
--   3. Paste that text into the stackd-test project's SQL Editor and run it.
--   4. Verify: `select count(*) from exercises;` in the test project should return 125.
