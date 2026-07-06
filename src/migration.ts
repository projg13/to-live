/**
 * Seed migration stub.
 * All default data has been removed for a clean slate.
 * Add new seed data here if needed.
 */
export function runSeedMigration() {
  // Migrate old continuity values: continuous→resumable, discontinuable→breakable
  migrateContinuityRule()
}

function migrateContinuityRule() {
  try {
    const raw = localStorage.getItem('task-store')
    if (!raw) return
    const data = JSON.parse(raw)
    const tasks = data?.state?.tasks
    if (!Array.isArray(tasks)) return

    let changed = false
    for (const task of tasks) {
      if (!task.links) continue
      for (const link of task.links) {
        if (link.continuity === 'continuous') {
          link.continuity = 'resumable'
          changed = true
        } else if (link.continuity === 'discontinuable') {
          link.continuity = 'breakable'
          changed = true
        }
      }
    }

    if (changed) {
      localStorage.setItem('task-store', JSON.stringify(data))
    }
  } catch {
    // ignore parse errors
  }
}
