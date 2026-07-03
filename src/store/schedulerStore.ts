import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WeekSchedule, DaySchedule, ScheduledItem, AnchorConfirmation, AdhocTask } from '../types/scheduler'
import type { Task } from '../types/task'
import type { Anchor } from '../types/anchor'
import type { Block } from '../types/block'
import type { Routine } from '../types/routine'
import type { Obligation } from '../types/obligation'
import type { RecoveryPlan } from '../types/recovery'
import type { DayPlan, CalendarEvent } from '../types/planner'
import { getWeight } from '../types/anchor'
import { getActiveBracket, getObligationWeight } from '../types/obligation'
import { getRecoveryWeight } from '../types/recovery'
import { getSlotWeight } from '../types/routine'
import { findSlots } from '../components/DayPlanner'

interface SchedulerStore {
  schedule: WeekSchedule | null
  confirmedAnchors: AnchorConfirmation[]
  adhocTasks: AdhocTask[]
  skippedTaskIds: string[]
  doneTasks: string[]
  postponedTasks: string[]
  lastDoneAt: Record<number, number>  // day → minutes from midnight (latest done-at time)

  // Actions
  resolve: (context: ResolveContext) => void
  confirmAnchor: (conf: AnchorConfirmation) => void
  addAdhocTask: (task: AdhocTask) => void
  removeAdhocTask: (id: string) => void
  skipTask: (taskId: string) => void
  unskipTask: (taskId: string) => void
  markDone: (taskId: string) => void
  markDoneAt: (taskId: string, doneAtMinutes: number, day: number) => void
  postpone: (taskId: string) => void
  preponeTask: (taskId: string, targetTime: number, day: number) => void
  unmarkTask: (taskId: string) => void
  insertTask: (taskId: string, startTime: number, day: number) => void
  undo: () => void
  clearSchedule: () => void
}

// All data the scheduler needs to resolve
export interface ResolveContext {
  tasks: Task[]
  anchors: Anchor[]
  blocks: Block[]
  routines: Routine[]
  obligations: Obligation[]
  recoveryPlans: RecoveryPlan[]
  dayPlans: DayPlan[]
  weekPlan: Record<number, string>
  calendarEvents: CalendarEvent[]
}

function getDateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay()
}

