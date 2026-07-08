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
  // Move obligation done entries from scheduler → obligation store
  migrateObligationDone()
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

// Move obligation:* done entries from scheduler store to obligation store
function migrateObligationDone() {
  try {
    const schedRaw = localStorage.getItem('to-live-scheduler')
    if (!schedRaw) return
    const schedData = JSON.parse(schedRaw)
    const schedState = schedData?.state
    if (!schedState || !Array.isArray(schedState.doneTasks)) return

    const obKeys = schedState.doneTasks.filter((k: string) => k.startsWith('obligation:'))
    if (obKeys.length === 0) return

    // Remove from scheduler
    schedState.doneTasks = schedState.doneTasks.filter((k: string) => !k.startsWith('obligation:'))
    localStorage.setItem('to-live-scheduler', JSON.stringify(schedData))

    // Add to obligation store
    const obRaw = localStorage.getItem('to-live-obligations')
    if (!obRaw) return
    const obData = JSON.parse(obRaw)
    const obState = obData?.state
    if (!obState) return

    if (!Array.isArray(obState.doneTasks)) {
      obState.doneTasks = []
    }
    const existing = new Set(obState.doneTasks)
    for (const key of obKeys) {
      if (!existing.has(key)) {
        obState.doneTasks.push(key)
      }
    }
    localStorage.setItem('to-live-obligations', JSON.stringify(obData))
  } catch {
    // ignore parse errors
  }
}
