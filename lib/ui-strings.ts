// Shared user-facing strings. Per CLAUDE.md's Glossary: on-screen text always uses the
// "On screen" column terms (Training block / Phase / Workout / Session), never the
// code/database names (programme, programme_exercise, etc). Code, tables, routes and
// filenames keep their existing names — only what's rendered to the user changes.
//
// Centralized here (rather than inlined at each call site) so that when the bottom nav
// moves from two tabs (Training / Progress) to three (Today / Training / Progress), the
// label text only needs to change in one place.

export const UI_STRINGS = {
  navToday: 'Today',
  navTraining: 'Training',
  navProgress: 'Progress',
  standaloneWorkoutsHeading: 'Standalone workouts',
  phaseWorkoutsHeading: 'Workouts',
  addWorkoutHeading: 'Add workout',
  workoutNameLabel: 'Workout name',
  workoutNameRequiredError: 'Give this workout a name.',
  multiWorkoutsPerPhaseHelpText: 'You can add multiple workouts to this phase — e.g. Upper, Lower, and Full body running side by side.',
  addWorkoutButton: 'Add workout',
  addWorkoutButtonLoading: 'Adding…',
  importStatWorkouts: 'Workouts',
  workoutNotFoundError: 'Workout not found',
} as const
