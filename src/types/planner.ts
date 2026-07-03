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

// Calendar event: date-specific override
export interface CalendarEvent {
  id: string
  name: string                     // e.g., "Wedding in Chennai", "Dinner with friends"
  date: string                     // ISO date
  endDate?: string                 // ISO date (multi-day events)
  taskIds: string[]                // specific tasks for this event
  suspendRegular: boolean          // if true, regular tasks are suspended (obligations exempt)
  dayPlanOverride?: string         // optionally override the day plan for this date
}
