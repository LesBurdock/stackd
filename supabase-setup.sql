-- ============================================================
-- STACKD — full schema, RLS, and seed data
-- Paste this into the Supabase SQL editor and run it once.
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  muscle_group text[],
  equipment text,
  default_rest_seconds int not null default 90,
  rounding_increment numeric not null default 2.5,
  is_custom boolean not null default false,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table training_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table training_block_goals (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  description text not null,
  order_index int not null default 0,
  achieved boolean not null default false,
  achieved_at timestamptz
);

create table training_block_peak_lifts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references training_blocks(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

create table programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  status text not null default 'active' check (status in ('planned', 'active', 'archived')),
  block_id uuid references training_blocks(id) on delete set null,
  block_order int,
  phase_label text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table programme_exercises (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0,
  num_sets int not null default 1,
  superset_group text,
  superset_order int,
  tempo text,
  rest_seconds int,
  load_scheme text not null default 'equal' check (load_scheme in ('equal', 'ramp')),
  ramp_end_percent numeric,
  notes text
);

create table programme_sets (
  id uuid primary key default gen_random_uuid(),
  programme_exercise_id uuid not null references programme_exercises(id) on delete cascade,
  set_number int not null,
  target_weight numeric,
  target_reps_min int,
  target_reps_max int,
  target_rir int,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'dropset', 'amrap')),
  load_type text not null default 'absolute' check (load_type in ('absolute', 'percent_of_reference_set', 'percent_of_1rm')),
  load_percent numeric,
  reference_set_number int
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  programme_id uuid not null references programmes(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned'))
);

create table session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  programme_exercise_id uuid not null references programme_exercises(id),
  exercise_id uuid not null references exercises(id),
  order_index int not null default 0
);

create table logged_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references session_exercises(id) on delete cascade,
  programme_set_id uuid references programme_sets(id),
  set_number int not null,
  weight numeric not null default 0,
  reps int not null,
  rir int,
  rpe int
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
alter table profiles enable row level security;
create policy "select own profile" on profiles for select using (id = auth.uid());
create policy "update own profile" on profiles for update using (id = auth.uid());

-- exercises (mixed public/private)
alter table exercises enable row level security;
create policy "view global or own custom" on exercises for select using (is_custom = false or created_by_user_id = auth.uid());
create policy "insert own custom" on exercises for insert with check (is_custom = true and created_by_user_id = auth.uid());
create policy "update own custom" on exercises for update using (created_by_user_id = auth.uid());
create policy "delete own custom" on exercises for delete using (created_by_user_id = auth.uid());

-- training_blocks
alter table training_blocks enable row level security;
create policy "select own" on training_blocks for select using (user_id = auth.uid());
create policy "insert own" on training_blocks for insert with check (user_id = auth.uid());
create policy "update own" on training_blocks for update using (user_id = auth.uid());
create policy "delete own" on training_blocks for delete using (user_id = auth.uid());

-- training_block_goals (via training_blocks)
alter table training_block_goals enable row level security;
create policy "select own" on training_block_goals for select using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);
create policy "insert own" on training_block_goals for insert with check (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);
create policy "update own" on training_block_goals for update using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);
create policy "delete own" on training_block_goals for delete using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_goals.block_id and training_blocks.user_id = auth.uid())
);

-- training_block_peak_lifts (via training_blocks)
alter table training_block_peak_lifts enable row level security;
create policy "select own" on training_block_peak_lifts for select using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);
create policy "insert own" on training_block_peak_lifts for insert with check (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);
create policy "update own" on training_block_peak_lifts for update using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);
create policy "delete own" on training_block_peak_lifts for delete using (
  exists (select 1 from training_blocks where training_blocks.id = training_block_peak_lifts.block_id and training_blocks.user_id = auth.uid())
);

-- programmes
alter table programmes enable row level security;
create policy "select own" on programmes for select using (user_id = auth.uid());
create policy "insert own" on programmes for insert with check (user_id = auth.uid());
create policy "update own" on programmes for update using (user_id = auth.uid());
create policy "delete own" on programmes for delete using (user_id = auth.uid());

