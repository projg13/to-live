export type LinkType = 'active' | 'passive'
export type ContinuityRule = 'continuous' | 'discontinuable' | 'resumable'

// A link from this task to another task
export interface TaskLink {
  linkedTaskId: string        // the task being linked to
  linkType: LinkType          // active = foreground, passive = background
  continuity?: ContinuityRule // only meaningful for passive links
}

// Piecewise weight: weight varies over absolute datetime
export interface WeightPoint {
  datetime: string            // ISO datetime
  value: number
}

export interface TaskKnobs {
  scheduled: boolean       // enables start/end
  isMother: boolean        // enables links[]
  hasWeightCurve: boolean  // enables weightCurve[]
  hasExpiry: boolean       // enables expiresAt
  hasStickiness: boolean   // enables stickiness
}

// Task: a quantum of time consumption
// Duration (time) is its measure, always required
export interface Task {
  id: string
  title: string
  weight: number
  durationMinutes: number         // the measure — always required

  // Knobbed: scheduled
  start?: string
  end?: string

  // Knobbed: isMother (links to other tasks)
  links?: TaskLink[]

  // Knobbed: hasWeightCurve (piecewise weight over absolute datetime)
  weightCurve?: WeightPoint[]

  // Knobbed: hasExpiry
  expiresAt?: string              // ISO datetime — when this task gets killed

  // Knobbed: hasStickiness
  stickiness?: number             // how resistant this task is to being displaced

  // Runtime tracking
  spawnedIds?: string[]           // which links have fired

  // Relationships
  parentId?: string               // who triggered this task
  blockId?: string                // which block this task belongs to

  // UI control
  knobs: TaskKnobs
}
