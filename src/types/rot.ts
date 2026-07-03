export interface RotEntry {
  id: string
  date: string              // ISO date
  startTime?: number        // minutes from midnight (optional, for partial rot)
  endTime?: number          // minutes from midnight
  suspendedTaskIds: string[] // tasks that would have been done but weren't
  note?: string             // optional reason
}