-- programme_exercises (via programmes)
alter table programme_exercises enable row level security;
create policy "select own" on programme_exercises for select using (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);
create policy "insert own" on programme_exercises for insert with check (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);
create policy "update own" on programme_exercises for update using (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);
create policy "delete own" on programme_exercises for delete using (
  exists (select 1 from programmes where programmes.id = programme_exercises.programme_id and programmes.user_id = auth.uid())
);

-- programme_sets (via programme_exercises -> programmes)
alter table programme_sets enable row level security;
create policy "select own" on programme_sets for select using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
create policy "insert own" on programme_sets for insert with check (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
create policy "update own" on programme_sets for update using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);
create policy "delete own" on programme_sets for delete using (
  exists (
    select 1 from programme_exercises
    join programmes on programmes.id = programme_exercises.programme_id
    where programme_exercises.id = programme_sets.programme_exercise_id
    and programmes.user_id = auth.uid()
  )
);

-- workout_sessions
alter table workout_sessions enable row level security;
create policy "select own" on workout_sessions for select using (user_id = auth.uid());
create policy "insert own" on workout_sessions for insert with check (user_id = auth.uid());
create policy "update own" on workout_sessions for update using (user_id = auth.uid());
create policy "delete own" on workout_sessions for delete using (user_id = auth.uid());

-- session_exercises (via workout_sessions)
alter table session_exercises enable row level security;
create policy "select own" on session_exercises for select using (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);
create policy "insert own" on session_exercises for insert with check (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);
create policy "update own" on session_exercises for update using (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);
create policy "delete own" on session_exercises for delete using (
  exists (select 1 from workout_sessions where workout_sessions.id = session_exercises.workout_session_id and workout_sessions.user_id = auth.uid())
);

-- logged_sets (via session_exercises -> workout_sessions)
alter table logged_sets enable row level security;
create policy "select own" on logged_sets for select using (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);
create policy "insert own" on logged_sets for insert with check (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);
create policy "update own" on logged_sets for update using (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);
create policy "delete own" on logged_sets for delete using (
  exists (
    select 1 from session_exercises
    join workout_sessions on workout_sessions.id = session_exercises.workout_session_id
    where session_exercises.id = logged_sets.session_exercise_id
    and workout_sessions.user_id = auth.uid()
  )
);


-- ============================================================
-- SEED DATA — exercise library (~80 exercises)
-- ============================================================

insert into exercises (name, category, muscle_group, equipment, default_rest_seconds, rounding_increment, is_custom) values

-- Barbell compounds
('Barbell Back Squat',        'Legs',          array['Quads','Glutes','Hamstrings'],   'Barbell', 180, 2.5, false),
('Barbell Front Squat',       'Legs',          array['Quads','Core'],                  'Barbell', 180, 2.5, false),
('Barbell Romanian Deadlift', 'Legs',          array['Hamstrings','Glutes'],           'Barbell', 180, 2.5, false),
('Conventional Deadlift',     'Back',          array['Hamstrings','Glutes','Back'],    'Barbell', 240, 2.5, false),
('Sumo Deadlift',             'Back',          array['Hamstrings','Glutes','Adductors'],'Barbell',240, 2.5, false),
('Barbell Bench Press',       'Chest',         array['Chest','Triceps','Front Delts'], 'Barbell', 180, 2.5, false),
('Incline Barbell Bench Press','Chest',        array['Upper Chest','Triceps'],         'Barbell', 180, 2.5, false),
('Close-Grip Bench Press',    'Arms',          array['Triceps','Chest'],               'Barbell', 150, 2.5, false),
('Overhead Press',            'Shoulders',     array['Front Delts','Triceps'],         'Barbell', 180, 2.5, false),
('Push Press',                'Shoulders',     array['Front Delts','Triceps','Legs'],  'Barbell', 180, 2.5, false),
('Barbell Row',               'Back',          array['Lats','Rhomboids','Biceps'],     'Barbell', 150, 2.5, false),
('Pendlay Row',               'Back',          array['Lats','Rhomboids'],              'Barbell', 150, 2.5, false),
('Barbell Hip Thrust',        'Legs',          array['Glutes','Hamstrings'],           'Barbell', 150, 2.5, false),
('Good Morning',              'Back',          array['Hamstrings','Lower Back'],       'Barbell', 120, 2.5, false),
('Barbell Lunge',             'Legs',          array['Quads','Glutes'],                'Barbell', 120, 2.5, false),
('Barbell Bicep Curl',        'Arms',          array['Biceps'],                        'Barbell', 90,  2.5, false),

