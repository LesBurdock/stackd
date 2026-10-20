// Tab letters (A, B1/B2, C...) are derived from order and superset grouping, never stored --
// see CLAUDE.md's Design handoff "Logger" paragraph. Reused by Workout detail and (later) the
// Logger itself, so reorder/delete/"Superset with next" never need to rename anything.

export type ExerciseForTabs = {
  orderIndex: number
  supersetGroup: string | null
  supersetOrder: number | null
}

export function assignTabLabels<T extends ExerciseForTabs>(exercises: T[]): (T & { tabLabel: string })[] {
  const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex)
  const groupLetters = new Map<string, string>()
  let code = 'A'.charCodeAt(0)

  return sorted.map(ex => {
    if (!ex.supersetGroup) {
      const letter = String.fromCharCode(code)
      code++
      return { ...ex, tabLabel: letter }
    }
    if (!groupLetters.has(ex.supersetGroup)) {
      groupLetters.set(ex.supersetGroup, String.fromCharCode(code))
      code++
    }
    const letter = groupLetters.get(ex.supersetGroup)!
    return { ...ex, tabLabel: `${letter}${ex.supersetOrder ?? 1}` }
  })
}
