export type ObligationRecurrence =
  | 'one-time'
  | 'yearly'
  | 'quarterly'
  | 'custom'
  | 'monthly'

export type MonthlyRecurrenceType = 'specific-day' | 'relative'
export type WeekOfMonthSelection = 'first' | 'second' | 'third' | 'fourth' | 'last'
export type DayOfWeekSelection =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'weekday'
  | 'weekend-day'

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
  blockIds?: string[]               // blocks as additional task source (same as recovery)

  // Deadline (optional — if absent, no escalation, uses the first bracket always)
  deadline?: string               // ISO date

  // Date-range based weight curves
  // Sorted ascending by maxDaysRemaining. Resolver picks first bracket where daysRemaining <= max.
  weightBrackets: WeightBracket[]

  // Recurrence
  recurrence: ObligationRecurrence
  recurrenceMonth?: number        // 0-11, for yearly/quarterly start
  recurrenceDayOfMonth?: number   // 1-31, for monthly start
  monthlyType?: MonthlyRecurrenceType
  recurrenceWeekOfMonth?: WeekOfMonthSelection
  recurrenceDayOfWeek?: DayOfWeekSelection

  // Active/enabled
  enabled: boolean
}

// Dynamically resolve target deadline for recurring obligations for any given date
export function resolveObligationDeadline(ob: Obligation, dateStr: string): string | undefined {
  if (ob.recurrence === 'one-time') {
    return ob.deadline
  }

  if (ob.recurrence === 'monthly') {
    // Try current month first, then next month if deadline already passed
    const result = resolveMonthlyDeadline(ob, dateStr)
    if (result && result < dateStr) {
      // Deadline passed — resolve for next month
      const d = new Date(dateStr)
      d.setMonth(d.getMonth() + 1, 1)
      const nextMonthStr = d.toISOString().split('T')[0]
      return resolveMonthlyDeadline(ob, nextMonthStr)
    }
    return result
  }

  // Fallback to absolute deadline if custom/yearly/quarterly
  return ob.deadline
}

function resolveMonthlyDeadline(ob: Obligation, dateStr: string): string | undefined {
  const currentDate = new Date(dateStr)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  let targetDay = 1

  if (!ob.monthlyType || ob.monthlyType === 'specific-day') {
    targetDay = ob.recurrenceDayOfMonth ?? 1
  } else {
    const week = ob.recurrenceWeekOfMonth ?? 'first'
    const daySel = ob.recurrenceDayOfWeek ?? 'monday'

    const totalDays = new Date(year, month + 1, 0).getDate()
    const matches: number[] = []

    for (let d = 1; d <= totalDays; d++) {
      const testDate = new Date(year, month, d)
      const dayOfWeek = testDate.getDay()

      let matchesDay = false
      if (daySel === 'weekday') {
        matchesDay = dayOfWeek >= 1 && dayOfWeek <= 5
      } else if (daySel === 'weekend-day') {
        matchesDay = dayOfWeek === 0 || dayOfWeek === 6
      } else {
        const dayMap: Record<string, number> = {
          sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
          thursday: 4, friday: 5, saturday: 6,
        }
        matchesDay = dayOfWeek === dayMap[daySel]
      }

      if (matchesDay) matches.push(d)
    }

    if (matches.length > 0) {
      if (week === 'first') targetDay = matches[0]
      else if (week === 'second') targetDay = matches[1] ?? matches[matches.length - 1]
      else if (week === 'third') targetDay = matches[2] ?? matches[matches.length - 1]
      else if (week === 'fourth') targetDay = matches[3] ?? matches[matches.length - 1]
      else if (week === 'last') targetDay = matches[matches.length - 1]
    }
  }

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(targetDay)}`
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

// Interpolate the time-of-day weight within a bracket (circular 24h wrapping)
export function getObligationWeight(
  timeCurve: TimeWeight[],
  timeMinutes: number
): number {
  if (timeCurve.length === 0) return 0
  if (timeCurve.length === 1) return timeCurve[0].value

  const DAY = 1440
  const t = ((timeMinutes % DAY) + DAY) % DAY

  const first = timeCurve[0]
  const last = timeCurve[timeCurve.length - 1]

  for (let i = 0; i < timeCurve.length - 1; i++) {
    const a = timeCurve[i]
    const b = timeCurve[i + 1]
    if (t >= a.time && t <= b.time) {
      const frac = (t - a.time) / (b.time - a.time)
      return a.value + frac * (b.value - a.value)
    }
  }

  // Wrap around midnight
  const wrapDistance = (DAY - last.time) + first.time
  if (wrapDistance <= 0) return last.value
  const distFromLast = t >= last.time ? (t - last.time) : (DAY - last.time + t)
  const frac = distFromLast / wrapDistance
  return last.value + frac * (first.value - last.value)
}
