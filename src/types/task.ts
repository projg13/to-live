export type ContinuityRule = 'resumable' | 'breakable'

// A link from this task to another task
export interface TaskLink {
  linkedTaskId: string        // the task being linked to
  continuity?: ContinuityRule // resumable = all-or-nothing, breakable = parent can exist without child
}

// Piecewise weight or duration point: varies over time of day (24h circular or offset)
export interface WeightPoint {
  time: number                // minutes from midnight (0–1439)
  value: number
}

// Task Alter-Ego preset (Mode / Variant)
export interface TaskAlterEgo {
  id: string
  name: string                  // e.g. "Express", "Full", "Extended"
  titleOverride?: string        // e.g. "Quick Dinner" (defaults to base title if empty)
  durationMinutes: number       // duration override (e.g. 15, 30, 60)
  triggerDelayMinutes?: number  // auto-trigger if start delay >= X mins from ideal
}

export interface TaskKnobs {
  isMother: boolean        // enables links[]
  hasWeightCurve: boolean  // enables weightCurve[]
  hasExpiry: boolean       // enables expiresAt
  hasFixedEndTime?: boolean // enables fixedEndTime
  hasAlterEgos?: boolean   // enables alterEgos[]
  hasDurationCurve?: boolean // enables continuous durationCurve[] + minDurationMinutes
}

// Task: a quantum of time consumption
// Duration (time) is its measure, always required
export interface Task {
  id: string
  title: string
  weight: number
  durationMinutes: number         // the measure — always required
  minDurationMinutes?: number     // floor for continuous shrinkage / head-clipping on fixedEndTime

  // Knobbed: isMother (links to other tasks)
  links?: TaskLink[]

  // Knobbed: hasWeightCurve (24h circular weight over time of day)
  weightCurve?: WeightPoint[]

  // Knobbed: hasDurationCurve (continuous duration compression over time of day)
  durationCurve?: WeightPoint[]

  // Knobbed: hasExpiry
  expiresAt?: string              // ISO datetime — when this task gets killed

  // Knobbed: hasFixedEndTime
  fixedEndTime?: number           // minutes from midnight (0–1439 or >1440 for post-midnight wall)

  // Knobbed: hasAlterEgos
  alterEgos?: TaskAlterEgo[]

  // Runtime tracking
  spawnedIds?: string[]           // which links have fired

  // Relationships
  parentId?: string               // who triggered this task
  blockId?: string                // which block this task belongs to

  // UI control
  knobs: TaskKnobs
}
