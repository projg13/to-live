import { useTaskStore } from './store/taskStore'
import { useObligationStore } from './store/obligationStore'
import { usePlannerStore } from './store/plannerStore'
import { useBlockStore } from './store/blockStore'
import { useRoutineStore } from './store/routineStore'
import type { TaskKnobs } from './types/task'

const RENT_TASK_ID = 't-rent'

const k: TaskKnobs = {
  scheduled: false,
  isMother: false,
  hasWeightCurve: false,
  hasExpiry: false,
  hasStickiness: false,
}

/**
 * Must be called AFTER Zustand stores have hydrated from localStorage.
 * Adds seed data only if it doesn't already exist.
 */
export function runSeedMigration() {
  const taskState = useTaskStore.getState()
  const obState = useObligationStore.getState()
  const plannerState = usePlannerStore.getState()
  const blockState = useBlockStore.getState()
  const routineState = useRoutineStore.getState()

  // --- Rent task ---
  if (!taskState.tasks.find((t) => t.id === RENT_TASK_ID)) {
    taskState.addTask({ id: RENT_TASK_ID, title: 'Rent', weight: 100, durationMinutes: 15, knobs: k })
  }

  // --- Rent obligation ---
  if (!obState.obligations.find((o) => o.name === 'Rent')) {
    obState.addObligation({
      id: 'ob-rent',
      name: 'Rent',
      tasks: [{ taskId: RENT_TASK_ID, order: 0 }],
      recurrence: 'monthly',
      monthlyType: 'relative',
      recurrenceWeekOfMonth: 'first',
      recurrenceDayOfWeek: 'weekend-day',
      enabled: true,
      weightBrackets: [
        {
          maxDaysRemaining: 31,
          timeCurve: [
            { time: 480, value: 80 },
            { time: 1200, value: 150 },
          ],
        },
      ],
    })
  }

  // =========================================================
  // GETAWAY SETUP — light routine for special event days
  // =========================================================

  // --- Getaway-specific tasks ---
  const getawayTasks = [
    { id: 't-getaway-explore', title: 'Explore / Sightsee',  weight: 90,  durationMinutes: 120 },
    { id: 't-getaway-journal', title: 'Travel Journal',      weight: 70,  durationMinutes: 20  },
    { id: 't-getaway-photo',   title: 'Photography Walk',    weight: 65,  durationMinutes: 45  },
  ]
  for (const gt of getawayTasks) {
    if (!taskState.tasks.find((t) => t.id === gt.id)) {
      taskState.addTask({ ...gt, knobs: k })
    }
  }

  // --- Getaway block: light morning + getaway activities ---
  if (!blockState.blocks.find((b) => b.id === 'block-getaway')) {
    blockState.addBlock({
      id: 'block-getaway',
      name: 'Getaway Day',
      anchorId: 'anchor-wake',
      entries: [
        { taskId: 't-brush',            order: 0, mandatory: true,  isBackground: false },
        { taskId: 't-protein-am',       order: 1, mandatory: false, isBackground: false },
        { taskId: 't-bath',             order: 2, mandatory: false, isBackground: false },
        { taskId: 't-getaway-explore',  order: 3, mandatory: false, isBackground: false },
        { taskId: 't-getaway-journal',  order: 4, mandatory: false, isBackground: false },
        { taskId: 't-getaway-photo',    order: 5, mandatory: false, isBackground: false },
        { taskId: 't-eat-am',           order: 6, mandatory: false, isBackground: false },
        { taskId: 't-sandhi-pm',        order: 7, mandatory: false, isBackground: false },
        { taskId: 't-read',             order: 8, mandatory: false, isBackground: false },
      ],
      expectedDurationMinutes: 480,
      overflowBehavior: 'drop',
      blockStickiness: 20,
    })
  }

  // --- Getaway routine ---
  if (!routineState.routines.find((r) => r.id === 'routine-getaway')) {
    routineState.addRoutine({
      id: 'routine-getaway',
      name: 'Getaway Routine',
      blockIds: ['block-getaway'],
      recurrence: { pattern: 'daily' },
      idealSpawnTime: 420,  // 7 AM
      enabled: true,
    })
  }

  // --- Getaway day plan ---
  if (!plannerState.dayPlans.find((p) => p.id === 'dp-getaway')) {
    plannerState.addDayPlan({
      id: 'dp-getaway',
      name: 'Getaway Day',
      anchorIds: ['anchor-wake', 'anchor-sleep'],
      routineIds: ['routine-getaway'],
    })
  }

  // --- Event template: "Weekend Getaway" ---
  if (!plannerState.eventTemplates.find((t) => t.id === 'tpl-weekend-getaway')) {
    plannerState.addEventTemplate({
      id: 'tpl-weekend-getaway',
      name: 'Weekend Getaway',
      suspendRegular: true,
      weightOffset: 60,
      taskIds: [],
      dayPlanOverride: 'dp-getaway',
    })
  }

  // --- Weekend Getaway event (Jul 6–8, 2026) using the template ---
  // Delete old version without offset/plan, then re-add
  const existing = plannerState.calendarEvents.find((e) => e.id === 'evt-weekend-getaway')
  if (existing && !existing.weightOffset) {
    plannerState.deleteEvent('evt-weekend-getaway')
  }
  if (!plannerState.calendarEvents.find((e) => e.id === 'evt-weekend-getaway')) {
    plannerState.addEvent({
      id: 'evt-weekend-getaway',
      name: 'Weekend Getaway',
      date: '2026-07-06',
      endDate: '2026-07-08',
      taskIds: [],
      suspendRegular: true,
      weightOffset: 60,
      dayPlanOverride: 'dp-getaway',
      templateId: 'tpl-weekend-getaway',
    })
  }
}
