-- Migration 003: backfill muscle_group and equipment on existing exercises
-- (both were always blank due to a gap between the spec and what was actually built),
-- and resolve the never-defined `category` field.
--
-- Both patterns below were tested against every real exercise name from Neil's and
-- Lesley's actual imported plans before writing this -- muscle_group got full coverage,
-- equipment left exactly one genuine unknown ("Arnold Press - Seated - Bilateral" --
-- it's a dumbbell exercise, but nothing in the name states that explicitly). That one
-- (and anything else these patterns don't catch) stays null rather than getting a
-- guessed-wrong value -- fix it manually in the Exercise Library once that edit form
-- exists, safer than silently mislabeling it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backfill equipment
-- ─────────────────────────────────────────────────────────────────────────────

update exercises set equipment = case
  when name ~* '\mdb\M' then 'Dumbbell'
  when name ~* '\mbb\M' then 'Barbell'
  when name ~* '\mkb\M' then 'Kettlebell'
  when name ~* '\mez\M' then 'EZ Bar'
  when name ~* 'smith' then 'Smith Machine'
  when name ~* 'band' then 'Band'
  when name ~* 'pulley|cable|mag|rope|d handle' then 'Cable'
  when name ~* 'machine|leg press|hack squat|pendulum squat|leg curl|leg extension|row - seated|row - telle'
    then 'Machine'
  when name ~* 'chin up|pull up|\mdip\M|\mdips\M|plank|push up|sit up|dead bug|garhammer raise|burpee|mountain climber|hanging leg raise'
    then 'Bodyweight'
  else null
end
where equipment is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill muscle_group
-- ─────────────────────────────────────────────────────────────────────────────

update exercises set muscle_group = case
  when name ~* 'chin up|pull up|\mrow\M|lat pulldown' then array['Back']
  when name ~* 'deadlift|good morning' then array['Legs (Posterior Chain)']
  when name ~* 'hip thrust' then array['Glutes/Hip']
  when name ~* 'squat|lunge|step up|leg press|leg extension|hack squat|pendulum' then array['Legs (Quad)']
  when name ~* 'leg curl' then array['Legs (Hamstring)']
  when name ~* 'calf' then array['Legs (Calf)']
  when name ~* 'crunch|sit up|plank|dead bug' then array['Core']
  when name ~* 'shoulder press|arnold press|lateral raise|external rotation|y - raise|y-raise|trap 3|garhammer|powell raise|rotation'
    then array['Shoulders']
  when name ~* 'triceps|\mdip\M|\mdips\M|kickback' then array['Arms (Triceps)']
  when name ~* 'curl|supination|pronation' then array['Arms (Biceps)']
  when name ~* 'bench press|parillo press' then array['Chest']
  else null
end
where muscle_group is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. category -- was never actually given a defined purpose anywhere in the spec.
--    DECISION NEEDED: either drop the column, or decide what it should hold
--    (e.g. "Compound" / "Isolation" as a fixed property of the exercise itself,
--    distinct from programme_exercises.slot_role which is contextual per-programme).
--    Leaving it untouched here -- do not backfill until that's decided.
-- ─────────────────────────────────────────────────────────────────────────────
