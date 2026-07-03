export interface Anchor {
  id: string
  name: string
  spikeTime: number  // minutes from midnight — when this anchor activates
  weight: number     // dominance value at spike
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
