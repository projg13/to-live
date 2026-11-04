export interface BlockEntry {
  taskId: string
  order: number                    // sequence within block (0-indexed)
  isBackground: boolean            // true = runs concurrently with following active entries

  // Patch 0003: Multi-parent DAG dependencies within the block
  requires?: string[]              // all listed taskIds in this block must be done or placed before this entry can start
  dropIfParentMissed?: boolean     // forward contingency: if any required parent wasn't done and failed to place, drop this task too (e.g. Football -> Bath)
  dropParentIfMissed?: boolean     // backward atomicity (resumable): if this task fails to place, roll back required parents too
}

// Block: a reusable, named group of tasks forming a Directed Acyclic Graph (DAG).
export interface Block {
  id: string
  name: string                     // e.g., "Morning Routine", "Laundry DAG", "Football Block"
  entries: BlockEntry[]            // ordered / DAG-linked list of task memberships
}

export interface DagValidationResult {
  valid: boolean
  cycle?: string[]
  sortedTaskIds: string[]
}

/**
 * Validates that a Block's `requires` edges form a valid Directed Acyclic Graph (no circular dependencies)
 * using Kahn's topological sort algorithm, and returns a cycle trace if invalid.
 */
export function validateBlockDag(entries: BlockEntry[]): DagValidationResult {
  const memberIds = new Set(entries.map((e) => e.taskId))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const e of entries) {
    inDegree.set(e.taskId, 0)
    adj.set(e.taskId, [])
  }

  for (const e of entries) {
    for (const reqId of e.requires ?? []) {
      if (!memberIds.has(reqId)) continue
      if (reqId === e.taskId) {
        return { valid: false, cycle: [e.taskId, e.taskId], sortedTaskIds: [] }
      }
      adj.get(reqId)!.push(e.taskId)
      inDegree.set(e.taskId, (inDegree.get(e.taskId) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [tid, deg] of inDegree) {
    if (deg === 0) queue.push(tid)
  }

  const sortedTaskIds: string[] = []
  while (queue.length > 0) {
    const curr = queue.shift()!
    sortedTaskIds.push(curr)
    for (const next of adj.get(curr) ?? []) {
      const nextDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, nextDeg)
      if (nextDeg === 0) queue.push(next)
    }
  }

  if (sortedTaskIds.length === entries.length) {
    return { valid: true, sortedTaskIds }
  }

  // Extract cycle path from remaining nodes with inDegree > 0
  const remaining = new Set(entries.map((e) => e.taskId).filter((id) => !sortedTaskIds.includes(id)))
  const visited = new Set<string>()
  const stack: string[] = []

  const dfsCycle = (node: string): string[] | null => {
    visited.add(node)
    stack.push(node)
    for (const next of adj.get(node) ?? []) {
      if (!remaining.has(next)) continue
      const idx = stack.indexOf(next)
      if (idx >= 0) {
        return [...stack.slice(idx), next]
      }
      if (!visited.has(next)) {
        const found = dfsCycle(next)
        if (found) return found
      }
    }
    stack.pop()
    return null
  }

  for (const startNode of remaining) {
    if (!visited.has(startNode)) {
      const cycle = dfsCycle(startNode)
      if (cycle) {
        return { valid: false, cycle, sortedTaskIds }
      }
    }
  }

  return { valid: false, cycle: [...remaining], sortedTaskIds }
}

/**
 * Throws a descriptive error if adding or updating entries in a Block creates a circular dependency.
 */
export function assertValidBlockDag(blockName: string, entries: BlockEntry[]): void {
  const res = validateBlockDag(entries)
  if (!res.valid) {
    const trace = res.cycle ? res.cycle.join(' -> ') : 'unknown'
    throw new Error(`Circular dependency detected in block "${blockName}": ${trace}`)
  }
}
