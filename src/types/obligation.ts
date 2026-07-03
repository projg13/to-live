export type ObligationRecurrence = 'one-time' | 'yearly' | 'quarterly' | 'custom'

// Time-of-day weight point (same as anchor — minutes from midnight → weight)
export interface TimeWeight {
  time: number    // minutes from midnight
  value: number
}

// A bracket: applies when daysRemaining <= maxDaysRemaining
// Sorted ascending by maxDaysRemaining — first match wins
export interface WeightBracket {
  maxDaysRemaining: number        // this bracket activates when days left <= this
  timeCurve: TimeWeight[]         // time-of-day weight curve for this bracket
}

export interface ObligationTask {
  taskId: string
  order: number                   // sequence within obligation
  dependsOn?: string[]            // taskIds that must complete before this one starts
}

export interface Obligation {
  id: string
  name: string                    // e.g., "Passport Application", "Income Tax Filing"

  // Tasks in this obligation
  tasks: ObligationTask[]

  // Deadline (optional — if absent, no escalation, uses the first bracket always)
  deadline?: string               // ISO date

  // Date-range based weight curves
  // Sorted ascending by maxDaysRemaining. Resolver picks first bracket where daysRemaining <= max.
  weightBrackets: WeightBracket[]

  // Recurrence
  recurrence: ObligationRecurrence
  recurrenceMonth?: number        // 0-11, for yearly/quarterly start

  // Active/enabled
  enabled: boolean
}

// Given days remaining to deadline, find the active bracket
export function getActiveBracket(
  brackets: WeightBracket[],
  daysRemaining: number
): WeightBracket | undefined {
  // Sorted ascending by maxDaysRemaining — first where daysRemaining <= max
  const sorted = [...brackets].sort((a, b) => a.maxDaysRemaining - b.maxDaysRemaining)
  return sorted.find((b) => daysRemaining <= b.maxDaysRemaining)
}

// Interpolate the time-of-day weight within a bracket
export function getObligationWeight(
  timeCurve: TimeWeight[],
  timeMinutes: number
): number {
  if (timeCurve.length === 0) return 0
  if (timeCurve.length === 1) return timeCurve[0].value
  if (timeMinutes <= timeCurve[0].time) return timeCurve[0].value
  if (timeMinutes >= timeCurve[timeCurve.length - 1].time) return timeCurve[timeCurve.length - 1].value

  for (let i = 0; i < timeCurve.length - 1; i++) {
    const a = timeCurve[i]
    const b = timeCurve[i + 1]
    if (timeMinutes >= a.time && timeMinutes <= b.time) {
      const t = (timeMinutes - a.time) / (b.time - a.time)
      return a.value + t * (b.value - a.value)
    }
  }
  return 0
}
