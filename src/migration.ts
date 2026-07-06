/**
 * Seed migration stub.
 * All default data has been removed for a clean slate.
 * Add new seed data here if needed.
 */
export function runSeedMigration() {
  // Migrate old continuity values: continuous→resumable, discontinuable→breakable
  migrateContinuityRule()
  // Remove deprecated task fields (scheduled, stickiness) and migrate weight curves
  migrateTaskFields()
  // Clean up scheduler store (remove insert-generated adhoc tasks)
  migrateSchedulerStore()
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
        // Remove deprecated linkType field
        if ('linkType' in link) {
          delete link.linkType
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

function migrateTaskFields() {
  try {
    const raw = localStorage.getItem('task-store')
    if (!raw) return
    const data = JSON.parse(raw)
    const tasks = data?.state?.tasks
    if (!Array.isArray(tasks)) return

    let changed = false
    for (const task of tasks) {
      // Remove deprecated knob fields
      if (task.knobs) {
        if ('scheduled' in task.knobs) {
          delete task.knobs.scheduled
          changed = true
        }
        if ('hasStickiness' in task.knobs) {
          delete task.knobs.hasStickiness
          changed = true
        }
      }
      // Remove deprecated task fields
      for (const field of ['start', 'end', 'stickiness']) {
        if (field in task) {
          delete task[field]
          changed = true
        }
      }
      // Migrate WeightPoint: datetime (string) → time (number, minutes from midnight)
      if (Array.isArray(task.weightCurve)) {
        for (const wp of task.weightCurve) {
          if ('datetime' in wp && !('time' in wp)) {
            // Parse ISO datetime to minutes from midnight
            try {
              const d = new Date(wp.datetime)
              wp.time = d.getHours() * 60 + d.getMinutes()
            } catch {
              wp.time = 540 // fallback to 9:00 AM
            }
            delete wp.datetime
            changed = true
          }
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

function migrateSchedulerStore() {
  try {
    const raw = localStorage.getItem('to-live-scheduler')
    if (!raw) return
    const data = JSON.parse(raw)
    const state = data?.state
    if (!state) return

    let changed = false

    // Remove insert-generated adhoc tasks (leftover from removed insertTask)
    if (Array.isArray(state.adhocTasks)) {
      const before = state.adhocTasks.length
      state.adhocTasks = state.adhocTasks.filter((t: any) => !t.id?.startsWith('insert-'))
      if (state.adhocTasks.length !== before) changed = true
    }

    if (changed) {
      localStorage.setItem('to-live-scheduler', JSON.stringify(data))
    }
  } catch {
    // ignore parse errors
  }
}