// Core scheduler: resolves a single day
function resolveDay(
  dayIndex: number,
  dateStr: string,
  context: ResolveContext,
  confirmedAnchors: AnchorConfirmation[],
  adhocTasks: AdhocTask[],
  skippedTaskIds: string[],
  lastDoneAt?: number
): DaySchedule {
  const dayOfWeek = getDayOfWeek(dateStr)

  // Find day plan (event override → week plan)
  const event = context.calendarEvents.find((e) => {
    if (e.date === dateStr) return true
    if (e.endDate && dateStr >= e.date && dateStr <= e.endDate) return true
    return false
  })

  let dayPlanId = ''
  let dayPlanName = 'Unplanned'
  const suspendRegular = event?.suspendRegular ?? false

  if (event?.dayPlanOverride) {
    dayPlanId = event.dayPlanOverride
  } else {
    dayPlanId = context.weekPlan[dayOfWeek] ?? ''
  }

  const dayPlan = context.dayPlans.find((p) => p.id === dayPlanId)
  if (dayPlan) dayPlanName = dayPlan.name

  // Get anchors for this day plan
  const dayAnchors = dayPlan
    ? context.anchors.filter((a) => dayPlan.anchorIds.includes(a.id))
    : context.anchors

  // Get slots from anchors
  const slots = findSlots(dayAnchors)

  // Get confirmed anchors for this day
  const dayConfirmations = confirmedAnchors.filter((c) => c.day === dayIndex)

  // Get adhoc tasks for this day
  const dayAdhocs = adhocTasks.filter((a) => a.day === dayIndex)

  // Collect all candidate tasks with their resolved weights
  const items: ScheduledItem[] = []

  // Add adhoc tasks first (user-specified times, highest priority placement)
  for (const adhoc of dayAdhocs) {
    items.push({
      taskId: adhoc.id,
      title: adhoc.title,
      startMinutes: adhoc.startTime,
      endMinutes: adhoc.startTime + adhoc.durationMinutes,
      isBackground: false,
      source: 'adhoc',
      weight: adhoc.weight,
      day: dayIndex,
    })
  }

  // Event-specific tasks
  if (event) {
    for (const tid of event.taskIds) {
      const task = context.tasks.find((t) => t.id === tid)
      if (!task || skippedTaskIds.includes(tid)) continue
      items.push({
        taskId: task.id,
        title: task.title,
        startMinutes: 0, // scheduler will place
        endMinutes: task.durationMinutes,
        isBackground: false,
        source: 'event',
        weight: task.weight * 2, // events get priority boost
        day: dayIndex,
      })
    }
  }

  // Skip routine/block tasks if event suspends regular
  if (!suspendRegular && dayPlan) {
    // Get active routines for this day plan
    const activeRoutines = context.routines.filter(
      (r) => r.enabled && dayPlan.routineIds.includes(r.id)
    )

    // Collect tasks from routines → blocks
    // Determine start cursor: confirmed anchor > lastDoneAt > idealSpawnTime
    for (const routine of activeRoutines) {
      let routineStart = routine.idealSpawnTime

      // Any confirmed anchor on this day overrides the routine start
      // The user edits anchor time to say "my actual day started here"
      if (dayConfirmations.length > 0) {
        // Use the earliest confirmation that's after midnight as the routine start
        const relevantConfs = dayConfirmations
          .map((c) => c.actualTime)
          .filter((t) => t > 0)
          .sort((a, b) => a - b)
        if (relevantConfs.length > 0) {
          routineStart = relevantConfs[0]
        }
      }

      // lastDoneAt takes priority if later
      let cursor = lastDoneAt !== undefined && lastDoneAt > routineStart
        ? lastDoneAt
        : routineStart

      for (const blockId of routine.blockIds) {
        const block = context.blocks.find((b) => b.id === blockId)
        if (!block) continue

        const sortedEntries = [...block.entries].sort((a, b) => a.order - b.order)

        for (const entry of sortedEntries) {
          if (skippedTaskIds.includes(entry.taskId)) continue
          const task = context.tasks.find((t) => t.id === entry.taskId)
          if (!task) continue

          // Resolve weight considering routine's slot weight overrides
          let weight = task.weight
          const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === task.id)

          if (taskConfig?.slotWeights) {
            const anchorId = block.anchorId
            const slotCurve = taskConfig.slotWeights[anchorId]
            if (slotCurve && slotCurve.length > 0) {
              const offsetInSlot = Math.max(0, cursor - routineStart)
              weight = getSlotWeight(slotCurve, offsetInSlot)
            }
          }

          // Use idealTime from taskConfig if set, but not earlier than cursor
          const idealStart = taskConfig?.idealTime
            ? Math.max(taskConfig.idealTime, cursor)
            : cursor

          if (weight <= 0) continue

          if (entry.isBackground) {
            items.push({
              taskId: task.id,
              title: task.title,
              startMinutes: idealStart,
              endMinutes: idealStart + task.durationMinutes,
              isBackground: true,
              source: 'routine',
              weight,
              day: dayIndex,
            })
          } else {
            items.push({
              taskId: task.id,
              title: task.title,
              startMinutes: idealStart,
              endMinutes: idealStart + task.durationMinutes,
              isBackground: false,
              source: 'routine',
              weight,
              day: dayIndex,
            })
            cursor = idealStart + task.durationMinutes
          }
        }
      }
    }
  }

  // Obligations (always run, even during event suspension)
  for (const ob of context.obligations) {
    if (!ob.enabled) continue
    const daysRemaining = ob.deadline
      ? Math.max(0, Math.ceil((new Date(ob.deadline).getTime() - new Date(dateStr).getTime()) / 86400000))
      : 999

    const bracket = getActiveBracket(ob.weightBrackets, daysRemaining)
    if (!bracket) continue

    for (const obTask of ob.tasks) {
      if (skippedTaskIds.includes(obTask.taskId)) continue
      const task = context.tasks.find((t) => t.id === obTask.taskId)
      if (!task) continue

      // Sample weight at midday for scheduling priority
      const weight = getObligationWeight(bracket.timeCurve, 720)
      if (weight <= 0) continue

      items.push({
        taskId: task.id,
        title: task.title,
        startMinutes: 0,
        endMinutes: task.durationMinutes,
        isBackground: false,
        source: 'obligation',
        weight,
        day: dayIndex,
      })
    }
  }

  // Recovery plans (triggered only)
  for (const plan of context.recoveryPlans) {
    if (!plan.triggered) continue
    const weight = getRecoveryWeight(plan, 720, dateStr)
    if (weight <= 0) continue

    for (const tid of plan.taskIds) {
      if (skippedTaskIds.includes(tid)) continue
      const task = context.tasks.find((t) => t.id === tid)
      if (!task) continue

      items.push({
        taskId: task.id,
        title: `[R] ${task.title}`,
        startMinutes: 0,
        endMinutes: task.durationMinutes,
        isBackground: false,
        source: 'recovery',
        weight,
        day: dayIndex,
      })
    }
  }

  // Sort by weight descending, then place sequentially into available time
  const placed = placeItems(items, slots, dayAnchors, dayConfirmations)

  return {
    date: dateStr,
    dayPlanId,
    dayPlanName,
    confirmedAnchors: dayConfirmations,
    items: placed,
    adhocTasks: dayAdhocs,
  }
}

