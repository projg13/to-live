export interface Anchor {
  id: string
  name: string           // anchor name (e.g., "Wake", "Work Start")
  slotName?: string      // name for the slot that starts here (e.g., "Morning Routine", "Work Hours")
  spikeTime: number      // minutes from midnight — when this anchor activates
  weight: number         // dominance value at spike
}

// A template: named set of anchors for a day type
export interface AnchorTemplate {
  id: string
  name: string           // e.g., "Bangalore Workday", "Weekend", "Travel Day"
  anchorIds: string[]    // which anchors belong to this template
}

// Helper: convert hours + minutes to minutes-from-midnight
export function toMinutes(h: number, m: number = 0): number {
  return h * 60 + m
}

// Helper: format minutes-from-midnight to readable time
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}
