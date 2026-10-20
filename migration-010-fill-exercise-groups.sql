-- Migration 010: fill in `group_name` and `variation` for existing exercises.
-- DATA ONLY. It never changes `exercises.name` -- the full original name stays exactly as it is.
-- (Replaces the earlier "split the name" version of 010. Source of truth: the reviewed sheet
-- exercise-name-mapping.xlsx -- 129 exact names -> group + variation, all CHECK rows confirmed.)
--
-- PREREQUISITES:
--   1. migration 004 is applied (adds `variation` and `group_name`).
--   2. The test project is NOT still running the earlier branch that displays name + variation
--      joined together (it would print the variation twice). Safe once the display code shows plain `name`.
-- Test project first; take a manual pg_dump of production first. Safe to re-run: it only touches
-- rows whose group_name is still null, so later manual edits are never overwritten.
--
-- BEFORE RUNNING on the test project (stale values from the earlier split experiment):
--   select count(*) from exercises where variation is not null;
-- Matched rows get their variation overwritten by this migration (including set to null where the
-- sheet has none), so stale values on rows that ARE on the sheet are cleaned up automatically.
--
-- The LAST query in this file is the review. Read it:
--   A: sheet name not found in exercises  -> note 'NewBlock' = expected (not imported yet);
--      any other note = the database spelling differs from the sheet: send me those names.
--   B: exercise still without a group     -> not on the sheet; give it a group by hand.
--   C: totals.

create temp table map_010 (
  orig text primary key,
  grp text not null,
  var text,
  in_plan text
);

