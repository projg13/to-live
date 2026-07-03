// Time-of-day weight point (reused pattern)
export interface TimeWeight {
  time: number    // minutes from midnight
  value: number
}

export type TriggerType = 'manual' | 'auto'

// Auto-trigger condition: task not done for N consecutive days
export interface AutoTriggerCondition {
  taskId: string              // which task's non-completion triggers this
  consecutiveMisses: number   // how many consecutive days missed to trigger
}

export interface RecoveryPlan {
  id: string
  name: string                        // e.g., "Big Laundry", "Grocery Run", "Sleep Recovery"

  // What it contains
  taskIds: string[]                   // individual tasks
  blockIds: string[]                  // or entire blocks

  // Trigger
  triggerType: TriggerType
  autoCondition?: AutoTriggerCondition  // only for auto

  // Base weight curve (absolute time-of-day)
  baseTimeCurve: TimeWeight[]

  // Growth: weight multiplier that accelerates the longer recovery is pending
  // Effective weight = baseWeight × (1 + growthRate × daysPending)
  growthRate: number                  // multiplier per day pending (e.g., 0.5 = +50% per day)
  saturationLimit: number             // max weight cap — stops growing beyond this

  // State
  triggered: boolean                  // is this recovery currently active
  triggeredAt?: string                // ISO date when it was triggered
}

// Compute effective weight at a given time, considering growth
export function getRecoveryWeight(
  plan: RecoveryPlan,
  timeMinutes: number,
  today: string
): number {
  if (!plan.triggered) return 0

  // Interpolate base time curve
  const base = interpolateTimeCurve(plan.baseTimeCurve, timeMinutes)
  if (base === 0) return 0

  // Compute days pending
  const daysPending = plan.triggeredAt
    ? Math.max(0, Math.floor((new Date(today).getTime() - new Date(plan.triggeredAt).getTime()) / 86400000))
    : 0

  // Apply growth with saturation
  const multiplier = 1 + plan.growthRate * daysPending
  const effective = base * multiplier

  return Math.min(effective, plan.saturationLimit)
}

function interpolateTimeCurve(curve: TimeWeight[], timeMinutes: number): number {
  if (curve.length === 0) return 0
  if (curve.length === 1) return curve[0].value
  if (timeMinutes <= curve[0].time) return curve[0].value
  if (timeMinutes >= curve[curve.length - 1].time) return curve[curve.length - 1].value

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1]
    if (timeMinutes >= a.time && timeMinutes <= b.time) {
      const t = (timeMinutes - a.time) / (b.time - a.time)
      return a.value + t * (b.value - a.value)
    }
  }
  return 0
}
