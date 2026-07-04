export interface BlockEntry {
  taskId: string
  order: number                    // sequence within block (0-indexed)
  isBackground: boolean            // true = runs concurrently with following active entries
  mandatory: boolean               // if true, survives drops
}

// Block: a reusable, named group of tasks in a specific order.
// No scheduling behavior — that's defined by the routine that uses this block.
export interface Block {
  id: string
  name: string                     // e.g., "Morning Routine", "Evening Wrapup"
  entries: BlockEntry[]            // ordered list of task memberships
}
