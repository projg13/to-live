// A resolved task placement on the timeline
export interface ScheduledItem {
  taskId: string
  instanceKey: string            // unique key: source:sourceId:anchorId:taskId
  title: string
  startMinutes: number       // minutes from midnight (actual slotted time)
  endMinutes: number         // startMinutes + duration
  isBackground: boolean      // passive/ghost task
  source: 'routine' | 'obligation' | 'recovery' | 'adhoc' | 'event'
  weight: number             // resolved weight at placement time
  day: number                // 0 = today, 1 = tomorrow, etc.
  sourceId?: string          // e.g. ID of the routine, obligation, recovery, or event
  sourceName?: string        // e.g. Name of the routine, obligation, recovery, or event
  resetAnchorId?: string     // if set, done-key is scoped to this anchor (resets per anchor cycle)
  idealTime?: number         // the ideal start time (from anchor or task config)
  idealEndTime?: number      // hard end boundary (from task config or adhoc task)
  expiryTime?: number        // idealTime + expiresAfterMinutes (when the task drops)
  shrunkFromMinutes?: number // Patch 0005: set when task was compressed from its ideal duration
}

export type ScheduleDiagnosticKind =
  | 'INTRUDER_SHRUNK'        // A lower-weight task was compressed so a higher-weight task could start on time
  | 'EQUAL_PRIORITY_SHARED'  // Equal-weight tasks compressed proportionally to their slack to share a tight window
  | 'WEIGHT_TIE_AMBIGUITY'   // Equal-weight tasks competed for a window too tight for both even at minDuration (user should adjust weight)
  | 'STARVED_BY_HIGHER'      // A task expired or dropped because higher-weight tasks occupied its entire active slab

export interface ScheduleDiagnostic {
  kind: ScheduleDiagnosticKind
  taskIds: string[]
  instanceKeys: string[]
  windowStart: number
  windowEnd: number
  message: string
  suggestion: string
}

// An anchor confirmation (user-reported actual transition)
export interface AnchorConfirmation {
  anchorId: string
  actualTime: number         // minutes from midnight (actual, not ideal)
  day: number                // which day (0 = today)
}

// An ad-hoc task added on the fly
export interface AdhocTask {
  id: string
  title: string
  durationMinutes: number
  startTime: number          // minutes from midnight (user specified)
  fixedEndTime?: number      // minutes from midnight (optional hard end boundary)
  day: number                // which day
  weight: number
}

// The full resolved schedule for the week
export interface WeekSchedule {
  days: DaySchedule[]        // 7 days
  generated: string          // ISO timestamp of when this was computed
}

export interface ResolvedAnchor {
  anchorId: string
  anchorName: string
  idealTime: number          // from template
  actualTime: number         // after overflow/confirmation adjustments
}

export interface DaySchedule {
  date: string               // ISO date
  dayPlanId: string          // which day plan applies
  dayPlanName: string
  confirmedAnchors: AnchorConfirmation[]
  resolvedAnchors: ResolvedAnchor[]  // actual anchor positions after overflow
  items: ScheduledItem[]     // resolved task placements, sorted by startMinutes
  overflowItems: ScheduledItem[]  // tasks that couldn't fit before cutoff
  adhocTasks: AdhocTask[]    // user-added on-the-fly tasks
  diagnostics?: ScheduleDiagnostic[] // Patch 0005: explicit callouts for compression, ties, and starvation
}
