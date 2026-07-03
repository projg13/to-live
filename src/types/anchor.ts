export interface WeightPoint {
  time: number // minutes from midnight (e.g., 6AM = 360, 9PM = 1260)
  value: number
}

export interface Anchor {
  id: string
  name: string
  weightCurve: WeightPoint[] // sorted by time, linearly interpolated between points
}

// Get interpolated weight at a given time (minutes from midnight)
// Wraps around midnight: last point connects back to first point over the day boundary
export function getWeight(anchor: Anchor, timeMinutes: number): number {
  const points = anchor.weightCurve
  if (points.length === 0) return 0
  if (points.length === 1) return points[0].value

  const first = points[0]
  const last = points[points.length - 1]

  // Before first point or after last point: interpolate across midnight wrap
  if (timeMinutes <= first.time || timeMinutes >= last.time) {
    const wrapDuration = (1440 - last.time) + first.time
    let elapsed: number
    if (timeMinutes >= last.time) {
      elapsed = timeMinutes - last.time
    } else {
      elapsed = (1440 - last.time) + timeMinutes
    }
    if (wrapDuration === 0) return last.value
    const t = elapsed / wrapDuration
    return last.value + t * (first.value - last.value)
  }

  // Between two defined points: linear interpolation
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (timeMinutes >= a.time && timeMinutes <= b.time) {
      const t = (timeMinutes - a.time) / (b.time - a.time)
      return a.value + t * (b.value - a.value)
    }
  }
  return 0
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