insert into map_010 (orig, grp, var, in_plan) values
  ('Shoulder press - DB - Seated - Neutral', 'Shoulder Press', 'DB - Seated - Neutral', 'Neil'),
  ('Bench press - DB - Semi-Pronated - 35°', 'Bench Press', 'DB - Semi-Pronated - 35°', 'Neil'),
  ('Row - Seated - MAG - Supinated - Wide', 'Seated Row', 'MAG - Supinated - Wide', 'Neil'),
  ('Lateral raise - DB - Neutral - Seated', 'Lateral Raise', 'DB - Neutral - Seated', 'Les/Neil'),
  ('External Rotation - DB - Scott Bench - lateral', 'External Rotation', 'DB - Scott Bench - Lateral', 'Les/Neil'),
  ('Y - Raise - Prone - DB - 45° - Bench', 'Y Raise', 'Prone - DB - 45° - Bench', 'Neil'),
  ('Arnold Press - Seated - Bilateral', 'Arnold Press', 'Seated - Bilateral', 'Neil'),
  ('Chin Up - Neutral - Close', 'Chin Up', 'Neutral - Close', 'Neil'),
  ('Bench press - DB - Neutral - 0°', 'Bench Press', 'DB - Neutral - 0°', 'Les/Neil'),
  ('Row - Prone - DB - Semi-Pronated - 35°', 'Prone Row', 'DB - Semi-Pronated - 35°', 'Neil'),
  ('Lateral raises - mid pulley - in front of body - unilateral', 'Lateral Raise', 'Mid pulley - In front of body - Unilateral', 'Neil'),
  ('Row to neck - 75° - high pulley - supinated', 'Row to Neck', '75° - High pulley - Supinated', 'Neil'),
  ('Romanian Deadlift - DB - B Stance', 'Romanian Deadlift', 'DB - B Stance', 'Neil'),
  ('Hip Thrust - machine - regular stance', 'Hip Thrust', 'Machine - Regular stance', 'Les/Neil'),
  ('DB Walking Lunges', 'Walking Lunge', 'DB', 'Neil'),
  ('Bulgarian Split Squat - DB', 'Bulgarian Split Squat', 'DB', 'Neil'),
  ('Leg Curl - Lying - Dorsiflex', 'Leg Curl', 'Lying - Dorsiflex', 'Les/Neil/NewBlock'),
  ('Crunch - DB - Ab Mat', 'Crunch', 'DB - Ab Mat', 'Neil'),
  ('Curl - Standing - EZ - Supinated - Mid', 'Standing Curl', 'EZ - Supinated - Mid', 'Neil'),
  ('Triceps extension - EZ - Pronated - Mid - Chin - 0°', 'Lying Triceps Extension', 'EZ - Pronated - Mid - Chin - 0°', 'Neil'),
  ('Curl - Scott - DB - Bilateral - Supinated', 'Scott Curl', 'DB - Bilateral - Supinated', 'Neil'),
  ('Triceps Extension - DB - Neutral - 15° decline', 'Lying Triceps Extension', 'DB - Neutral - 15° decline', 'Neil'),
  ('Curl - 45° - DB - Bilateral - Zottman', 'Incline Curl', '45° - DB - Bilateral - Zottman', 'Neil'),
  ('Dips', 'Dip', null, 'Neil'),
  ('Row - Kneeling - D Handle - Neutral - Unilateral - High Pulley', 'Kneeling Row', 'D Handle - Neutral - Unilateral - High Pulley', 'Neil'),
  ('Lateral raise - DB - 55° Bench - Neutral', 'Lateral Raise', 'DB - 55° Bench - Neutral', 'Les/Neil'),
  ('External Rotation - Mid Pulley - D Handle', 'External Rotation', 'Mid Pulley - D Handle', 'Neil'),
  ('Trap 3 Raise - DB - 35° Bench - Prone - Neutral', 'Trap 3 Raise', 'DB - 35° Bench - Prone - Neutral', 'Neil'),
  ('Bench press - DB - Semi-Pronated - 0°', 'Bench Press', 'DB - Semi-Pronated - 0°', 'Neil'),
  ('Row - Kneeling - DB - Neutral - Unilateral - 35° - Head supported', 'Kneeling Row', 'DB - Neutral - Unilateral - 35° - Head supported', 'Neil'),
  ('Lateral raise - DB - Telle - Seated', 'Lateral Raise', 'DB - Telle - Seated', 'Neil'),
  ('Garhammer Raise - Bench - 15°', 'Garhammer Raise', 'Bench - 15°', 'Neil'),
  ('Lunges - DB - Alternating', 'Lunge', 'DB - Alternating', 'Neil'),
  ('Split Squat - DB - FFE - 15cm Box', 'Split Squat', 'DB - FFE - 15cm Box', 'Neil'),
  ('Leg Curl - Kneeling - Dorsiflex', 'Leg Curl', 'Kneeling - Dorsiflex', 'Les/Neil'),
  ('Low pulley ab crunch - floor - unilateral', 'Low Pulley Ab Crunch', 'Floor - Unilateral', 'Neil'),
  ('Curl - Standing - EZ - Pronated - Mid', 'Reverse Curl', 'Standing - EZ - Pronated - Mid', 'Neil'),
  ('Triceps extension - High Pulley - EZ - Pronated - Close', 'Triceps Extension', 'High Pulley - EZ - Pronated - Close', 'Neil'),
  ('Curl - prone - Scott - DB - neutral to supinated', 'Scott Curl', 'Prone - DB - Neutral to supinated', 'Neil'),
  ('Triceps extension - DB - Neutral - 35°', 'Lying Triceps Extension', 'DB - Neutral - 35°', 'Les/Neil'),
  ('Curl - 55° - DB - Bilateral - Zottman', 'Incline Curl', '55° - DB - Bilateral - Zottman', 'Neil'),
  ('Dip', 'Dip', null, 'Neil/NewBlock'),
  ('Row - Seated - Neutral - Mid', 'Seated Row', 'Neutral - Mid', 'Les/Neil'),
  ('Lateral Raise - Mid Pulley - Cable - In front of body - Bilateral', 'Lateral Raise', 'Mid Pulley - Cable - In front of body - Bilateral', 'Les/Neil'),
  ('External Rotation - Low Pulley - Rope - Suprinated', 'External Rotation', 'Low Pulley - Rope - Supinated', 'Neil'),
  ('Powell Raise - DB - Bench - 35° - neutral', 'Powell Raise', 'DB - Bench - 35° - Neutral', 'Les/Neil'),
  ('Bench press - DB - Neutral - 15° Decline', 'Bench Press', 'DB - Neutral - 15° Decline', 'Les/Neil'),
  ('Row - mid pulley - neutral - unilateral - 65° Bank supported', 'Supported Row', 'Mid pulley - Neutral - Unilateral - 65° Bank supported', 'Neil'),
  ('Lateral raises - Low pulley - unilateral - D-Handle', 'Lateral Raise', 'Low pulley - Unilateral - D-Handle', 'Neil'),
  ('Garhammer Raise - Hanging', 'Garhammer Raise', 'Hanging', 'Neil'),
  ('Pendulum Squat - Mid Stance', 'Pendulum Squat', 'Mid Stance', 'Les/Neil'),
  ('Poliquin Step Up - DB - 15cm Box', 'Poliquin Step Up', 'DB - 15cm Box', 'Neil'),
  ('Nordic Leg Curl - Assisted - Machine', 'Nordic Leg Curl', 'Assisted - Machine', 'Neil'),
  ('Sit Up - Decline - 35°', 'Sit Up', 'Decline - 35°', 'Neil'),
  ('Curl - Seated - DB - Bilateral - Supinated', 'Seated Curl', 'DB - Bilateral - Supinated', 'Neil'),
  ('Triceps extension - Mid Pulley - Rope', 'Triceps Extension', 'Mid Pulley - Rope', 'Neil'),
  ('Curl - 45° - DB - Bilateral - Neutral', 'Incline Curl', '45° - DB - Bilateral - Neutral', 'Neil'),
  ('Triceps extension - High Pulley - Rope', 'Triceps Extension', 'High Pulley - Rope', 'Neil'),
  ('Curl - 65° - DB - Bilateral - Zottman', 'Incline Curl', '65° - DB - Bilateral - Zottman', 'Neil'),
  ('Triceps Extension - EZ Bar - Pronated - Mid - To Forehead - 15° decline', 'Lying Triceps Extension', 'EZ Bar - Pronated - Mid - To Forehead - 15° decline', 'Neil'),
  ('Row - Seated - To Neck - Rope - Supinated', 'Row to Neck', 'Seated - Rope - Supinated', 'Neil'),
  ('Lateral raise - DB - External rotation - Prone - 35° Bench', 'Lateral Raise', 'DB - External rotation - Prone - 35° Bench', 'Neil'),
  ('External Rotation - DB- Scott Bench - frontal', 'External Rotation', 'DB - Scott Bench - Frontal', 'Neil'),
  ('Trap 3 Raise - Mid Pulley - Rope - Seated', 'Trap 3 Raise', 'Mid Pulley - Rope - Seated', 'Neil'),
  ('Bench press - DB - Pronated - 55°', 'Bench Press', 'DB - Pronated - 55°', 'Neil'),
  ('Row - Seated - Dual D Handle - Pronated - To the Neck', 'Row to Neck', 'Seated - Dual D Handle - Pronated', 'Neil'),
  ('Lateral raise - DB - 35° - unilateral - lying sideways - behind the body', 'Lateral Raise', 'DB - 35° - Unilateral - Lying sideways - Behind the body', 'Neil'),
  ('Powell Raise - DB - Bench - 15°', 'Powell Raise', 'DB - Bench - 15°', 'Les/Neil'),
  ('Side Step Up - DB - Mid Shin', 'Side Step Up', 'DB - Mid Shin', 'Neil'),
  ('Front Step Up - DB - Mid Shin', 'Front Step Up', 'DB - Mid Shin', 'Neil'),
  ('Leg Curl - Lying - Dorsiflex - Superman', 'Leg Curl', 'Lying - Dorsiflex - Superman', 'Les/Neil'),
  ('Dead Bug - Floor', 'Dead Bug', 'Floor', 'Neil'),
  ('DB Incline Curl - 45° - Supinated', 'Incline Curl', '45° - DB - Supinated', 'Neil'),
  ('Triceps extension - DB - Neutral - 0°', 'Lying Triceps Extension', 'DB - Neutral - 0°', 'Les/Neil'),
  ('Curl - Scott - EZ - Supinated - Mid', 'Scott Curl', 'EZ - Supinated - Mid', 'Neil'),
  ('Kickback - Low Pulley - bent knee', 'Kickback', 'Low Pulley - Bent knee', 'Neil'),
  ('Supination & Pronation - DB', 'Supination & Pronation', 'DB', 'Neil'),
  ('Triceps extension- High Pulley - Cable Cross', 'Triceps Extension', 'High Pulley - Cable Cross', 'Neil'),
  ('Chin Up - Supinated- Mid', 'Chin Up', 'Supinated - Mid', 'Les'),
  ('Leg press - 45° - Mid stance', 'Leg Press', '45° - Mid stance', 'Les'),
  ('Leg extension - Machine - bilateral', 'Leg Extension', 'Machine - Bilateral', 'Les'),
  ('Calf raise - Seated - Machine - Toes neutral', 'Seated Calf Raise', 'Machine - Toes neutral', 'Les'),
  ('Hack Squat - Machine - Mid Stance', 'Hack Squat', 'Machine - Mid Stance', 'Les'),
  ('Bench press - DB - Neutral - 65°', 'Bench Press', 'DB - Neutral - 65°', 'Les'),
  ('Leg Curl - Lying - Unilateral - Dorsiflex - 1 Leg first', 'Leg Curl', 'Lying - Unilateral - Dorsiflex - 1 Leg first', 'Les'),
  ('Plank', 'Plank', null, 'Les'),
  ('Bench press - DB - Neutral - 35°', 'Bench Press', 'DB - Neutral - 35°', 'Les'),
  ('Row - Seated - Pronated - Mid', 'Seated Row', 'Pronated - Mid', 'Les'),
  ('External Rotation - DB - Elbow on Knee - frontal', 'External Rotation', 'DB - Elbow on Knee - Frontal', 'Les'),
  ('Pendulum Squat - Wide Stance', 'Pendulum Squat', 'Wide Stance', 'Les'),
  ('Hack Squat - LH - High Board - Close stance', 'Hack Squat', 'LH - High Board - Close stance', 'Les'),
  ('Calf Raise - Standing - Machine - Toes In', 'Standing Calf Raise', 'Machine - Toes In', 'Les'),
  ('Pendulum Squat - Purple Band', 'Pendulum Squat', 'Purple Band', 'Les'),
  ('Bench press - DB - Semi-Pronated - 65°', 'Bench Press', 'DB - Semi-Pronated - 65°', 'Les'),
  ('Leg Curl - Lying - Plantarflex', 'Leg Curl', 'Lying - Plantarflex', 'Les'),
  ('High Plank', 'High Plank', null, 'Les'),
  ('Powell Raise - DB - Bench - 45°', 'Powell Raise', 'DB - Bench - 45°', 'Les'),
  ('Row - Seated - MAG - Neutral - Mid', 'Seated Row', 'MAG - Neutral - Mid', 'Les'),
  ('Lateral raise - 65° - prone - DB', 'Lateral Raise', '65° - Prone - DB', 'Les'),
  ('External Rotation - DB - on Knees', 'External Rotation', 'DB - On Knees', 'Les'),
  ('Triceps Extension - EZ Bar - Pronated - Close - To Forehead - 15° decline', 'Lying Triceps Extension', 'EZ Bar - Pronated - Close - To Forehead - 15° decline', 'Les'),
  ('Pendulum Squat - Close Stance', 'Pendulum Squat', 'Close Stance', 'Les'),
  ('Calf Raise - Standing - Machine - Toes Out', 'Standing Calf Raise', 'Machine - Toes Out', 'Les'),
  ('Bench press - DB - Neutral - 15°', 'Bench Press', 'DB - Neutral - 15°', 'Les'),
  ('Leg Curl - Lying - Dorsiflex to plantarflex', 'Leg Curl', 'Lying - Dorsiflex to Plantarflex', 'Les'),
  ('45° DB Bench press - Semipronated', 'Bench Press', '45° - DB - Semipronated', 'Les'),
  ('Row - Telle - Neutral - Mid', 'Telle Row', 'Neutral - Mid', 'Les'),
  ('External Rotation - DB - Elbow on Knee - lateral', 'External Rotation', 'DB - Elbow on Knee - Lateral', 'Les'),
  ('Calf raise - Standing - Machine - Toes neutral', 'Standing Calf Raise', 'Machine - Toes neutral', 'Les'),
  ('Air Bike', 'Air Bike', null, 'NewBlock'),
  ('Leg Press - 45° - Mid stance', 'Leg Press', '45° - Mid stance', 'NewBlock'),
  ('Shoulder press – DB - Neutral to Pronated - 75°', 'Shoulder Press', 'DB - Neutral to Pronated - 75°', 'NewBlock'),
  ('Trap 3 Raise – DB - 35° Bench – Prone - Neutral', 'Trap 3 Raise', 'DB - 35° Bench - Prone - Neutral', 'NewBlock'),
  ('Kosak Squat - alternierend - KH', 'Kosak Squat', 'Alternierend - KH', 'NewBlock'),
  ('Leg Curl - Lying - Dorsiflex to Plantarflex', 'Leg Curl', 'Lying - Dorsiflex to Plantarflex', 'NewBlock'),
  ('Farmers Walk - Unilateral', 'Farmers Walk', 'Unilateral', 'NewBlock'),
  ('Lat pulldown – Pronated - Mid', 'Lat Pulldown', 'Pronated - Mid', 'NewBlock'),
  ('Leg Extension - Low Pulley – Chair', 'Leg Extension', 'Low Pulley - Chair', 'NewBlock'),
  ('Triceps extension - High Pulley – EZ – Pronated – Close', 'Triceps Extension', 'High Pulley - EZ - Pronated - Close', 'NewBlock'),
  ('Curl - 45° - DB - Bilateral - Comerford', 'Incline Curl', '45° - DB - Bilateral - Comerford', 'NewBlock'),
  ('Peretials 1.0 - Neutral – Floor', 'Peretials 1.0', 'Neutral - Floor', 'NewBlock'),
  ('Bench press – DB - Neutral - 35°', 'Bench Press', 'DB - Neutral - 35°', 'NewBlock'),
  ('Row – Kneeling – To Armpit - Rope – Pronated - High Pulley', 'Kneeling Row', 'To Armpit - Rope - Pronated - High Pulley', 'NewBlock'),
  ('Bulgarian Split Squat – DB', 'Bulgarian Split Squat', 'DB', 'NewBlock'),
  ('Farmers Walk - Bilateral', 'Farmers Walk', 'Bilateral', 'NewBlock'),
  ('Chin Up - Pronated – mid', 'Chin Up', 'Pronated - Mid', 'NewBlock'),
  ('Parillo Press – DB - Neutral - 0°', 'Parillo Press', 'DB - Neutral - 0°', 'NewBlock'),
  ('Curl – Seated – DB - Bilateral - Zottman', 'Seated Curl', 'DB - Bilateral - Zottman', 'NewBlock'),
  ('Peretials 2.0 – Pronated - Floor', 'Peretials 2.0', 'Pronated - Floor', 'NewBlock');

update exercises e
set group_name = m.grp,
    variation  = m.var
from map_010 m
where e.name = m.orig
  and e.group_name is null;

-- Review (single result set):
select 'A: sheet name not found in exercises' as item, m.orig as name, m.in_plan as note
from map_010 m
where not exists (select 1 from exercises e where e.name = m.orig)
union all
select 'B: exercise still without a group', e.name, null
from exercises e
where e.group_name is null
union all
select 'C: totals', count(*)::text || ' exercises, ' || count(group_name)::text || ' with a group, ' || count(variation)::text || ' with a variation', null
from exercises
order by 1, 2;