// Place items: routine items keep their pre-computed positions,
// obligations/recovery get placed in first available gaps
function placeItems(
  items: ScheduledItem[],
  slots: { startTime: number; endTime: number; anchorName: string }[],
  _anchors: Anchor[],
  _confirmations: AnchorConfirmation[]
): ScheduledItem[] {
  // Pre-placed items: adhoc + routine (they have valid startMinutes)
  const prePlaced = items.filter((i) => i.source === 'adhoc' || i.source === 'routine' || i.source === 'event')
  const floating = items.filter((i) => i.source === 'obligation' || i.source === 'recovery')

  // Sort floating by weight descending
  floating.sort((a, b) => b.weight - a.weight)

  // Track occupied time ranges (only non-background items occupy time)
  const occupied: { start: number; end: number }[] = prePlaced
    .filter((i) => !i.isBackground)
    .map((f) => ({ start: f.startMinutes, end: f.endMinutes }))

  const placed: ScheduledItem[] = [...prePlaced]

  // Place floating items in gaps
  for (const item of floating) {
    if (item.isBackground) {
      placed.push(item)
      continue
    }

    const duration = item.endMinutes - item.startMinutes || item.endMinutes // duration
    let bestStart = -1

    // Scan from 6 AM to midnight for first gap
    let cursor = 360 // start searching from 6 AM
    while (cursor + duration <= 1440) {
      const conflicts = occupied.some(
        (o) => cursor < o.end && cursor + duration > o.start
      )
      if (!conflicts) {
        bestStart = cursor
        break
      }
      cursor += 5
    }

    if (bestStart >= 0) {
      item.startMinutes = bestStart
      item.endMinutes = bestStart + duration
      occupied.push({ start: item.startMinutes, end: item.endMinutes })
      placed.push(item)
    }
  }

  return placed.sort((a, b) => a.startMinutes - b.startMinutes)
}

