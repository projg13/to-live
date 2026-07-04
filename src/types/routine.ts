// A weight point relative to the slot's ideal start time (anchor dominance start)
export interface SlotWeightPoint {
  offsetMinutes: number   // minutes from slot's ideal start time
  value: number           // weight at this point (linearly interpolated between)
}

// Per-task behavior within a routine
export interface RoutineTaskConfig {
  taskId: string
  slotWeights?: Record<string, SlotWeightPoint[]>  // slotId → piecewise weight curve relative to slot start
  fallbackWeight?: number                            // weight for slots NOT in slotWeights map (default: 0)
  expiresAfterMinutes?: number                       // task dies after this many minutes from routine spawn
  idealTime?: number                                 // minutes from midnight — ideal time for this task
}

// Per-block scheduling within a routine — just maps a block to an anchor
export interface RoutineBlockConfig {
  blockId: string
  anchorId: string                 // which anchor this block runs at
}

// Interpolate slot weight at a given offset from slot start
export function getSlotWeight(points: SlotWeightPoint[], offsetMinutes: number): number {
  if (points.length === 0) return 0
  if (points.length === 1) return points[0].value
  if (offsetMinutes <= points[0].offsetMinutes) return points[0].value
  if (offsetMinutes >= points[points.length - 1].offsetMinutes) return points[points.length - 1].value

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (offsetMinutes >= a.offsetMinutes && offsetMinutes <= b.offsetMinutes) {
      const t = (offsetMinutes - a.offsetMinutes) / (b.offsetMinutes - a.offsetMinutes)
      return a.value + t * (b.value - a.value)
    }
  }
  return 0
}

export interface Routine {
  id: string
  name: string
  blockConfigs: RoutineBlockConfig[]   // block → anchor mapping

  // Ideal spawn time (minutes from midnight)
  idealSpawnTime: number

  // Per-task overrides
  taskConfigs?: RoutineTaskConfig[]

  // Active/enabled
  enabled: boolean
}
