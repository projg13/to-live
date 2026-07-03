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
import { getActiveBracket, getObligationWeight } from '../types/obligation'
import { getRecoveryWeight } from '../types/recovery'
import { getSlotWeight } from '../types/routine'

interface SchedulerStore {
  schedule: WeekSchedule | null
  confirmedAnchors: AnchorConfirmation[]
  adhocTasks: AdhocTask[]
  skippedTaskIds: string[]
  doneTasks: string[]
  doneItems: ScheduledItem[]          // stored positions of done tasks for display
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
  templates: { id: string; name: string; entries: { anchorId: string; spikeTime: number; slotId: string }[] }[]
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

  // Get confirmed anchors for this day
  const dayConfirmations = confirmedAnchors.filter((c) => c.day === dayIndex)

  // Get template for this day — best match has same anchor set as day plan
  const templates = context.templates ?? []
  const planAnchors = dayPlan?.anchorIds ?? []
  const dayTemplate = templates.find((t) => {
    const tplAnchors = t.entries.map((e) => e.anchorId)
    return tplAnchors.length === planAnchors.length &&
      tplAnchors.every((a) => planAnchors.includes(a))
  }) ?? templates[0]

  // Build resolved anchor times (template ideal → adjusted by confirmations/overflow)
  const resolvedAnchors: { anchorId: string; anchorName: string; idealTime: number; actualTime: number }[] = []
  if (dayTemplate) {
    const sorted = [...dayTemplate.entries].sort((a, b) => a.spikeTime - b.spikeTime)
    for (const entry of sorted) {
      const anchor = context.anchors.find((a) => a.id === entry.anchorId)
      const conf = dayConfirmations.find((c) => c.anchorId === entry.anchorId)
      resolvedAnchors.push({
        anchorId: entry.anchorId,
        anchorName: anchor?.name ?? '?',
        idealTime: entry.spikeTime,
        actualTime: conf?.actualTime ?? entry.spikeTime,
      })
    }
  }

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
    for (const routine of activeRoutines) {
      // Each routine starts at its own idealSpawnTime OR the pushed anchor time (whichever is later)
      let routineStart = routine.idealSpawnTime

      // Check if this routine's block anchor has been pushed (by overflow or confirmation)
      for (const blockId of routine.blockIds) {
        const block = context.blocks.find((b) => b.id === blockId)
        if (!block) continue
        const matchedAnchor = resolvedAnchors.find((a) => a.anchorId === block.anchorId)
        if (matchedAnchor) {
          // Use the later of idealSpawnTime or the anchor's actual (pushed) time
          routineStart = Math.max(routineStart, matchedAnchor.actualTime)
          break
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

          // If task has a parent, skip it if parent is skipped/not scheduled
          if (task.parentId && skippedTaskIds.includes(task.parentId)) continue

          // Resolve weight considering routine's slot weight overrides
          let weight = task.weight
          const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === task.id)

          // Check expiry: relative to routine's IDEAL spawn time (absolute clock time)
          if (taskConfig?.expiresAfterMinutes !== undefined) {
            const expiryTime = routine.idealSpawnTime + taskConfig.expiresAfterMinutes
            if (cursor >= expiryTime) continue
          }

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

          // Double-check expiry against actual placement time
          if (taskConfig?.expiresAfterMinutes !== undefined) {
            const expiryTime = routine.idealSpawnTime + taskConfig.expiresAfterMinutes
            if (idealStart >= expiryTime) continue
          }

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

        // After placing block tasks, if cursor overflowed past next anchor, push it
        // This always happens — the next slot starts when this one finishes
        const blockAnchorIdx = resolvedAnchors.findIndex((a) => a.anchorId === block.anchorId)
        if (blockAnchorIdx >= 0) {
          // Push ALL subsequent anchors that are now in the past
          for (let ai = blockAnchorIdx + 1; ai < resolvedAnchors.length; ai++) {
            if (cursor > resolvedAnchors[ai].actualTime) {
              resolvedAnchors[ai].actualTime = cursor
            }
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
  // Recovery tasks start from Wake anchor and have high priority
  const wakeAnchor = resolvedAnchors.find((a) => a.anchorName === 'Wake')
  const recoveryStart = wakeAnchor?.actualTime ?? 360

  for (const plan of context.recoveryPlans) {
    if (!plan.triggered) continue
    const weight = getRecoveryWeight(plan, 720, dateStr)
    if (weight <= 0) continue

    let recoveryCursor = recoveryStart
    for (const tid of plan.taskIds) {
      if (skippedTaskIds.includes(tid)) continue
      const task = context.tasks.find((t) => t.id === tid)
      if (!task) continue

      items.push({
        taskId: task.id,
        title: `[R] ${task.title}`,
        startMinutes: recoveryCursor,
        endMinutes: recoveryCursor + task.durationMinutes,
        isBackground: false,
        source: 'recovery',
        weight,
        day: dayIndex,
      })
      recoveryCursor += task.durationMinutes
    }
  }

  // Sort by weight descending, then place sequentially into available time
  const placed = placeItems(items, [], [], dayConfirmations)

  return {
    date: dateStr,
    dayPlanId,
    dayPlanName,
    confirmedAnchors: dayConfirmations,
    resolvedAnchors,
    items: placed,
    adhocTasks: dayAdhocs,
  }
}

// Place items: sort all by weight, place highest weight first at their ideal time.
// Lower weight items that conflict get pushed to next available gap.
function placeItems(
  items: ScheduledItem[],
  _slots: { startTime: number; endTime: number; anchorName: string }[],
  _anchors: Anchor[],
  _confirmations: AnchorConfirmation[]
): ScheduledItem[] {
  const background = items.filter((i) => i.isBackground)
  const active = items.filter((i) => !i.isBackground)

  // Sort by weight descending — highest weight gets first pick of time
  active.sort((a, b) => b.weight - a.weight)

  const occupied: { start: number; end: number }[] = []
  const placed: ScheduledItem[] = [...background]

  for (const item of active) {
    const duration = item.endMinutes - item.startMinutes

    // Try placing at ideal startMinutes first
    let start = item.startMinutes
    if (!hasConflict(start, duration, occupied)) {
      item.startMinutes = start
      item.endMinutes = start + duration
      occupied.push({ start, end: start + duration })
      placed.push(item)
      continue
    }

    // Conflict at ideal time — find next available gap from ideal start
    let cursor = start
    let found = false
    while (cursor + duration <= 1440) {
      if (!hasConflict(cursor, duration, occupied)) {
        item.startMinutes = cursor
        item.endMinutes = cursor + duration
        occupied.push({ start: cursor, end: cursor + duration })
        placed.push(item)
        found = true
        break
      }
      cursor += 5
    }

    // If no space after ideal, try before (wrap search from day start)
    if (!found) {
      cursor = 0
      while (cursor + duration <= start) {
        if (!hasConflict(cursor, duration, occupied)) {
          item.startMinutes = cursor
          item.endMinutes = cursor + duration
          occupied.push({ start: cursor, end: cursor + duration })
          placed.push(item)
          found = true
          break
        }
        cursor += 5
      }
    }
    // If still not found, task is dropped (no space in the day)
  }

  return placed.sort((a, b) => a.startMinutes - b.startMinutes)
}

function hasConflict(start: number, duration: number, occupied: { start: number; end: number }[]): boolean {
  return occupied.some((o) => start < o.end && start + duration > o.start)
}

export const useSchedulerStore = create<SchedulerStore>()(
  persist(
    (set, get) => ({
      schedule: null,
      confirmedAnchors: [],
      adhocTasks: [],
      skippedTaskIds: [],
      doneTasks: [],
      doneItems: [],
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

      skipTask: (taskId) => {
        // Also skip child tasks (those with parentId = this task)
        const allTasks = JSON.parse(localStorage.getItem('to-live-tasks') ?? '{}')?.state?.tasks ?? []
        const children = allTasks.filter((t: any) => t.parentId === taskId).map((t: any) => t.id)

        set((state) => ({
          skippedTaskIds: [...new Set([...state.skippedTaskIds, taskId, ...children])],
        }))
      },

      unskipTask: (taskId) =>
        set((state) => ({
          skippedTaskIds: state.skippedTaskIds.filter((id) => id !== taskId),
        })),

      markDone: (taskId) =>
        set((state) => {
          const schedule = state.schedule
          const item = schedule?.days.flatMap((d) => d.items).find((i) => i.taskId === taskId)
          const newDoneItems = item
            ? [...state.doneItems.filter((i) => i.taskId !== taskId), item]
            : state.doneItems
          return {
            doneTasks: [...state.doneTasks.filter((id) => id !== taskId), taskId],
            doneItems: newDoneItems,
          }
        }),

      // Mark done at specific time — all tasks scheduled before this time
      // are also marked done, and remaining tasks recalibrate from here
      markDoneAt: (taskId, doneAtMinutes, day) =>
        set((state) => {
          const schedule = state.schedule
          const dayItems = schedule?.days[day]?.items ?? []

          // All tasks ending before done-at time + this task
          const tasksBefore = dayItems
            .filter((item) => item.endMinutes <= doneAtMinutes && !item.isBackground)
            .map((item) => item.taskId)

          const allDoneIds = [...new Set([...state.doneTasks, ...tasksBefore, taskId])]

          // Save their positions for display
          const newDoneItems = [...state.doneItems]
          for (const item of dayItems) {
            if (allDoneIds.includes(item.taskId) && !newDoneItems.find((d) => d.taskId === item.taskId)) {
              newDoneItems.push(item)
            }
          }

          return {
            doneTasks: allDoneIds,
            doneItems: newDoneItems,
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
          doneItems: state.doneItems.filter((i) => i.taskId !== taskId),
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
        set({ schedule: null, confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], lastDoneAt: {} }),
    }),
    { name: 'to-live-scheduler' }
  )
)
