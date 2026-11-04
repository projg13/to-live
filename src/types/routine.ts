// A weight point relative to the slot's ideal start time (anchor dominance start)
export interface SlotWeightPoint {
  offsetMinutes: number   // minutes from slot's ideal start time
  value: number           // weight at this point (linearly interpolated between)
}

// Per-task customized behavior within a routine (overrides Task template defaults)
export interface RoutineTaskConfig {
  taskId: string
  titleOverride?: string                             // custom display name for this task inside this routine
  durationMinutes?: number                           // per-routine duration override over Task template default
  minDurationMinutes?: number                        // per-routine shrinkage floor override over Task template default
  relativeWeight?: number                            // hierarchical / relative weight offset on top of routine baseWeight (or slot curve)
  slotWeights?: Record<string, SlotWeightPoint[]>    // slotId → piecewise weight curve relative to slot start
  fallbackWeight?: number                            // weight for slots NOT in slotWeights map (default: 0)
  expiresAfterMinutes?: number                       // task dies after this many minutes from its ideal/anchor start
  idealTime?: number                                 // minutes from midnight — ideal start time for this task
  idealEndTime?: number                              // minutes from midnight — hard ideal end boundary for this task
  selectedAlterEgoId?: string                        // selected Alter-Ego preset ID for this routine
}

// Per-block scheduling within a routine — maps a block to an anchor
export interface RoutineBlockConfig {
  blockId: string
  anchorId: string                 // which anchor this block runs at
}

/**
 * Patch 0005: Interpolate slot weight at a given offset from slot start.
 * - Single point `points.length === 1`: resilient flat slab from `points[0].offsetMinutes` onward.
 * - Multi-point `points.length >= 2`: strictly evaluates within `[first.offsetMinutes, last.offsetMinutes]`.
 *   Outside `[first, last]`, returns `0`!
 */
export function getSlotWeight(points: SlotWeightPoint[], offsetMinutes: number): number {
  if (points.length === 0) return 0
  if (points.length === 1) {
    return offsetMinutes >= points[0].offsetMinutes ? points[0].value : 0
  }

  const sorted = [...points].sort((a, b) => a.offsetMinutes - b.offsetMinutes)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  if (offsetMinutes < first.offsetMinutes || offsetMinutes > last.offsetMinutes) {
    return 0
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (offsetMinutes >= a.offsetMinutes && offsetMinutes <= b.offsetMinutes) {
      const span = b.offsetMinutes - a.offsetMinutes
      if (span <= 0) return a.value
      const t = (offsetMinutes - a.offsetMinutes) / span
      return a.value + t * (b.value - a.value)
    }
  }
  return 0
}

export interface Routine {
  id: string
  name: string
  baseWeight?: number                  // Patch 0009: Routine/slot-level baseline weight (default: 100)
  blockConfigs: RoutineBlockConfig[]   // block → anchor mapping

  // Per-task overrides over Task template defaults
  taskConfigs?: RoutineTaskConfig[]

  // Patch 0004: Optional RoutineSequencer plugin ID attached at the Routine level
  sequencerId?: string

  // Active/enabled
  enabled: boolean
}
