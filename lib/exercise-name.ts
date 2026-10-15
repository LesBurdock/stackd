// Shared display formatting for exercises.name + exercises.variation (migration 004/010).
// `variation` is nullable -- some exercises genuinely have none (e.g. "Plank", "Dip") -- so
// a null/empty variation must render as just the base name, never a trailing " - ".

export function formatExerciseName(name: string, variation?: string | null): string {
  return variation ? `${name} - ${variation}` : name
}
