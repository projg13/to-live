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
  let alreadyMigratedV2 = false
  try { alreadyMigratedV2 = localStorage.getItem('to-live-migrated-v2') === '1' } catch {}
  if (!alreadyMigratedV2 || useTaskStore.getState().tasks.length <= 1) {
    loadDemoPresetIntoStores('user_migrated')
    try { localStorage.setItem('to-live-migrated-v2', '1') } catch {}
  }
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


import { useTaskStore } from './store/taskStore'
import { useAnchorStore } from './store/anchorStore'
import { useBlockStore } from './store/blockStore'
import { useRoutineStore } from './store/routineStore'
import { useObligationStore } from './store/obligationStore'
import { usePlannerStore } from './store/plannerStore'
import { useSchedulerStore } from './store/schedulerStore'

export type DemoPresetId =
  | 'user_migrated'
  | 'all_features'
  | 'p5_intruder'
  | 'p5_equal_share'
  | 'p5_weight_tie'
  | 'p5_rescue'
  | 'p4_cooking'
  | 'p3_laundry'
  | 'p2_football'

export function loadDemoPresetIntoStores(preset: DemoPresetId) {
  const USER_MIGRATED_DATA = {"tasks": [{"id": "057faf0d-17cf-4fc4-ae18-b69e7d3e92ef", "title": "Sleep", "weight": 1000, "durationMinutes": 480, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 360}, {"id": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "title": "Brush", "weight": 900, "durationMinutes": 10, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "title": "Drink Protien", "weight": 99, "durationMinutes": 10, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "24ce5d4b-e0a4-4b1b-b6c2-18eae8038cca", "title": "Gym", "weight": 100, "durationMinutes": 130, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 60}, {"id": "5af8b0f1-5dc2-4613-8054-ccfb8580a117", "title": "Relax", "weight": 100, "durationMinutes": 20, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "7f83502a-36aa-4408-bd8e-18a2c6718168", "title": "Bath", "weight": 100, "durationMinutes": 20, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "8194aea2-b2a3-43be-b565-d724b279fa5d", "title": "Sandhi", "weight": 100, "durationMinutes": 20, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "title": "Cook (Breakfast)", "weight": 100, "durationMinutes": 60, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 30}, {"id": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "title": "Breakfast", "weight": 100, "durationMinutes": 15, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "07adf79a-717c-4d0a-bf08-50ac30276dd4", "title": "Work", "weight": 100, "durationMinutes": 480, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 240}, {"id": "2de0add5-0e43-4bbc-bc50-4b52811242f4", "title": "Cook (Dinner)", "weight": 100, "durationMinutes": 60, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 30}, {"id": "7014498d-986e-4db4-8e13-f756b5665ab0", "title": "Dinner", "weight": 100, "durationMinutes": 15, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "67189468-73df-4881-8023-1e9d0a0bbfd3", "title": "Laundry - Wash", "weight": 100, "durationMinutes": 5, "links": [{"linkedTaskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "continuity": "resumable"}], "knobs": {"isMother": true, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "b1675a5e-4037-4194-96de-0012d06458b6", "title": "Laundry : Fold", "weight": 100, "durationMinutes": 15, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "title": "Laundry : Hang", "weight": 100, "durationMinutes": 10, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "parentId": "ef1b2474-9324-4910-87e9-b857364c9caf"}, {"id": "33380e16-c1da-469f-8775-162994b04d1a", "title": "Food Prep", "weight": 100, "durationMinutes": 45, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 30}, {"id": "ef1b2474-9324-4910-87e9-b857364c9caf", "title": "Laundry : Machine Run", "weight": 100, "durationMinutes": 45, "links": [{"linkedTaskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "continuity": "resumable"}], "knobs": {"isMother": true, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "parentId": "67189468-73df-4881-8023-1e9d0a0bbfd3"}, {"id": "fafb6bcc-0d30-457f-8a30-b866d5aec336", "title": "Collect Garbage", "weight": 100, "durationMinutes": 15, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "8c6b68fb-092a-4e6a-a315-6e11fb892ab7", "title": "Clean Kitchen", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "0337626f-fa28-4b2b-bfa8-a82317a3e2f6", "title": "Groceries", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "8d157780-60df-417e-8c02-86f87f29da6f", "title": "Dump Garbage", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "970c423e-c851-4aaf-aba5-10dd6bc04091", "title": "Oil Bath", "weight": 100, "durationMinutes": 60, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 40}, {"id": "11ea576e-e1be-411f-bcd5-f99552d92491", "title": "Study", "weight": 100, "durationMinutes": 120, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 45}, {"id": "a35fc331-2363-46c1-9483-ce214a60aa4b", "title": "Groom", "weight": 100, "durationMinutes": 20, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "4d7cfc26-17e6-49a2-82f3-18e33bedeb95", "title": "Football", "weight": 100, "durationMinutes": 180, "links": [{"linkedTaskId": "dd6b4afd-96f5-4ab4-81ed-9863b1426e74", "continuity": "resumable"}, {"linkedTaskId": "46003671-dc0b-4d1d-8956-bb39b600315c", "continuity": "resumable"}], "knobs": {"isMother": true, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 90}, {"id": "dd6b4afd-96f5-4ab4-81ed-9863b1426e74", "title": "Post Football Bath", "weight": 100, "durationMinutes": 20, "parentId": "4d7cfc26-17e6-49a2-82f3-18e33bedeb95", "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "46003671-dc0b-4d1d-8956-bb39b600315c", "title": "Post football food", "weight": 100, "durationMinutes": 20, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "bc98a4ca-1207-4651-91c5-b862ab8dbb7c", "title": "Post football Work", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "9641948d-33dc-4b5c-934a-a55e5713cc52", "title": "Half Work", "weight": 100, "durationMinutes": 240, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 120}, {"id": "6084770f-7d0a-4fdd-934d-cbd5467e0741", "title": "Rent", "weight": 100, "durationMinutes": 45, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "c9a054ef-1b8f-454f-8c8c-a016cb4346fb", "title": "Release Request", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "f3173ee4-39f4-4ee3-ae18-e6e1b050de13", "title": "TDS", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "c4893a12-a704-4b12-aa26-3e3e1c93e1f5", "title": "Run", "weight": 100, "durationMinutes": 90, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 45}, {"id": "7265f591-91c6-4709-9ff5-fc46cf121f1c", "title": "Easy Cook", "weight": 100, "durationMinutes": 30, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}}, {"id": "53fbaa4d-a544-4851-817d-b67497a2747d", "title": "Clear Fatigue", "weight": 100, "durationMinutes": 60, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": false, "hasAlterEgos": false}, "minDurationMinutes": 30}, {"id": "e05de6b2-09e4-4406-a7dd-9aaceee4371b", "title": "FOOTBALL EVENING", "weight": 100, "durationMinutes": 90, "knobs": {"isMother": false, "hasWeightCurve": false, "hasExpiry": false, "hasFixedEndTime": true, "hasAlterEgos": false}, "minDurationMinutes": 45, "fixedEndTime": 1230}], "anchors": [{"id": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa", "name": "Sleep"}, {"id": "e2422794-7396-4047-8c44-b94ee6db1936", "name": "Wake"}, {"id": "fce1ce9a-905f-4a6e-9586-c846577ef7d8", "name": "Day Start"}, {"id": "b54de5f5-c774-49c1-920e-a940176a565f", "name": "Day End"}, {"id": "97a87aa9-d92e-49c4-b97d-9719f874a687", "name": "Work Start"}, {"id": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6", "name": "Work End"}, {"id": "5ba4a40d-2e9f-4cc3-9e96-e5293f833cc3", "name": "Game Start"}, {"id": "83b5c2e5-190c-493b-b7ee-e66ea217a65a", "name": "Game End "}], "slots": [{"id": "8106b513-199a-407e-a518-c1d868ab48d1", "name": "Morning", "startAnchorId": "e2422794-7396-4047-8c44-b94ee6db1936", "endAnchorId": "97a87aa9-d92e-49c4-b97d-9719f874a687"}, {"id": "f68897d9-56ee-48f7-9d27-a5e972ce96d6", "name": "Evening", "startAnchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6", "endAnchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa"}, {"id": "0b9be45c-31ff-4767-a829-53f4a2a77c73", "name": "Sleep", "startAnchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa", "endAnchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"id": "cdfc9b1c-07f9-41a3-9b04-544a7aaf5694", "name": "Day ", "startAnchorId": "fce1ce9a-905f-4a6e-9586-c846577ef7d8", "endAnchorId": "b54de5f5-c774-49c1-920e-a940176a565f"}, {"id": "44e9db10-4d4e-4123-8ce9-f365fda6f634", "name": "Work", "startAnchorId": "97a87aa9-d92e-49c4-b97d-9719f874a687", "endAnchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6"}, {"id": "67b3b275-9f3f-45e5-997b-32d6daf1ba09", "name": "Game", "startAnchorId": "5ba4a40d-2e9f-4cc3-9e96-e5293f833cc3", "endAnchorId": "83b5c2e5-190c-493b-b7ee-e66ea217a65a"}, {"id": "b3a21363-615a-4bdf-81b7-6a5fae5bf011", "name": "Post Game ", "startAnchorId": "83b5c2e5-190c-493b-b7ee-e66ea217a65a", "endAnchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6"}], "templates": [{"id": "9b62e4b8-ac16-4442-ad1e-33a2a89cfad0", "name": "Holiday", "entries": [{"anchorId": "e2422794-7396-4047-8c44-b94ee6db1936", "spikeTime": 360, "slotId": "8106b513-199a-407e-a518-c1d868ab48d1"}, {"anchorId": "fce1ce9a-905f-4a6e-9586-c846577ef7d8", "spikeTime": 600, "slotId": "cdfc9b1c-07f9-41a3-9b04-544a7aaf5694"}, {"anchorId": "b54de5f5-c774-49c1-920e-a940176a565f", "spikeTime": 1080, "slotId": "f68897d9-56ee-48f7-9d27-a5e972ce96d6"}, {"anchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa", "spikeTime": 1260, "slotId": "0b9be45c-31ff-4767-a829-53f4a2a77c73"}]}, {"id": "eff0105e-07a2-4db1-91f0-73b5e17708c7", "name": "Workday", "entries": [{"anchorId": "e2422794-7396-4047-8c44-b94ee6db1936", "spikeTime": 360, "slotId": "8106b513-199a-407e-a518-c1d868ab48d1"}, {"anchorId": "97a87aa9-d92e-49c4-b97d-9719f874a687", "spikeTime": 600, "slotId": "44e9db10-4d4e-4123-8ce9-f365fda6f634"}, {"anchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6", "spikeTime": 1080, "slotId": "f68897d9-56ee-48f7-9d27-a5e972ce96d6"}, {"anchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa", "spikeTime": 1320, "slotId": "0b9be45c-31ff-4767-a829-53f4a2a77c73"}]}, {"id": "9c11f887-81c5-4884-b148-26969a9aae9b", "name": "Friday", "entries": [{"anchorId": "e2422794-7396-4047-8c44-b94ee6db1936", "spikeTime": 360, "slotId": "8106b513-199a-407e-a518-c1d868ab48d1"}, {"anchorId": "97a87aa9-d92e-49c4-b97d-9719f874a687", "spikeTime": 540, "slotId": "44e9db10-4d4e-4123-8ce9-f365fda6f634"}, {"anchorId": "5ba4a40d-2e9f-4cc3-9e96-e5293f833cc3", "spikeTime": 810, "slotId": "67b3b275-9f3f-45e5-997b-32d6daf1ba09"}, {"anchorId": "83b5c2e5-190c-493b-b7ee-e66ea217a65a", "spikeTime": 1020, "slotId": "b3a21363-615a-4bdf-81b7-6a5fae5bf011"}, {"anchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6", "spikeTime": 1080, "slotId": "f68897d9-56ee-48f7-9d27-a5e972ce96d6"}, {"anchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa", "spikeTime": 1320, "slotId": "0b9be45c-31ff-4767-a829-53f4a2a77c73"}]}, {"id": "a9ad6479-97ff-41e1-9a46-e2f444746c25", "name": "Home Vacation", "entries": [{"anchorId": "e2422794-7396-4047-8c44-b94ee6db1936", "spikeTime": 330, "slotId": "8106b513-199a-407e-a518-c1d868ab48d1"}, {"anchorId": "fce1ce9a-905f-4a6e-9586-c846577ef7d8", "spikeTime": 585, "slotId": "cdfc9b1c-07f9-41a3-9b04-544a7aaf5694"}, {"anchorId": "b54de5f5-c774-49c1-920e-a940176a565f", "spikeTime": 1050, "slotId": "f68897d9-56ee-48f7-9d27-a5e972ce96d6"}, {"anchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa", "spikeTime": 1380, "slotId": "0b9be45c-31ff-4767-a829-53f4a2a77c73"}]}], "blocks": [{"id": "6eabf596-e014-4564-bcb9-05e6c8f50764", "name": "Wake up", "entries": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "order": 0, "isBackground": false}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "order": 1, "isBackground": false}]}, {"id": "8338962e-0824-4dc1-91da-a1d84550b196", "name": "Gym", "entries": [{"taskId": "24ce5d4b-e0a4-4b1b-b6c2-18eae8038cca", "order": 0, "isBackground": false}, {"taskId": "5af8b0f1-5dc2-4613-8054-ccfb8580a117", "order": 1, "isBackground": false, "requires": ["24ce5d4b-e0a4-4b1b-b6c2-18eae8038cca"], "dropIfParentMissed": true}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "order": 2, "isBackground": false, "requires": ["24ce5d4b-e0a4-4b1b-b6c2-18eae8038cca"]}]}, {"id": "0978257e-e7fa-40db-884d-75b496026b4b", "name": "Cooking", "entries": [{"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "order": 0, "isBackground": false}, {"taskId": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "order": 1, "isBackground": false, "requires": ["850d5a1d-e530-4dea-a4a0-a81d80de59e9"], "dropIfParentMissed": true}]}, {"id": "14be71d5-7dde-45c9-ba65-fa0d5547fef3", "name": "Work", "entries": [{"taskId": "07adf79a-717c-4d0a-bf08-50ac30276dd4", "order": 0, "isBackground": false}]}, {"id": "ae865cbc-cf5a-4fde-8b80-d1b3718126fb", "name": "Sandhi", "entries": [{"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "order": 0, "isBackground": false}]}, {"id": "60a5d743-6d6f-4527-b76b-3b67fe478e4b", "name": "Healthy Evening", "entries": [{"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "order": 0, "isBackground": false}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "order": 1, "isBackground": false}, {"taskId": "2de0add5-0e43-4bbc-bc50-4b52811242f4", "order": 2, "isBackground": false}, {"taskId": "7014498d-986e-4db4-8e13-f756b5665ab0", "order": 3, "isBackground": false, "requires": ["2de0add5-0e43-4bbc-bc50-4b52811242f4"], "dropIfParentMissed": true}]}, {"id": "3124311b-5601-4cb7-a2d8-7f10164d6ff4", "name": "Evening Block", "entries": [{"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "order": 0, "isBackground": false}, {"taskId": "67189468-73df-4881-8023-1e9d0a0bbfd3", "order": 1, "isBackground": false}, {"taskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "order": 2, "isBackground": true, "requires": ["67189468-73df-4881-8023-1e9d0a0bbfd3"], "dropIfParentMissed": true, "dropParentIfMissed": true}, {"taskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "order": 3, "isBackground": false, "requires": ["ef1b2474-9324-4910-87e9-b857364c9caf", "b1675a5e-4037-4194-96de-0012d06458b6"], "dropIfParentMissed": true, "dropParentIfMissed": true}, {"taskId": "b1675a5e-4037-4194-96de-0012d06458b6", "order": 4, "isBackground": false, "requires": ["67189468-73df-4881-8023-1e9d0a0bbfd3"]}]}, {"id": "b84efd28-06f0-471d-9356-77d9f1ca1344", "name": "Sleep", "entries": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "order": 0, "isBackground": false}, {"taskId": "057faf0d-17cf-4fc4-ae18-b69e7d3e92ef", "order": 1, "isBackground": false, "requires": ["caa2dd5c-18c0-4360-ab30-25a253ca4b58"]}]}, {"id": "b7de4bdc-e69a-4c37-8196-8741d4e3cead", "name": "Laundry", "entries": [{"taskId": "67189468-73df-4881-8023-1e9d0a0bbfd3", "order": 0, "isBackground": false}, {"taskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "order": 1, "isBackground": true, "requires": ["67189468-73df-4881-8023-1e9d0a0bbfd3"], "dropIfParentMissed": true, "dropParentIfMissed": true}, {"taskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "order": 2, "isBackground": false, "requires": ["ef1b2474-9324-4910-87e9-b857364c9caf", "b1675a5e-4037-4194-96de-0012d06458b6"], "dropIfParentMissed": true, "dropParentIfMissed": true}, {"taskId": "b1675a5e-4037-4194-96de-0012d06458b6", "order": 3, "isBackground": false, "requires": ["67189468-73df-4881-8023-1e9d0a0bbfd3"]}]}, {"id": "3020d085-19cd-411d-b699-a541c15d8cd6", "name": "Dumpster", "entries": [{"taskId": "fafb6bcc-0d30-457f-8a30-b866d5aec336", "order": 0, "isBackground": false}, {"taskId": "8d157780-60df-417e-8c02-86f87f29da6f", "order": 1, "isBackground": false, "requires": ["fafb6bcc-0d30-457f-8a30-b866d5aec336"], "dropIfParentMissed": true}]}, {"id": "60c6a850-1fb9-49f3-aa4c-8f8d572ebec3", "name": "Restore Kitchen", "entries": [{"taskId": "0337626f-fa28-4b2b-bfa8-a82317a3e2f6", "order": 0, "isBackground": false}, {"taskId": "8c6b68fb-092a-4e6a-a315-6e11fb892ab7", "order": 1, "isBackground": false}]}, {"id": "b6f8c317-bf62-4bdd-8b12-9eee470c3f0e", "name": "Grooming", "entries": [{"taskId": "a35fc331-2363-46c1-9483-ce214a60aa4b", "order": 0, "isBackground": false}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "order": 1, "isBackground": false, "requires": ["a35fc331-2363-46c1-9483-ce214a60aa4b"]}]}, {"id": "2c4561ef-00b4-48ac-88bc-5195ce79b487", "name": "Oil Bath", "entries": [{"taskId": "970c423e-c851-4aaf-aba5-10dd6bc04091", "order": 0, "isBackground": false}]}, {"id": "a6e3702a-c4fe-43ac-be93-d9169fe86d6a", "name": "Bath", "entries": [{"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "order": 0, "isBackground": false}]}, {"id": "efbac7d1-212e-494b-958d-c8bfd7b68c80", "name": "Grocery Run", "entries": [{"taskId": "0337626f-fa28-4b2b-bfa8-a82317a3e2f6", "order": 0, "isBackground": false}]}, {"id": "ae57fcaf-7f26-44c6-be0e-aa3af7e90aa0", "name": "Study", "entries": [{"taskId": "11ea576e-e1be-411f-bcd5-f99552d92491", "order": 0, "isBackground": false}]}, {"id": "1b8f3ff6-b429-406b-a070-ee4ae5a8fd7c", "name": "Football", "entries": [{"taskId": "4d7cfc26-17e6-49a2-82f3-18e33bedeb95", "order": 0, "isBackground": false}, {"taskId": "dd6b4afd-96f5-4ab4-81ed-9863b1426e74", "order": 1, "isBackground": false, "requires": ["4d7cfc26-17e6-49a2-82f3-18e33bedeb95"], "dropIfParentMissed": true}, {"taskId": "46003671-dc0b-4d1d-8956-bb39b600315c", "order": 2, "isBackground": false, "requires": ["dd6b4afd-96f5-4ab4-81ed-9863b1426e74"], "dropIfParentMissed": true}]}, {"id": "25d9b1fa-bfef-428c-a220-28c97e2f9691", "name": "Half Work", "entries": [{"taskId": "9641948d-33dc-4b5c-934a-a55e5713cc52", "order": 0, "isBackground": false}]}, {"id": "7ac86fc7-2667-4521-a998-f733b7bc6680", "name": "Home Vacay Morning", "entries": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "order": 0, "isBackground": false}, {"taskId": "c4893a12-a704-4b12-aa26-3e3e1c93e1f5", "order": 1, "isBackground": false}, {"taskId": "5af8b0f1-5dc2-4613-8054-ccfb8580a117", "order": 2, "isBackground": false}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "order": 3, "isBackground": false}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "order": 4, "isBackground": false}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "order": 5, "isBackground": false}, {"taskId": "67189468-73df-4881-8023-1e9d0a0bbfd3", "order": 6, "isBackground": false}, {"taskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "order": 7, "isBackground": true, "requires": ["67189468-73df-4881-8023-1e9d0a0bbfd3"], "dropIfParentMissed": true, "dropParentIfMissed": true}, {"taskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "order": 8, "isBackground": false, "requires": ["ef1b2474-9324-4910-87e9-b857364c9caf"], "dropIfParentMissed": true, "dropParentIfMissed": true}]}, {"id": "2fef937e-386f-4cae-8006-bb4fe1467c5e", "name": "Home Vacay Evening", "entries": [{"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "order": 0, "isBackground": false}]}, {"id": "910db3a3-f823-4c5b-9ffd-6dcfb819ca8a", "name": "Home Vacay Sleep", "entries": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "order": 0, "isBackground": false}, {"taskId": "057faf0d-17cf-4fc4-ae18-b69e7d3e92ef", "order": 1, "isBackground": false, "requires": ["caa2dd5c-18c0-4360-ab30-25a253ca4b58"]}]}, {"id": "270936bc-f2eb-4718-b312-87d8a7afe736", "name": "Food Prep", "entries": [{"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "order": 0, "isBackground": false}]}, {"id": "ccc20308-e4c0-47e4-9623-35c8b55909f9", "name": "Football 90m", "entries": [{"taskId": "e05de6b2-09e4-4406-a7dd-9aaceee4371b", "order": 0, "isBackground": false}, {"taskId": "46003671-dc0b-4d1d-8956-bb39b600315c", "order": 1, "isBackground": false, "requires": ["dd6b4afd-96f5-4ab4-81ed-9863b1426e74"], "dropIfParentMissed": true}, {"taskId": "dd6b4afd-96f5-4ab4-81ed-9863b1426e74", "order": 2, "isBackground": false, "requires": ["e05de6b2-09e4-4406-a7dd-9aaceee4371b"], "dropIfParentMissed": true}]}], "routines": [{"id": "c2bf9ea4-600a-4ac7-91ee-133355f4fdd8", "name": "Morning (Mon/Wed)", "blockConfigs": [{"blockId": "6eabf596-e014-4564-bcb9-05e6c8f50764", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "8338962e-0824-4dc1-91da-a1d84550b196", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae865cbc-cf5a-4fde-8b80-d1b3718126fb", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "0978257e-e7fa-40db-884d-75b496026b4b", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "fallbackWeight": 300, "idealTime": 360}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "expiresAfterMinutes": 230, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 360}, {"taskId": "24ce5d4b-e0a4-4b1b-b6c2-18eae8038cca", "expiresAfterMinutes": 60, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 98}]}, "idealTime": 360}, {"taskId": "5af8b0f1-5dc2-4613-8054-ccfb8580a117", "expiresAfterMinutes": 180, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 97}]}, "idealTime": 360}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 96}]}, "fallbackWeight": 299, "idealTime": 360}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 95}]}, "idealTime": 360}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 360}, {"taskId": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 93}]}, "fallbackWeight": 0, "idealTime": 360}], "enabled": true}, {"id": "350796ec-69b8-4697-820e-92db8105a12f", "name": "Sleep", "blockConfigs": [{"blockId": "b84efd28-06f0-471d-9356-77d9f1ca1344", "anchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "slotWeights": {"0b9be45c-31ff-4767-a829-53f4a2a77c73": [{"offsetMinutes": 0, "value": 1001}]}, "idealTime": 1320}, {"taskId": "057faf0d-17cf-4fc4-ae18-b69e7d3e92ef", "slotWeights": {"0b9be45c-31ff-4767-a829-53f4a2a77c73": [{"offsetMinutes": 0, "value": 1000}]}, "idealTime": 1320}], "enabled": true}, {"id": "2e871891-29e7-41fb-890f-0161c73efac9", "name": "Work", "blockConfigs": [{"blockId": "14be71d5-7dde-45c9-ba65-fa0d5547fef3", "anchorId": "97a87aa9-d92e-49c4-b97d-9719f874a687"}], "taskConfigs": [{"taskId": "07adf79a-717c-4d0a-bf08-50ac30276dd4", "expiresAfterMinutes": 120, "slotWeights": {"44e9db10-4d4e-4123-8ce9-f365fda6f634": [{"offsetMinutes": 0, "value": 100}]}, "idealTime": 600}], "enabled": true}, {"id": "da6c9567-abe8-4b04-811c-d3ac94653480", "name": "Evening (Ideal)", "blockConfigs": [{"blockId": "60a5d743-6d6f-4527-b76b-3b67fe478e4b", "anchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6"}, {"blockId": "3124311b-5601-4cb7-a2d8-7f10164d6ff4", "anchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6"}], "taskConfigs": [{"taskId": "2de0add5-0e43-4bbc-bc50-4b52811242f4", "expiresAfterMinutes": 150, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 98}]}, "idealTime": 1080}, {"taskId": "7014498d-986e-4db4-8e13-f756b5665ab0", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 97}]}, "expiresAfterMinutes": 240, "idealTime": 1080}, {"taskId": "67189468-73df-4881-8023-1e9d0a0bbfd3", "expiresAfterMinutes": 240, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 96}]}, "idealTime": 1080}, {"taskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 95}]}, "expiresAfterMinutes": 240, "idealTime": 1080}, {"taskId": "b1675a5e-4037-4194-96de-0012d06458b6", "expiresAfterMinutes": 240, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 1080}, {"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "expiresAfterMinutes": 300, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 93}]}, "idealTime": 1080}, {"taskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "expiresAfterMinutes": 300, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 92}]}, "idealTime": 1080}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "expiresAfterMinutes": 300, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 100}]}, "idealTime": 1080}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 130, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 1080}], "enabled": true}, {"id": "ca2af41b-3850-4b5c-93da-74cf6389db61", "name": "Morning (Tue/Thu)", "blockConfigs": [{"blockId": "6eabf596-e014-4564-bcb9-05e6c8f50764", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae865cbc-cf5a-4fde-8b80-d1b3718126fb", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "0978257e-e7fa-40db-884d-75b496026b4b", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae57fcaf-7f26-44c6-be0e-aa3af7e90aa0", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "a6e3702a-c4fe-43ac-be93-d9169fe86d6a", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "fallbackWeight": 300, "idealTime": 360}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "expiresAfterMinutes": 230, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 360}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 95}]}, "idealTime": 360}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 360}, {"taskId": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "expiresAfterMinutes": 300, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 93}]}, "fallbackWeight": 0, "idealTime": 360}, {"taskId": "11ea576e-e1be-411f-bcd5-f99552d92491", "expiresAfterMinutes": 60, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 98}]}}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 97}]}, "fallbackWeight": 300}], "enabled": true}, {"id": "bd91db82-08f9-4428-a70f-b846691a6003", "name": "Morning (Fri)", "blockConfigs": [{"blockId": "6eabf596-e014-4564-bcb9-05e6c8f50764", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae865cbc-cf5a-4fde-8b80-d1b3718126fb", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "0978257e-e7fa-40db-884d-75b496026b4b", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "a6e3702a-c4fe-43ac-be93-d9169fe86d6a", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "fallbackWeight": 300, "idealTime": 360}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "expiresAfterMinutes": 230, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 360}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 95}]}, "idealTime": 360}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 360}, {"taskId": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "expiresAfterMinutes": 300, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 93}]}, "fallbackWeight": 0, "idealTime": 360}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 97}]}, "fallbackWeight": 300}], "enabled": true}, {"id": "dbe3879f-b2d1-4753-8d06-b61cad86882b", "name": "Game", "blockConfigs": [{"blockId": "1b8f3ff6-b429-406b-a070-ee4ae5a8fd7c", "anchorId": "5ba4a40d-2e9f-4cc3-9e96-e5293f833cc3"}], "taskConfigs": [{"taskId": "4d7cfc26-17e6-49a2-82f3-18e33bedeb95", "expiresAfterMinutes": 60, "slotWeights": {"67b3b275-9f3f-45e5-997b-32d6daf1ba09": [{"offsetMinutes": 0, "value": 100}]}}, {"taskId": "dd6b4afd-96f5-4ab4-81ed-9863b1426e74", "expiresAfterMinutes": 300, "slotWeights": {"67b3b275-9f3f-45e5-997b-32d6daf1ba09": [{"offsetMinutes": 0, "value": 99}]}}, {"taskId": "46003671-dc0b-4d1d-8956-bb39b600315c", "expiresAfterMinutes": 300, "slotWeights": {"67b3b275-9f3f-45e5-997b-32d6daf1ba09": [{"offsetMinutes": 0, "value": 98}]}}], "enabled": true}, {"id": "ab5963d9-9b28-49d2-a1d5-2da504f98036", "name": "Half Work", "blockConfigs": [{"blockId": "25d9b1fa-bfef-428c-a220-28c97e2f9691", "anchorId": "97a87aa9-d92e-49c4-b97d-9719f874a687"}], "taskConfigs": [{"taskId": "9641948d-33dc-4b5c-934a-a55e5713cc52", "expiresAfterMinutes": 120, "slotWeights": {"44e9db10-4d4e-4123-8ce9-f365fda6f634": [{"offsetMinutes": 0, "value": 100}]}}], "enabled": true}, {"id": "d5f162fd-642f-45f2-bd8f-520899ebd21b", "name": "Morning (Sat)", "blockConfigs": [{"blockId": "6eabf596-e014-4564-bcb9-05e6c8f50764", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae865cbc-cf5a-4fde-8b80-d1b3718126fb", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "0978257e-e7fa-40db-884d-75b496026b4b", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae57fcaf-7f26-44c6-be0e-aa3af7e90aa0", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "2c4561ef-00b4-48ac-88bc-5195ce79b487", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "efbac7d1-212e-494b-958d-c8bfd7b68c80", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "270936bc-f2eb-4718-b312-87d8a7afe736", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "fallbackWeight": 300, "idealTime": 360}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "expiresAfterMinutes": 230, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 360}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 95}]}, "idealTime": 360}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "expiresAfterMinutes": 300, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 93}]}, "idealTime": 360}, {"taskId": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "expiresAfterMinutes": 360, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 92}, {"offsetMinutes": 240, "value": 120}, {"offsetMinutes": 300, "value": 0}]}, "fallbackWeight": 0, "idealTime": 360}, {"taskId": "11ea576e-e1be-411f-bcd5-f99552d92491", "expiresAfterMinutes": 700, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 80}]}, "idealTime": 360}, {"taskId": "970c423e-c851-4aaf-aba5-10dd6bc04091", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 97}]}, "expiresAfterMinutes": 480, "idealTime": 360}, {"taskId": "0337626f-fa28-4b2b-bfa8-a82317a3e2f6", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 360}, {"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 360}], "enabled": true}, {"id": "ba7c36e6-1352-4e3e-97b8-b74e3579d5ee", "name": "Morning (Sun)", "blockConfigs": [{"blockId": "6eabf596-e014-4564-bcb9-05e6c8f50764", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae865cbc-cf5a-4fde-8b80-d1b3718126fb", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "0978257e-e7fa-40db-884d-75b496026b4b", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "ae57fcaf-7f26-44c6-be0e-aa3af7e90aa0", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "efbac7d1-212e-494b-958d-c8bfd7b68c80", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "b6f8c317-bf62-4bdd-8b12-9eee470c3f0e", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}, {"blockId": "270936bc-f2eb-4718-b312-87d8a7afe736", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "fallbackWeight": 300, "idealTime": 360}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 360}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 240, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 95}]}, "idealTime": 360}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "expiresAfterMinutes": 300, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 93}]}, "idealTime": 360}, {"taskId": "a5c1b5d8-f53c-458d-9a7d-4b54c23e5461", "expiresAfterMinutes": 360, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 92}, {"offsetMinutes": 240, "value": 120}, {"offsetMinutes": 300, "value": 0}]}, "fallbackWeight": 0, "idealTime": 360}, {"taskId": "11ea576e-e1be-411f-bcd5-f99552d92491", "expiresAfterMinutes": 300, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 80}]}, "idealTime": 360}, {"taskId": "0337626f-fa28-4b2b-bfa8-a82317a3e2f6", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 360}, {"taskId": "a35fc331-2363-46c1-9483-ce214a60aa4b", "expiresAfterMinutes": 360, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 96}]}, "idealTime": 360}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 96}]}, "idealTime": 360}, {"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "idealTime": 360, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 94}]}}], "enabled": true}, {"id": "ca2249b0-cdb1-453d-a7aa-9943d4824a8e", "name": "Evening WeekE (Ideal)", "blockConfigs": [{"blockId": "60a5d743-6d6f-4527-b76b-3b67fe478e4b", "anchorId": "b54de5f5-c774-49c1-920e-a940176a565f"}, {"blockId": "3124311b-5601-4cb7-a2d8-7f10164d6ff4", "anchorId": "b54de5f5-c774-49c1-920e-a940176a565f"}], "taskConfigs": [{"taskId": "2de0add5-0e43-4bbc-bc50-4b52811242f4", "expiresAfterMinutes": 120, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 98}]}, "idealTime": 1080}, {"taskId": "7014498d-986e-4db4-8e13-f756b5665ab0", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 97}]}, "expiresAfterMinutes": 240, "idealTime": 1080}, {"taskId": "67189468-73df-4881-8023-1e9d0a0bbfd3", "expiresAfterMinutes": 240, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 96}]}, "idealTime": 1080}, {"taskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 95}]}, "expiresAfterMinutes": 240, "idealTime": 1080}, {"taskId": "b1675a5e-4037-4194-96de-0012d06458b6", "expiresAfterMinutes": 240, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 94}]}, "idealTime": 1080}, {"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "expiresAfterMinutes": 300, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 93}]}, "idealTime": 1080}, {"taskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "expiresAfterMinutes": 300, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 92}]}, "idealTime": 1080}, {"taskId": "93737552-6b86-4e4b-89d5-d1cfbac7b7f2", "expiresAfterMinutes": 240, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 100}]}, "idealTime": 1080}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 120, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 1080}], "enabled": true}, {"id": "e54e34f7-dcf2-441c-9969-1aecbcc5a713", "name": "Home Vacay Morning", "blockConfigs": [{"blockId": "7ac86fc7-2667-4521-a998-f733b7bc6680", "anchorId": "e2422794-7396-4047-8c44-b94ee6db1936"}], "enabled": true, "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "fallbackWeight": 0, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 900}]}, "idealTime": 330}, {"taskId": "c4893a12-a704-4b12-aa26-3e3e1c93e1f5", "expiresAfterMinutes": 30, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 100}]}, "idealTime": 330}, {"taskId": "5af8b0f1-5dc2-4613-8054-ccfb8580a117", "expiresAfterMinutes": 120, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 330}, {"taskId": "7f83502a-36aa-4408-bd8e-18a2c6718168", "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 98}, {"offsetMinutes": 130, "value": 98}, {"offsetMinutes": 190, "value": 300}]}, "idealTime": 330}, {"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 270, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 97}]}, "idealTime": 330}, {"taskId": "850d5a1d-e530-4dea-a4a0-a81d80de59e9", "expiresAfterMinutes": 270, "slotWeights": {"8106b513-199a-407e-a518-c1d868ab48d1": [{"offsetMinutes": 0, "value": 96}]}, "idealTime": 330}]}, {"id": "5821cc82-a732-4ee5-9ba1-76550a06a713", "name": "Home Vacay Evening", "blockConfigs": [{"blockId": "2fef937e-386f-4cae-8006-bb4fe1467c5e", "anchorId": "b54de5f5-c774-49c1-920e-a940176a565f"}], "taskConfigs": [{"taskId": "8194aea2-b2a3-43be-b565-d724b279fa5d", "expiresAfterMinutes": 180, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 100}]}, "idealTime": 1050}], "enabled": true}, {"id": "fe9831b1-2dfb-4d59-b685-9aae8504c722", "name": "Home Vacay Sleep", "blockConfigs": [{"blockId": "910db3a3-f823-4c5b-9ffd-6dcfb819ca8a", "anchorId": "29b6f7fc-a81e-4997-9cae-49dbe85e92fa"}], "taskConfigs": [{"taskId": "caa2dd5c-18c0-4360-ab30-25a253ca4b58", "slotWeights": {"0b9be45c-31ff-4767-a829-53f4a2a77c73": [{"offsetMinutes": 0, "value": 1001}]}, "idealTime": 1380}, {"taskId": "057faf0d-17cf-4fc4-ae18-b69e7d3e92ef", "slotWeights": {"0b9be45c-31ff-4767-a829-53f4a2a77c73": [{"offsetMinutes": 0, "value": 1000}]}, "idealTime": 1380}], "enabled": true}, {"id": "e762e934-fa92-45ca-bc31-576cdf1f2ebc", "name": "Evening Routine + Football", "blockConfigs": [{"blockId": "3124311b-5601-4cb7-a2d8-7f10164d6ff4", "anchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6"}, {"blockId": "ccc20308-e4c0-47e4-9623-35c8b55909f9", "anchorId": "5092f6ba-f0b2-4e50-88a7-4e4444b738d6"}], "taskConfigs": [{"taskId": "33380e16-c1da-469f-8775-162994b04d1a", "expiresAfterMinutes": 60, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 102}]}, "idealTime": 1080}, {"taskId": "b1675a5e-4037-4194-96de-0012d06458b6", "expiresAfterMinutes": 280, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 98}]}, "idealTime": 1080}, {"taskId": "67189468-73df-4881-8023-1e9d0a0bbfd3", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 100}]}, "expiresAfterMinutes": 180, "idealTime": 1080}, {"taskId": "ef1b2474-9324-4910-87e9-b857364c9caf", "expiresAfterMinutes": 240, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 99}]}, "idealTime": 1080}, {"taskId": "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "expiresAfterMinutes": 260, "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 98}]}, "idealTime": 1080}, {"taskId": "e05de6b2-09e4-4406-a7dd-9aaceee4371b", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 101}]}, "idealTime": 1130, "idealEndTime": 1230}, {"taskId": "46003671-dc0b-4d1d-8956-bb39b600315c", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 99}]}, "expiresAfterMinutes": 230, "idealTime": 1080}, {"taskId": "dd6b4afd-96f5-4ab4-81ed-9863b1426e74", "slotWeights": {"f68897d9-56ee-48f7-9d27-a5e972ce96d6": [{"offsetMinutes": 0, "value": 100}]}, "expiresAfterMinutes": 210, "idealTime": 1080}], "enabled": true}], "obligations": [{"id": "be01601b-55e5-45cd-bce7-06598a94f25a", "name": "Rent", "tasks": [{"taskId": "6084770f-7d0a-4fdd-934d-cbd5467e0741", "order": 0}], "deadline": "2031-03-04", "weightBrackets": [{"maxDaysRemaining": 30, "timeCurve": [{"time": 540, "value": 0}, {"time": 720, "value": 400}, {"time": 1020, "value": 400}, {"time": 1080, "value": 0}]}], "recurrence": "monthly", "recurrenceDayOfMonth": 1, "monthlyType": "relative", "recurrenceWeekOfMonth": "first", "recurrenceDayOfWeek": "weekday", "enabled": true}, {"id": "58e287c2-55ca-4a8b-9a96-e3c841e7d2a3", "name": "Disbursement Request", "tasks": [{"taskId": "c9a054ef-1b8f-454f-8c8c-a016cb4346fb", "order": 0}, {"taskId": "f3173ee4-39f4-4ee3-ae18-e6e1b050de13", "order": 1}], "deadline": "2026-07-20", "weightBrackets": [{"maxDaysRemaining": 30, "timeCurve": [{"time": 600, "value": 0}, {"time": 660, "value": 200}, {"time": 1080, "value": 200}, {"time": 1140, "value": 0}]}], "recurrence": "one-time", "enabled": false}], "doneObligations": [], "recoveryPlans": [{"id": "b96d06f5-a360-4588-8704-9de6eaf0d228", "name": "Rot Recovery", "taskIds": ["7f83502a-36aa-4408-bd8e-18a2c6718168", "67189468-73df-4881-8023-1e9d0a0bbfd3", "ef1b2474-9324-4910-87e9-b857364c9caf", "3d1f80d2-1afa-4a2d-be5e-e445044d8952", "b1675a5e-4037-4194-96de-0012d06458b6", "fafb6bcc-0d30-457f-8a30-b866d5aec336", "8d157780-60df-417e-8c02-86f87f29da6f", "0337626f-fa28-4b2b-bfa8-a82317a3e2f6", "8c6b68fb-092a-4e6a-a315-6e11fb892ab7"], "blockIds": [], "triggerType": "manual", "baseTimeCurve": [{"time": 360, "value": 0}, {"time": 420, "value": 300}, {"time": 1320, "value": 0}], "growthRate": 0.5, "saturationLimit": 700, "triggered": false}, {"id": "508f009b-5e47-4886-8863-5ece44cda21a", "name": "Grocery Emergency", "taskIds": ["0337626f-fa28-4b2b-bfa8-a82317a3e2f6"], "blockIds": [], "triggerType": "manual", "baseTimeCurve": [{"time": 360, "value": 0}, {"time": 420, "value": 200}, {"time": 1200, "value": 200}, {"time": 1230, "value": 0}], "growthRate": 0.5, "saturationLimit": 300, "triggered": false}, {"id": "d156c64e-4d98-4c7c-aa17-cada4d05c217", "name": "Decision Fatigue Recovery", "taskIds": ["53fbaa4d-a544-4851-817d-b67497a2747d"], "blockIds": [], "triggerType": "manual", "baseTimeCurve": [{"time": 420, "value": 0}, {"time": 480, "value": 300}, {"time": 1260, "value": 300}, {"time": 1320, "value": 0}], "growthRate": 0.5, "saturationLimit": 300, "triggered": false}], "dayPlans": [{"id": "a177942b-c29e-4f2c-8076-aeb8eda9d65a", "name": "Mon/Wed", "templateId": "eff0105e-07a2-4db1-91f0-73b5e17708c7", "routineIds": ["c2bf9ea4-600a-4ac7-91ee-133355f4fdd8", "2e871891-29e7-41fb-890f-0161c73efac9", "da6c9567-abe8-4b04-811c-d3ac94653480", "350796ec-69b8-4697-820e-92db8105a12f"]}, {"id": "f31546e1-18e6-41d6-99d8-6ebc61d59138", "name": "Tue/Thu", "templateId": "eff0105e-07a2-4db1-91f0-73b5e17708c7", "routineIds": ["ca2af41b-3850-4b5c-93da-74cf6389db61", "2e871891-29e7-41fb-890f-0161c73efac9", "da6c9567-abe8-4b04-811c-d3ac94653480", "350796ec-69b8-4697-820e-92db8105a12f"]}, {"id": "a4b20a37-a82a-4a7e-803a-5d23bc454b44", "name": "Friday", "templateId": "9c11f887-81c5-4884-b148-26969a9aae9b", "routineIds": ["bd91db82-08f9-4428-a70f-b846691a6003", "da6c9567-abe8-4b04-811c-d3ac94653480", "350796ec-69b8-4697-820e-92db8105a12f", "ab5963d9-9b28-49d2-a1d5-2da504f98036", "dbe3879f-b2d1-4753-8d06-b61cad86882b"]}, {"id": "b0becc24-07b3-4c04-8c91-97248b77ede7", "name": "Sat", "templateId": "9b62e4b8-ac16-4442-ad1e-33a2a89cfad0", "routineIds": ["d5f162fd-642f-45f2-bd8f-520899ebd21b", "ca2249b0-cdb1-453d-a7aa-9943d4824a8e", "350796ec-69b8-4697-820e-92db8105a12f"]}, {"id": "afa1649e-a79e-42c5-bd90-222fbc5e054b", "name": "Sun", "templateId": "9b62e4b8-ac16-4442-ad1e-33a2a89cfad0", "routineIds": ["ba7c36e6-1352-4e3e-97b8-b74e3579d5ee", "ca2249b0-cdb1-453d-a7aa-9943d4824a8e", "350796ec-69b8-4697-820e-92db8105a12f"]}, {"id": "70255e56-7b7c-4fb9-a474-ab05ff7e32be", "name": "Home Vacation", "templateId": "a9ad6479-97ff-41e1-9a46-e2f444746c25", "routineIds": ["e54e34f7-dcf2-441c-9969-1aecbcc5a713", "5821cc82-a732-4ee5-9ba1-76550a06a713", "fe9831b1-2dfb-4d59-b685-9aae8504c722"]}, {"id": "4a85ade6-74cc-43c1-9986-0a49b18f533a", "name": "Football evening", "templateId": "eff0105e-07a2-4db1-91f0-73b5e17708c7", "routineIds": ["bd91db82-08f9-4428-a70f-b846691a6003", "e762e934-fa92-45ca-bc31-576cdf1f2ebc", "350796ec-69b8-4697-820e-92db8105a12f"]}], "weekPlan": {"days": {"0": "afa1649e-a79e-42c5-bd90-222fbc5e054b", "1": "a177942b-c29e-4f2c-8076-aeb8eda9d65a", "2": "a177942b-c29e-4f2c-8076-aeb8eda9d65a", "3": "a177942b-c29e-4f2c-8076-aeb8eda9d65a", "4": "4a85ade6-74cc-43c1-9986-0a49b18f533a", "5": "a4b20a37-a82a-4a7e-803a-5d23bc454b44", "6": "b0becc24-07b3-4c04-8c91-97248b77ede7"}}, "calendarEvents": [{"id": "315f2c72-d416-44c6-87fd-365e33ffd3be", "name": "Home Vacation", "date": "2026-07-12", "endDate": "2026-07-19", "taskIds": [], "suspendRegular": true, "weightOffset": 1, "dayPlanOverride": "70255e56-7b7c-4fb9-a474-ab05ff7e32be"}, {"id": "a7317529-27a4-4ee3-9400-03ea8b6a3915", "name": "Football Day", "date": "2026-08-05", "taskIds": [], "suspendRegular": false}], "eventTemplates": [], "lastDoneAt": {"0": 38}, "debugMode": true};
  if (preset === 'user_migrated') {
    useTaskStore.setState({ tasks: USER_MIGRATED_DATA.tasks })
    useAnchorStore.setState({ anchors: USER_MIGRATED_DATA.anchors, slots: USER_MIGRATED_DATA.slots, templates: USER_MIGRATED_DATA.templates })
    useBlockStore.setState({ blocks: USER_MIGRATED_DATA.blocks })
    useRoutineStore.setState({ routines: USER_MIGRATED_DATA.routines })
    useObligationStore.setState({ obligations: USER_MIGRATED_DATA.obligations, doneTasks: USER_MIGRATED_DATA.doneObligations })
    usePlannerStore.setState({
      dayPlans: USER_MIGRATED_DATA.dayPlans,
      weekPlan: USER_MIGRATED_DATA.weekPlan,
      calendarEvents: USER_MIGRATED_DATA.calendarEvents,
      eventTemplates: USER_MIGRATED_DATA.eventTemplates,
    })
    useSchedulerStore.setState({
      confirmedAnchors: [],
      adhocTasks: [],
      skippedTaskIds: [],
      doneTasks: [],
      doneItems: [],
      postponedTasks: [],
      weightOffsets: {},
      committedTasks: {},
      lastDoneAt: USER_MIGRATED_DATA.lastDoneAt,
      debugMode: true,
      resolveVersion: Date.now(),
    })
    return
  }

  const baseAnchors = [
    { id: 'a-wake', name: 'Wake' },
    { id: 'a-work', name: 'Work Start' },
    { id: 'a-eve', name: 'Work End' },
    { id: 'a-sleep', name: 'Sleep' },
  ]
  const baseSlots = [
    { id: 's-morning', name: 'Morning', startAnchorId: 'a-wake', endAnchorId: 'a-work' },
    { id: 's-work', name: 'Work Block', startAnchorId: 'a-work', endAnchorId: 'a-eve' },
    { id: 's-evening', name: 'Evening', startAnchorId: 'a-eve', endAnchorId: 'a-sleep' },
    { id: 's-night', name: 'Night', startAnchorId: 'a-sleep', endAnchorId: 'a-wake' },
  ]
  const baseTemplates = [
    {
      id: 'tpl-workday',
      name: 'Standard Workday',
      entries: [
        { anchorId: 'a-wake', spikeTime: 420, slotId: 's-morning' },
        { anchorId: 'a-work', spikeTime: 540, slotId: 's-work' },
        { anchorId: 'a-eve', spikeTime: 1050, slotId: 's-evening' },
        { anchorId: 'a-sleep', spikeTime: 1380, slotId: 's-night' },
      ],
    },
  ]

  useAnchorStore.setState({ anchors: baseAnchors, slots: baseSlots, templates: baseTemplates })
  useObligationStore.setState({ obligations: [], doneTasks: [] })

  if (preset === 'all_features') {
    useTaskStore.setState({
      tasks: [
        { id: 't-load', title: 'Load Washer', weight: 95, durationMinutes: 10, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-machine', title: 'Machine Wash Cycle (BG)', weight: 90, durationMinutes: 45, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-fold', title: 'Fold Dry Clothes', weight: 85, durationMinutes: 20, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-hang', title: 'Hang Wet Laundry', weight: 80, durationMinutes: 15, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-deep-work', title: 'Morning Deep Work', weight: 70, durationMinutes: 60, minDurationMinutes: 25, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-share-a', title: 'Prep Architecture Slides', weight: 80, durationMinutes: 40, minDurationMinutes: 30, fixedEndTime: 655, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true } },
        { id: 't-share-b', title: 'Review Sprint Notes', weight: 80, durationMinutes: 40, minDurationMinutes: 10, fixedEndTime: 655, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true } },
        { id: 't-football', title: 'Evening Football', weight: 90, durationMinutes: 60, minDurationMinutes: 30, fixedEndTime: 1110, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true } },
        { id: 't-bath', title: 'Post-Match Bath', weight: 85, durationMinutes: 20, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-groceries', title: 'Buy Groceries', weight: 65, durationMinutes: 40, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-prep', title: 'Food Prep (3-Day TTL)', weight: 70, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-cook-meal', title: 'Cook Meal', weight: 80, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-quick-bites', title: 'Quick Bites', weight: 45, durationMinutes: 15, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-tax', title: 'Pay Property Tax (Slab Curve)', weight: 60, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
      ],
    })
    useBlockStore.setState({
      blocks: [
        {
          id: 'b-laundry',
          name: 'Morning Laundry Multi-Parent DAG',
          entries: [
            { taskId: 't-load', order: 0, isBackground: false },
            { taskId: 't-machine', order: 1, isBackground: true, requires: ['t-load'] },
            { taskId: 't-fold', order: 2, isBackground: false, requires: ['t-load'] },
            { taskId: 't-hang', order: 3, isBackground: false, requires: ['t-machine', 't-fold'] },
          ],
        },
        {
          id: 'b-work-focus',
          name: 'Work Focus & Equal-Priority Block',
          entries: [
            { taskId: 't-deep-work', order: 0, isBackground: false },
            { taskId: 't-share-a', order: 1, isBackground: false },
            { taskId: 't-share-b', order: 2, isBackground: false },
          ],
        },
        {
          id: 'b-eve-sport',
          name: 'Evening Sport (Head-Clip + Contingency)',
          entries: [
            { taskId: 't-football', order: 0, isBackground: false },
            { taskId: 't-bath', order: 1, isBackground: false, requires: ['t-football'], dropIfParentMissed: true },
          ],
        },
        {
          id: 'b-eve-kitchen',
          name: 'Evening Kitchen (Sequencer)',
          entries: [
            { taskId: 't-groceries', order: 0, isBackground: false },
            { taskId: 't-prep', order: 1, isBackground: false },
            { taskId: 't-cook-meal', order: 2, isBackground: false },
            { taskId: 't-quick-bites', order: 3, isBackground: false },
          ],
        },
      ],
    })
    useRoutineStore.setState({
      routines: [
        {
          id: 'r-core',
          name: 'Daily Core Routine (DAG + Exact-Fit)',
          enabled: true,
          blockConfigs: [
            { blockId: 'b-laundry', anchorId: 'a-wake' },
            { blockId: 'b-work-focus', anchorId: 'a-work' },
            { blockId: 'b-eve-sport', anchorId: 'a-eve' },
          ],
          taskConfigs: [
            { taskId: 't-deep-work', idealTime: 540 },
            { taskId: 't-share-a', idealTime: 605 },
            { taskId: 't-share-b', idealTime: 605 },
          ],
        },
        {
          id: 'r-cooking',
          name: 'Cooking & Meal Sequencer Routine',
          enabled: true,
          sequencerId: 'cooking-sequencer',
          blockConfigs: [
            { blockId: 'b-eve-kitchen', anchorId: 'a-eve' },
          ],
          taskConfigs: [],
        },
      ],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-work', name: 'Workday Plan', templateId: 'tpl-workday', routineIds: ['r-core', 'r-cooking'] }],
      weekPlan: { days: { 0: 'dp-work', 1: 'dp-work', 2: 'dp-work', 3: 'dp-work', 4: 'dp-work', 5: 'dp-work', 6: 'dp-work' } },
      calendarEvents: [],
      eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [],
      adhocTasks: [
        {
          id: 'adhoc-intruder',
          title: 'Urgent Client Call (Intruder @ 09:35)',
          durationMinutes: 30,
          startTime: 575,
          day: 0,
          weight: 95,
        },
        {
          id: 'adhoc-traffic',
          title: 'Evening Traffic Delay (20m @ 17:30)',
          durationMinutes: 20,
          startTime: 1050,
          day: 0,
          weight: 300,
        },
      ],
      skippedTaskIds: [],
      doneTasks: [],
      doneItems: [],
      postponedTasks: [],
      weightOffsets: {},
      committedTasks: {},
      resolveVersion: Date.now(),
    })
  } else if (preset === 'p5_intruder') {
    useTaskStore.setState({
      tasks: [
        { id: 't-flex-leader', title: 'Morning Deep Reading (60m ideal, 20m min)', weight: 60, durationMinutes: 60, minDurationMinutes: 20, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
      ],
    })
    useBlockStore.setState({
      blocks: [{ id: 'b-work', name: 'Work Block', entries: [{ taskId: 't-flex-leader', order: 0, isBackground: false }] }],
    })
    useRoutineStore.setState({
      routines: [{ id: 'r-1', name: 'Work Routine', enabled: true, blockConfigs: [{ blockId: 'b-work', anchorId: 'a-work' }], taskConfigs: [] }],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-1', name: 'Workday', templateId: 'tpl-workday', routineIds: ['r-1'] }],
      weekPlan: { days: { 0: 'dp-1', 1: 'dp-1', 2: 'dp-1', 3: 'dp-1', 4: 'dp-1', 5: 'dp-1', 6: 'dp-1' } },
      calendarEvents: [],
      eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [],
      adhocTasks: [{ id: 'adhoc-intruder', title: 'Priority Standup (Intruder)', durationMinutes: 30, startTime: 575, day: 0, weight: 95 }],
      skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, resolveVersion: Date.now(),
    })
  } else if (preset === 'p5_equal_share' || preset === 'p5_weight_tie') {
    const endWall = preset === 'p5_equal_share' ? 590 : 575
    useTaskStore.setState({
      tasks: [
        { id: 't-share-a', title: 'Prep Slides', weight: 80, durationMinutes: 40, minDurationMinutes: 30, fixedEndTime: endWall, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true } },
        { id: 't-share-b', title: 'Review Notes', weight: 80, durationMinutes: 40, minDurationMinutes: 10, fixedEndTime: endWall, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true } },
      ],
    })
    useBlockStore.setState({
      blocks: [{
        id: 'b-share', name: 'Equal Priority Block',
        entries: [
          { taskId: 't-share-a', order: 0, isBackground: false },
          { taskId: 't-share-b', order: 1, isBackground: false },
        ],
      }],
    })
    useRoutineStore.setState({
      routines: [{ id: 'r-1', name: 'Equal Weight Routine', enabled: true, blockConfigs: [{ blockId: 'b-share', anchorId: 'a-work' }], taskConfigs: [] }],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-1', name: 'Workday', templateId: 'tpl-workday', routineIds: ['r-1'] }],
      weekPlan: { days: { 0: 'dp-1', 1: 'dp-1', 2: 'dp-1', 3: 'dp-1', 4: 'dp-1', 5: 'dp-1', 6: 'dp-1' } },
      calendarEvents: [], eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, resolveVersion: Date.now(),
    })
  } else if (preset === 'p5_rescue') {
    useTaskStore.setState({
      tasks: [
        { id: 't-heavy-flex', title: 'Flexible Deep Work (w=85, no expiry)', weight: 85, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-urgent-expiring', title: 'Morning Standup Check-in (w=80, expires 09:15)', weight: 80, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
      ],
    })
    useBlockStore.setState({
      blocks: [{
        id: 'b-rescue', name: '2-Hop Lookahead Block',
        entries: [
          { taskId: 't-heavy-flex', order: 0, isBackground: false },
          { taskId: 't-urgent-expiring', order: 1, isBackground: false },
        ],
      }],
    })
    useRoutineStore.setState({
      routines: [{
        id: 'r-1', name: 'Lookahead Routine', enabled: true,
        blockConfigs: [{ blockId: 'b-rescue', anchorId: 'a-work' }],
        taskConfigs: [
          { taskId: 't-urgent-expiring', idealTime: 540, expiresAfterMinutes: 15 },
          { taskId: 't-heavy-flex', idealTime: 540 },
        ],
      }],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-1', name: 'Workday', templateId: 'tpl-workday', routineIds: ['r-1'] }],
      weekPlan: { days: { 0: 'dp-1', 1: 'dp-1', 2: 'dp-1', 3: 'dp-1', 4: 'dp-1', 5: 'dp-1', 6: 'dp-1' } },
      calendarEvents: [], eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, resolveVersion: Date.now(),
    })
  } else if (preset === 'p4_cooking') {
    useTaskStore.setState({
      tasks: [
        { id: 't-groceries', title: 'Buy Groceries', weight: 65, durationMinutes: 40, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-prep', title: 'Food Prep (3-Day Batch)', weight: 70, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-cook-meal', title: 'Cook Meal', weight: 80, durationMinutes: 30, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-quick-bites', title: 'Quick Bites (Fallback)', weight: 45, durationMinutes: 15, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
      ],
    })
    useBlockStore.setState({
      blocks: [
        {
          id: 'b-morning-meal', name: 'Morning Meal Block',
          entries: [
            { taskId: 't-prep', order: 0, isBackground: false },
            { taskId: 't-cook-meal', order: 1, isBackground: false },
            { taskId: 't-quick-bites', order: 2, isBackground: false },
          ],
        },
        {
          id: 'b-evening-kitchen', name: 'Evening Kitchen Block',
          entries: [
            { taskId: 't-groceries', order: 0, isBackground: false },
            { taskId: 't-prep', order: 1, isBackground: false },
            { taskId: 't-cook-meal', order: 2, isBackground: false },
            { taskId: 't-quick-bites', order: 3, isBackground: false },
          ],
        },
      ],
    })
    useRoutineStore.setState({
      routines: [{
        id: 'r-cooking', name: 'Cooking & Meal Routine (Sequencer)', enabled: true, sequencerId: 'cooking-sequencer',
        blockConfigs: [
          { blockId: 'b-morning-meal', anchorId: 'a-wake' },
          { blockId: 'b-evening-kitchen', anchorId: 'a-eve' },
        ],
        taskConfigs: [],
      }],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-cooking', name: 'Cooking Plan', templateId: 'tpl-workday', routineIds: ['r-cooking'] }],
      weekPlan: { days: { 0: 'dp-cooking', 1: 'dp-cooking', 2: 'dp-cooking', 3: 'dp-cooking', 4: 'dp-cooking', 5: 'dp-cooking', 6: 'dp-cooking' } },
      calendarEvents: [], eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, resolveVersion: Date.now(),
    })
  } else if (preset === 'p3_laundry') {
    useTaskStore.setState({
      tasks: [
        { id: 't-load', title: 'Load Washer', weight: 95, durationMinutes: 10, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-machine', title: 'Machine Wash Cycle (BG)', weight: 90, durationMinutes: 45, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-fold', title: 'Fold Dry Clothes (Parallel FG)', weight: 85, durationMinutes: 20, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-hang', title: 'Hang Wet Laundry (Waits for Machine + Fold)', weight: 80, durationMinutes: 15, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
      ],
    })
    useBlockStore.setState({
      blocks: [{
        id: 'b-laundry', name: 'Multi-Parent Laundry DAG',
        entries: [
          { taskId: 't-load', order: 0, isBackground: false },
          { taskId: 't-machine', order: 1, isBackground: true, requires: ['t-load'] },
          { taskId: 't-fold', order: 2, isBackground: false, requires: ['t-load'] },
          { taskId: 't-hang', order: 3, isBackground: false, requires: ['t-machine', 't-fold'] },
        ],
      }],
    })
    useRoutineStore.setState({
      routines: [{ id: 'r-laundry', name: 'Morning Laundry Routine', enabled: true, blockConfigs: [{ blockId: 'b-laundry', anchorId: 'a-wake' }], taskConfigs: [] }],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-1', name: 'Workday', templateId: 'tpl-workday', routineIds: ['r-laundry'] }],
      weekPlan: { days: { 0: 'dp-1', 1: 'dp-1', 2: 'dp-1', 3: 'dp-1', 4: 'dp-1', 5: 'dp-1', 6: 'dp-1' } },
      calendarEvents: [], eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, resolveVersion: Date.now(),
    })
  } else if (preset === 'p2_football') {
    useTaskStore.setState({
      tasks: [
        { id: 't-football', title: 'Evening Football (fixedEndTime 18:30, min 30m)', weight: 90, durationMinutes: 60, minDurationMinutes: 30, fixedEndTime: 1110, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true } },
        { id: 't-bath', title: 'Post-Match Bath (Contingent on Football)', weight: 85, durationMinutes: 20, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
      ],
    })
    useBlockStore.setState({
      blocks: [{
        id: 'b-sport', name: 'Evening Sport Block',
        entries: [
          { taskId: 't-football', order: 0, isBackground: false },
          { taskId: 't-bath', order: 1, isBackground: false, requires: ['t-football'], dropIfParentMissed: true },
        ],
      }],
    })
    useRoutineStore.setState({
      routines: [{ id: 'r-sport', name: 'Evening Sport Routine', enabled: true, blockConfigs: [{ blockId: 'b-sport', anchorId: 'a-eve' }], taskConfigs: [] }],
    })
    usePlannerStore.setState({
      dayPlans: [{ id: 'dp-1', name: 'Workday', templateId: 'tpl-workday', routineIds: ['r-sport'] }],
      weekPlan: { days: { 0: 'dp-1', 1: 'dp-1', 2: 'dp-1', 3: 'dp-1', 4: 'dp-1', 5: 'dp-1', 6: 'dp-1' } },
      calendarEvents: [], eventTemplates: [],
    })
    useSchedulerStore.setState({
      confirmedAnchors: [],
      adhocTasks: [{ id: 'adhoc-traffic', title: 'Traffic Delay (20m @ 17:30)', durationMinutes: 20, startTime: 1050, day: 0, weight: 300 }],
      skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, resolveVersion: Date.now(),
    })
  }
}