-- Dumbbell exercises
('Dumbbell Bench Press',      'Chest',         array['Chest','Triceps'],               'Dumbbell', 150, 2.0, false),
('Incline Dumbbell Press',    'Chest',         array['Upper Chest','Front Delts'],     'Dumbbell', 150, 2.0, false),
('Dumbbell Fly',              'Chest',         array['Chest'],                         'Dumbbell', 90,  2.0, false),
('Dumbbell Shoulder Press',   'Shoulders',     array['Front Delts','Triceps'],         'Dumbbell', 150, 2.0, false),
('Dumbbell Lateral Raise',    'Shoulders',     array['Side Delts'],                    'Dumbbell', 60,  1.0, false),
('Dumbbell Front Raise',      'Shoulders',     array['Front Delts'],                   'Dumbbell', 60,  1.0, false),
('Dumbbell Rear Delt Fly',    'Shoulders',     array['Rear Delts'],                    'Dumbbell', 60,  1.0, false),
('Dumbbell Row',              'Back',          array['Lats','Rhomboids','Biceps'],     'Dumbbell', 120, 2.0, false),
('Dumbbell Romanian Deadlift','Legs',          array['Hamstrings','Glutes'],           'Dumbbell', 150, 2.0, false),
('Dumbbell Goblet Squat',     'Legs',          array['Quads','Glutes'],                'Dumbbell', 120, 2.0, false),
('Dumbbell Lunge',            'Legs',          array['Quads','Glutes'],                'Dumbbell', 90,  2.0, false),
('Dumbbell Step-Up',          'Legs',          array['Quads','Glutes'],                'Dumbbell', 90,  2.0, false),
('Dumbbell Bicep Curl',       'Arms',          array['Biceps'],                        'Dumbbell', 90,  2.0, false),
('Hammer Curl',               'Arms',          array['Biceps','Brachialis'],           'Dumbbell', 90,  2.0, false),
('Incline Dumbbell Curl',     'Arms',          array['Biceps'],                        'Dumbbell', 90,  2.0, false),
('Dumbbell Tricep Kickback',  'Arms',          array['Triceps'],                       'Dumbbell', 60,  1.0, false),
('Dumbbell Overhead Tricep Extension','Arms',  array['Triceps'],                       'Dumbbell', 90,  2.0, false),
('Dumbbell Shrug',            'Back',          array['Traps'],                         'Dumbbell', 90,  2.0, false),
('Dumbbell Calf Raise',       'Legs',          array['Calves'],                        'Dumbbell', 60,  2.0, false),

-- Cable exercises
('Cable Row',                 'Back',          array['Lats','Rhomboids','Biceps'],     'Cable',  120, 2.5, false),
('Cable Lat Pulldown',        'Back',          array['Lats','Biceps'],                 'Cable',  120, 2.5, false),
('Cable Face Pull',           'Shoulders',     array['Rear Delts','Rotator Cuff'],     'Cable',  60,  2.5, false),
('Cable Lateral Raise',       'Shoulders',     array['Side Delts'],                    'Cable',  60,  2.5, false),
('Cable Fly',                 'Chest',         array['Chest'],                         'Cable',  90,  2.5, false),
('Cable Tricep Pushdown',     'Arms',          array['Triceps'],                       'Cable',  60,  2.5, false),
('Cable Overhead Tricep Extension','Arms',     array['Triceps'],                       'Cable',  60,  2.5, false),
('Cable Bicep Curl',          'Arms',          array['Biceps'],                        'Cable',  60,  2.5, false),
('Cable Crunch',              'Core',          array['Abs'],                           'Cable',  60,  2.5, false),
('Cable Hip Abduction',       'Legs',          array['Glutes','Abductors'],            'Cable',  60,  2.5, false),

