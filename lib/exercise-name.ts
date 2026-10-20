// Chart-line label only -- used exclusively by Progress. exercises.name is the full
// display name and is shown everywhere else in the app exactly as stored; this helper
// does NOT get used for the exercise library, builder, programme detail, logger, or
// import preview -- those all just render `name` directly.

export function chartLabel(ex: { name: string; variation: string | null }): string {
  return ex.variation ?? ex.name
}
