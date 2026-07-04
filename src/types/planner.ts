// A Day Plan: named configuration of anchors + routines for a type of day
export interface DayPlan {
  id: string
  name: string                     // e.g., "Bangalore Work Day", "Hometown Day"
  anchorIds: string[]              // which anchors define this day's slots
  routineIds: string[]             // which routines are active on this day plan
}

// Week Planner: assigns day plans to weekdays
export interface WeekPlan {
  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  days: Record<number, string>     // weekday → dayPlanId
}

// Reusable event template — stores the config, not the dates
export interface EventTemplate {
  id: string
  name: string                     // e.g., "Weekend Getaway", "Conference Trip"
  suspendRegular: boolean
  weightOffset?: number
  taskIds: string[]
  dayPlanOverride?: string         // single plan for all days (if set)
}

// Calendar event: date-specific override
export interface CalendarEvent {
  id: string
  name: string                     // e.g., "Wedding in Chennai", "Dinner with friends"
  date: string                     // ISO date
  endDate?: string                 // ISO date (multi-day events)
  taskIds: string[]                // specific tasks for this event
  suspendRegular: boolean          // if true, ALL tasks (routine + obligations) get weight-gated
  weightOffset?: number            // subtract from all task weights; only weight > 0 survives
  dayPlanOverride?: string         // single plan for ALL days of the event
  dayPlanOverrides?: Record<string, string>  // date → dayPlanId (piecewise per-day override)
  templateId?: string              // which template this was created from (for reference)
}