-- Machine exercises
('Leg Press',                 'Legs',          array['Quads','Glutes'],                'Machine', 150, 5.0, false),
('Leg Extension',             'Legs',          array['Quads'],                         'Machine', 90,  5.0, false),
('Leg Curl',                  'Legs',          array['Hamstrings'],                    'Machine', 90,  5.0, false),
('Seated Calf Raise',         'Legs',          array['Calves'],                        'Machine', 60,  5.0, false),
('Chest Press Machine',       'Chest',         array['Chest','Triceps'],               'Machine', 120, 5.0, false),
('Pec Deck',                  'Chest',         array['Chest'],                         'Machine', 90,  5.0, false),
('Shoulder Press Machine',    'Shoulders',     array['Front Delts','Triceps'],         'Machine', 120, 5.0, false),
('Lat Pulldown Machine',      'Back',          array['Lats','Biceps'],                 'Machine', 120, 5.0, false),
('Seated Row Machine',        'Back',          array['Rhomboids','Lats'],              'Machine', 120, 5.0, false),
('Hip Thrust Machine',        'Legs',          array['Glutes'],                        'Machine', 120, 5.0, false),
('Hack Squat',                'Legs',          array['Quads','Glutes'],                'Machine', 150, 5.0, false),
('Smith Machine Squat',       'Legs',          array['Quads','Glutes'],                'Barbell', 150, 2.5, false),
('Preacher Curl Machine',     'Arms',          array['Biceps'],                        'Machine', 90,  5.0, false),
('Tricep Dip Machine',        'Arms',          array['Triceps'],                       'Machine', 90,  5.0, false),

-- Bodyweight / assisted
('Pull-Up',                   'Back',          array['Lats','Biceps'],                 'Bodyweight', 150, 2.5, false),
('Chin-Up',                   'Back',          array['Lats','Biceps'],                 'Bodyweight', 150, 2.5, false),
('Dip',                       'Chest',         array['Chest','Triceps'],               'Bodyweight', 120, 2.5, false),
('Push-Up',                   'Chest',         array['Chest','Triceps','Front Delts'], 'Bodyweight', 60,  0.0, false),
('Pike Push-Up',              'Shoulders',     array['Front Delts','Triceps'],         'Bodyweight', 60,  0.0, false),
('Inverted Row',              'Back',          array['Lats','Rhomboids'],              'Bodyweight', 90,  0.0, false),
('Box Jump',                  'Legs',          array['Quads','Glutes','Calves'],       'Bodyweight', 90,  0.0, false),
('Bulgarian Split Squat',     'Legs',          array['Quads','Glutes'],                'Bodyweight', 120, 2.5, false),
('Nordic Hamstring Curl',     'Legs',          array['Hamstrings'],                    'Bodyweight', 150, 0.0, false),
('Plank',                     'Core',          array['Abs','Core'],                    'Bodyweight', 60,  0.0, false),
('Hanging Leg Raise',         'Core',          array['Abs','Hip Flexors'],             'Bodyweight', 60,  0.0, false),
('Ab Wheel Rollout',          'Core',          array['Abs','Core'],                    'Bodyweight', 60,  0.0, false),
('Glute Bridge',              'Legs',          array['Glutes','Hamstrings'],           'Bodyweight', 60,  0.0, false),
('Calf Raise',                'Legs',          array['Calves'],                        'Bodyweight', 60,  0.0, false),

-- EZ bar / specialty
('EZ Bar Curl',               'Arms',          array['Biceps'],                        'EZ Bar', 90,  2.5, false),
('EZ Bar Skullcrusher',       'Arms',          array['Triceps'],                       'EZ Bar', 90,  2.5, false),
('EZ Bar Preacher Curl',      'Arms',          array['Biceps'],                        'EZ Bar', 90,  2.5, false),

-- Kettlebell
('Kettlebell Swing',          'Legs',          array['Glutes','Hamstrings','Core'],    'Kettlebell', 90,  4.0, false),
('Kettlebell Goblet Squat',   'Legs',          array['Quads','Glutes'],                'Kettlebell', 90,  4.0, false),
('Kettlebell Press',          'Shoulders',     array['Front Delts','Triceps'],         'Kettlebell', 90,  4.0, false);
