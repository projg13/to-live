export type ContinuityRule = 'resumable' | 'breakable'

// A link from this task to another task
export interface TaskLink {
  linkedTaskId: string        // the task being linked to
  continuity?: ContinuityRule // resumable = all-or-nothing, breakable = parent can exist without child
}

// Piecewise weight: weight varies over time of day (24h circular)
export interface WeightPoint {
  time: number                // minutes from midnight (0–1439)
  value: number
}

export interface TaskKnobs {
  isMother: boolean        // enables links[]
  hasWeightCurve: boolean  // enables weightCurve[]
  hasExpiry: boolean       // enables expiresAt
}

// Task: a quantum of time consumption
// Duration (time) is its measure, always required
export interface Task {
  id: string
  title: string
  weight: number
  durationMinutes: number         // the measure — always required

  // Knobbed: isMother (links to other tasks)
  links?: TaskLink[]

  // Knobbed: hasWeightCurve (24h circular weight over time of day)
  weightCurve?: WeightPoint[]

  // Knobbed: hasExpiry
  expiresAt?: string              // ISO datetime — when this task gets killed

  // Runtime tracking
  spawnedIds?: string[]           // which links have fired

  // Relationships
  parentId?: string               // who triggered this task
  blockId?: string                // which block this task belongs to

  // UI control
  knobs: TaskKnobs
}