export const useSchedulerStore = create<SchedulerStore>()(
  persist(
    (set, get) => ({
      schedule: null,
      confirmedAnchors: [],
      adhocTasks: [],
      skippedTaskIds: [],
      doneTasks: [],
      postponedTasks: [],
      lastDoneAt: {},

      resolve: (context) => {
        const state = get()
        const days: DaySchedule[] = []

        for (let i = 0; i < 7; i++) {
          const dateStr = getDateStr(i)
          days.push(resolveDay(
            i,
            dateStr,
            context,
            state.confirmedAnchors,
            state.adhocTasks,
            [...state.skippedTaskIds, ...state.doneTasks, ...state.postponedTasks],
            state.lastDoneAt[i]
          ))
        }

        set({
          schedule: {
            days,
            generated: new Date().toISOString(),
          },
        })
      },

      confirmAnchor: (conf) =>
        set((state) => ({
          confirmedAnchors: [
            ...state.confirmedAnchors.filter(
              (c) => !(c.anchorId === conf.anchorId && c.day === conf.day)
            ),
            conf,
          ],
        })),

      addAdhocTask: (task) =>
        set((state) => ({ adhocTasks: [...state.adhocTasks, task] })),

      removeAdhocTask: (id) =>
        set((state) => ({ adhocTasks: state.adhocTasks.filter((t) => t.id !== id) })),

      skipTask: (taskId) =>
        set((state) => ({
          skippedTaskIds: [...state.skippedTaskIds.filter((id) => id !== taskId), taskId],
        })),

      unskipTask: (taskId) =>
        set((state) => ({
          skippedTaskIds: state.skippedTaskIds.filter((id) => id !== taskId),
        })),

      markDone: (taskId) =>
        set((state) => ({
          doneTasks: [...state.doneTasks.filter((id) => id !== taskId), taskId],
        })),

      // Mark done at specific time — all tasks scheduled before this time
      // are also marked done, and remaining tasks recalibrate from here
      markDoneAt: (taskId, doneAtMinutes, day) =>
        set((state) => {
          // Find all tasks that were scheduled before doneAtMinutes and mark them done too
          const schedule = state.schedule
          const dayItems = schedule?.days[day]?.items ?? []
          const tasksBefore = dayItems
            .filter((item) => item.endMinutes <= doneAtMinutes && !item.isBackground)
            .map((item) => item.taskId)

          const allDone = [...new Set([...state.doneTasks, ...tasksBefore, taskId])]

          return {
            doneTasks: allDone,
            lastDoneAt: { ...state.lastDoneAt, [day]: doneAtMinutes },
          }
        }),

      postpone: (taskId) =>
        set((state) => ({
          postponedTasks: [...state.postponedTasks.filter((id) => id !== taskId), taskId],
        })),

      preponeTask: (taskId, targetTime, day) => {
        // Find actual task to get title and duration
        const schedule = get().schedule
        const item = schedule?.days[day]?.items.find((i) => i.taskId === taskId)
        const duration = item ? (item.endMinutes - item.startMinutes) : 30
        const title = item?.title ?? taskId

        set((state) => ({
          adhocTasks: [...state.adhocTasks, {
            id: `prepone-${taskId}-${Date.now()}`,
            title: `[preponed] ${title}`,
            durationMinutes: duration,
            startTime: targetTime,
            day,
            weight: 9999,
          }],
          skippedTaskIds: [...state.skippedTaskIds.filter((id) => id !== taskId), taskId],
        }))
      },

      unmarkTask: (taskId) =>
        set((state) => ({
          doneTasks: state.doneTasks.filter((id) => id !== taskId),
          postponedTasks: state.postponedTasks.filter((id) => id !== taskId),
        })),

      insertTask: (taskId, startTime, day) => {
        // Find actual task to get title and duration from context
        const allTasks = JSON.parse(localStorage.getItem('to-live-tasks') ?? '{}')?.state?.tasks ?? []
        const task = allTasks.find((t: any) => t.id === taskId)
        const title = task?.title ?? taskId
        const duration = task?.durationMinutes ?? 30

        set((state) => ({
          adhocTasks: [...state.adhocTasks, {
            id: `insert-${taskId}-${Date.now()}`,
            title,
            durationMinutes: duration,
            startTime,
            day,
            weight: 500,
          }],
        }))
      },

      undo: () =>
        set((state) => {
          // Undo last action by popping from the most recently modified list
          // Priority: adhocTasks > doneTasks > postponedTasks > skippedTaskIds > confirmedAnchors
          if (state.adhocTasks.length > 0) {
            return { adhocTasks: state.adhocTasks.slice(0, -1) }
          }
          if (state.doneTasks.length > 0) {
            return { doneTasks: state.doneTasks.slice(0, -1) }
          }
          if (state.postponedTasks.length > 0) {
            return { postponedTasks: state.postponedTasks.slice(0, -1) }
          }
          if (state.skippedTaskIds.length > 0) {
            return { skippedTaskIds: state.skippedTaskIds.slice(0, -1) }
          }
          if (state.confirmedAnchors.length > 0) {
            return { confirmedAnchors: state.confirmedAnchors.slice(0, -1) }
          }
          return {}
        }),

      clearSchedule: () =>
        set({ schedule: null, confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], postponedTasks: [], lastDoneAt: {} }),
    }),
    { name: 'to-live-scheduler' }
  )
)
