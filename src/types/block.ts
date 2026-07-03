export type OverflowBehavior = 'drop' | 'push'
// drop: remaining tasks get dropped
// push: block pushes next slot's start forward

export interface BlockEntry {
  taskId: string
  order: number                    // sequence within block (0-indexed)
  isBackground: boolean            // true = runs concurrently with following active entries (passive link)
  mandatory: boolean               // if true, survives drops
  stickinessBoost?: number         // added to task's stickiness while in this block
}

export interface Block {
  id: string
  name: string                     // e.g., "Morning Routine"
  anchorId: string                 // which anchor/slot this block is attached to
  entries: BlockEntry[]            // ordered list of task memberships

  // Time budget
  expectedDurationMinutes: number

  // Overflow: what happens when mandatory tasks can't fit
  overflowBehavior: OverflowBehavior

  // Block-level stickiness — overrides task stickiness for members
  blockStickiness?: number

  // Block-level expiry — minutes after block start when remaining tasks die
  expiresAfterMinutes?: number
}

// Compute effective stickiness for a task within a block
export function getEffectiveStickiness(
  taskStickiness: number | undefined,
  blockStickiness: number | undefined,
  entryBoost: number | undefined
): number {
  return (blockStickiness ?? taskStickiness ?? 0) + (entryBoost ?? 0)
}

// Resolve which entries fit vs get dropped
export function resolveBlock(
  block: Block,
  availableMinutes: number,
  taskDurations: Map<string, number>
): { kept: BlockEntry[]; dropped: BlockEntry[] } {
  const sorted = [...block.entries].sort((a, b) => a.order - b.order)
  const kept: BlockEntry[] = []
  const dropped: BlockEntry[] = []
  let usedMinutes = 0

  for (const entry of sorted) {
    const dur = taskDurations.get(entry.taskId) ?? 0

    if (entry.mandatory) {
      // Mandatory always kept (overflow behavior handles if it exceeds slot)
      kept.push(entry)
      usedMinutes += dur
    } else if (usedMinutes + dur <= availableMinutes) {
      kept.push(entry)
      usedMinutes += dur
    } else {
      dropped.push(entry)
    }
  }

  return { kept, dropped }
}
