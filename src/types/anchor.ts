// Anchor: a named time marker (no time here — time is set per template)
export interface Anchor {
  id: string
  name: string       // e.g., "Wake", "Work Start", "Work End", "Sleep"
}

// Slot: a named period (independent entity, reusable)
export interface Slot {
  id: string
  name: string       // e.g., "Morning", "Work Hours", "Evening", "Night"
}

// Anchor Template: assigns times to anchors and maps slots between them
export interface AnchorTemplateEntry {
  anchorId: string
  spikeTime: number    // minutes from midnight — specific to this template
  slotId: string       // which slot starts at this anchor in this template
}

export interface AnchorTemplate {
  id: string
  name: string                     // e.g., "Workday", "Weekend"
  entries: AnchorTemplateEntry[]   // ordered anchor+time+slot assignments
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
