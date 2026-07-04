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
import { getActiveBracket, getObligationWeight, resolveObligationDeadline } from '../types/obligation'
import { getRecoveryWeight } from '../types/recovery'
import { getSlotWeight } from '../types/routine'
import { useObligationStore } from './obligationStore'

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
  recalibrateFrom: (minutes: number, day: number) => void
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
  baseDate?: string  // ISO date override (debug) — if absent, uses today
}

function getDateStr(offsetDays: number, base?: string): string {
  const d = base ? new Date(base + 'T00:00:00') : new Date()
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
  doneTasks: string[],
  lastDoneAt?: number
): DaySchedule {
  const dayOfWeek = getDayOfWeek(dateStr)
  const periodKey = dateStr.slice(0, 7) // YYYY-MM

  // Find day plan (event override → week plan)
  const event = context.calendarEvents.find((e) => {
    if (e.date === dateStr) return true
    if (e.endDate && dateStr >= e.date && dateStr <= e.endDate) return true
    return false
  })

  let dayPlanId = ''
  let dayPlanName = 'Unplanned'
  const suspendRegular = event?.suspendRegular ?? false
  const eventWeightOffset = event?.weightOffset ?? 0

  if (event?.dayPlanOverrides?.[dateStr]) {
    dayPlanId = event.dayPlanOverrides[dateStr]
  } else if (event?.dayPlanOverride) {
    dayPlanId = event.dayPlanOverride
  } else {
    dayPlanId = context.weekPlan[dayOfWeek] ?? ''
  }

  const dayPlan = context.dayPlans.find((p) => p.id === dayPlanId)
  if (dayPlan) dayPlanName = dayPlan.name

  // Get confirmed anchors for this day
  const dayConfirmations = confirmedAnchors.filter((c) => c.day === dayIndex)

  // Get template for this day — directly from dayPlan.templateId
  const templates = context.templates ?? []
  const dayTemplate = dayPlan?.templateId
    ? templates.find((t) => t.id === dayPlan.templateId)
    : templates[0]

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
      sourceId: adhoc.id,
      sourceName: 'Adhoc',
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
        sourceId: event.id,
        sourceName: event.name,
      })
    }
  }

  // Skip routine/block tasks if event suspends regular AND no weightOffset lets them through
  const allowRoutines = !suspendRegular || eventWeightOffset > 0
  if (allowRoutines && dayPlan) {
    // Get active routines for this day plan
    const activeRoutines = context.routines.filter(
      (r) => r.enabled && dayPlan.routineIds.includes(r.id)
    )

    // Collect tasks from routines → blocks
    for (const routine of activeRoutines) {
      // Collect ALL candidate tasks from ALL blocks in this routine
      interface CandidateTask {
        task: Task
        entry: { taskId: string; order: number; isBackground: boolean }
        anchorId: string
        anchorTime: number   // resolved start time for this anchor
        weight: number
      }

      const candidates: CandidateTask[] = []

      for (const bc of routine.blockConfigs) {
        const block = context.blocks.find((b) => b.id === bc.blockId)
        if (!block) continue

        // Determine anchor start time
        const matchedAnchor = resolvedAnchors.find((a) => a.anchorId === bc.anchorId)
        const anchorTime = matchedAnchor
          ? Math.max(routine.idealSpawnTime, matchedAnchor.actualTime)
          : routine.idealSpawnTime

        for (const entry of block.entries) {
          if (skippedTaskIds.includes(entry.taskId)) continue
          // Anchor-scoped done check: task resets per anchor cycle
          const anchorDoneKey = `${entry.taskId}:${bc.anchorId}:${dateStr}`
          if (doneTasks.includes(anchorDoneKey) || doneTasks.includes(`${entry.taskId}:${periodKey}`)) continue
          const task = context.tasks.find((t) => t.id === entry.taskId)
          if (!task) continue

          // If any ancestor is skipped, skip this task too
          let ancestor = task.parentId
          let ancestorSkipped = false
          while (ancestor) {
            if (skippedTaskIds.includes(ancestor)) { ancestorSkipped = true; break }
            const parentTask = context.tasks.find((t) => t.id === ancestor)
            ancestor = parentTask?.parentId
          }
          if (ancestorSkipped) continue

          // Resolve weight
          let weight = task.weight
          const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === task.id)

          // Check expiry: relative to routine's IDEAL spawn time
          if (taskConfig?.expiresAfterMinutes !== undefined) {
            const expiryTime = routine.idealSpawnTime + taskConfig.expiresAfterMinutes
            if (anchorTime >= expiryTime) continue
          }

          if (taskConfig?.slotWeights && Object.keys(taskConfig.slotWeights).length > 0) {
            const fallback = taskConfig.fallbackWeight ?? 0
            const templateEntry = dayTemplate?.entries.find((e) => e.anchorId === bc.anchorId)
            const slotId = templateEntry?.slotId
            if (slotId) {
              const slotCurve = taskConfig.slotWeights[slotId]
              if (slotCurve && slotCurve.length > 0) {
                const offsetInSlot = Math.max(0, anchorTime - routine.idealSpawnTime)
                weight = getSlotWeight(slotCurve, offsetInSlot)
              } else {
                weight = fallback
              }
            } else {
              weight = fallback
            }
          }

          // Apply event weight offset
          if (eventWeightOffset > 0) {
            weight = weight - eventWeightOffset
          }

          if (weight <= 0) continue

          candidates.push({ task, entry, anchorId: bc.anchorId, anchorTime, weight })
        }
      }

      // Sort candidates: first by anchor time (asc), then by weight (desc) within same anchor
      candidates.sort((a, b) => {
        if (a.anchorTime !== b.anchorTime) return a.anchorTime - b.anchorTime
        return b.weight - a.weight
      })

      // Place tasks sequentially, grouped by anchor
      let cursor = lastDoneAt !== undefined && lastDoneAt > (candidates[0]?.anchorTime ?? 0)
        ? lastDoneAt
        : (candidates[0]?.anchorTime ?? 0)
      let currentAnchorId = candidates[0]?.anchorId ?? ''

      for (const cand of candidates) {
        // When we move to a different anchor, reset cursor to that anchor's time
        if (cand.anchorId !== currentAnchorId) {
          currentAnchorId = cand.anchorId
          cursor = Math.max(cursor, cand.anchorTime)
        }

        const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === cand.task.id)

        // Use idealTime if set
        const idealStart = taskConfig?.idealTime
          ? Math.max(taskConfig.idealTime, cursor)
          : cursor

        // Double-check expiry against actual placement time
        if (taskConfig?.expiresAfterMinutes !== undefined) {
          const expiryTime = routine.idealSpawnTime + taskConfig.expiresAfterMinutes
          if (idealStart >= expiryTime) continue
        }

        if (cand.entry.isBackground) {
          items.push({
            taskId: cand.task.id,
            title: cand.task.title,
            startMinutes: idealStart,
            endMinutes: idealStart + cand.task.durationMinutes,
            isBackground: true,
            source: 'routine',
            weight: cand.weight,
            day: dayIndex,
            sourceId: routine.id,
            sourceName: routine.name,
            resetAnchorId: cand.anchorId,
          })
        } else {
          items.push({
            taskId: cand.task.id,
            title: cand.task.title,
            startMinutes: idealStart,
            endMinutes: idealStart + cand.task.durationMinutes,
            isBackground: false,
            source: 'routine',
            weight: cand.weight,
            day: dayIndex,
            sourceId: routine.id,
            sourceName: routine.name,
            resetAnchorId: cand.anchorId,
          })
          cursor = idealStart + cand.task.durationMinutes
        }
      }

      // After placing all routine tasks, check if cursor overflowed past next anchors
      for (const bc of routine.blockConfigs) {
        const blockAnchorIdx = resolvedAnchors.findIndex((a) => a.anchorId === bc.anchorId)
        if (blockAnchorIdx >= 0) {
          for (let ai = blockAnchorIdx + 1; ai < resolvedAnchors.length; ai++) {
            if (cursor > resolvedAnchors[ai].actualTime) {
              resolvedAnchors[ai].actualTime = cursor
            }
          }
        }
      }
    }
  }


  // Wake anchor — used as the pivot for obligations and recovery plans
  const wakeAnchor = resolvedAnchors.find((a) => a.anchorName === 'Wake')
  const wakeTime = wakeAnchor?.actualTime ?? 360

  // Obligation/recovery start: use lastDoneAt if later than wake
  const obStart = lastDoneAt !== undefined && lastDoneAt > wakeTime
    ? lastDoneAt
    : wakeTime

  // Obligations and recovery: only on today (day 0).
  // When tomorrow becomes day 0, undone obligations naturally reappear.
  // Obligations follow the same suspend/weightOffset rules as routines.
  if (dayIndex === 0 && allowRoutines) {

  // Obligations
  for (const ob of context.obligations) {
    if (!ob.enabled) continue
    const resolvedDeadline = resolveObligationDeadline(ob, dateStr)
    const daysRemaining = resolvedDeadline
      ? Math.max(0, Math.ceil((new Date(resolvedDeadline).getTime() - new Date(dateStr).getTime()) / 86400000))
      : 999

    const bracket = getActiveBracket(ob.weightBrackets, daysRemaining)
    if (!bracket) continue

    for (const obTask of ob.tasks) {
      if (skippedTaskIds.includes(obTask.taskId)) continue
      if (doneTasks.includes(`${obTask.taskId}:${dateStr}`) || doneTasks.includes(`${obTask.taskId}:${periodKey}`)) continue
      const task = context.tasks.find((t) => t.id === obTask.taskId)
      if (!task) continue

      // Apply event weight offset to obligation weight
      let weight = getObligationWeight(bracket.timeCurve, 720)
      if (eventWeightOffset > 0) {
        weight = weight - eventWeightOffset
      }
      if (weight <= 0) continue

      items.push({
        taskId: task.id,
        title: task.title,
        startMinutes: obStart,
        endMinutes: obStart + task.durationMinutes,
        isBackground: false,
        source: 'obligation',
        weight,
        day: dayIndex,
        sourceId: ob.id,
        sourceName: ob.name,
      })
    }
  }

  // Recovery plans (triggered only)
  // Recovery tasks start from Wake anchor and have high priority
  for (const plan of context.recoveryPlans) {
    if (!plan.triggered) continue
    const weight = getRecoveryWeight(plan, 720, dateStr)
    if (weight <= 0) continue

    let recoveryCursor = obStart
    for (const tid of plan.taskIds) {
      if (skippedTaskIds.includes(tid)) continue
      if (doneTasks.includes(`${tid}:${dateStr}`) || doneTasks.includes(`${tid}:${periodKey}`)) continue
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
        sourceId: plan.id,
        sourceName: plan.name,
      })
      recoveryCursor += task.durationMinutes
    }
  }

  } // end dayIndex === 0 guard for obligations + recovery

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
        const today = getDateStr(0, context.baseDate)
        const currentMonth = today.slice(0, 7) // YYYY-MM

        // Purge stale doneTasks — keep today, yesterday (for undo/recovery), and current obligation period
        const yesterday = getDateStr(-1, context.baseDate)
        const freshDoneTasks = state.doneTasks.filter((key) => {
          const colonIdx = key.lastIndexOf(':')
          if (colonIdx === -1) return false // bare IDs from old format — drop
          const suffix = key.slice(colonIdx + 1)
          return suffix === today || suffix === yesterday || suffix === currentMonth
        })

        const days: DaySchedule[] = []
        for (let i = 0; i < 7; i++) {
          const dateStr = getDateStr(i, context.baseDate)
          days.push(resolveDay(
            i,
            dateStr,
            context,
            state.confirmedAnchors,
            state.adhocTasks,
            [...state.skippedTaskIds, ...state.postponedTasks],
            freshDoneTasks,
            state.lastDoneAt[i]
          ))
        }

        set({
          doneTasks: freshDoneTasks,
          schedule: {
            days,
            generated: new Date().toISOString(),
          },
        })

        // Auto snapshot (debounced — avoids 409 SHA conflicts from rapid resolves)
        clearTimeout((globalThis as any).__backupTimer)
        ;(globalThis as any).__backupTimer = setTimeout(() => {
          import('../backup').then(({ snapshotToGitHub }) => {
            snapshotToGitHub().catch((err) => {
              console.error('Auto backup to GitHub failed:', err)
            })
          })
        }, 3000)
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
        // Recursively skip all descendants (children, grandchildren, etc.)
        const allTasks = JSON.parse(localStorage.getItem('to-live-tasks') ?? '{}')?.state?.tasks ?? []
        const toSkip: string[] = [taskId]

        const collectDescendants = (parentId: string) => {
          const children = allTasks.filter((t: any) => t.parentId === parentId)
          for (const child of children) {
            toSkip.push(child.id)
            collectDescendants(child.id)
          }
        }
        collectDescendants(taskId)

        set((state) => ({
          skippedTaskIds: [...new Set([...state.skippedTaskIds, ...toSkip])],
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
          const dayIdx = item?.day ?? 0
          const dateStr = getDateStr(dayIdx)

          // Default: key by date so task respawns next routine cycle
          let completionKey = `${taskId}:${dateStr}`

          // Routine tasks: anchor-scoped key so same task at different anchors tracks independently
          if (item && item.source === 'routine' && item.resetAnchorId) {
            completionKey = `${taskId}:${item.resetAnchorId}:${dateStr}`
          }

          // Obligations: key by month so they stay done for the period
          if (item && item.source === 'obligation' && item.sourceId) {
            const obligations = useObligationStore.getState().obligations
            const matchingOb = obligations.find((o) => o.id === item.sourceId)
            if (matchingOb && matchingOb.recurrence !== 'one-time') {
              const periodKey = dateStr.slice(0, 7) // YYYY-MM
              completionKey = `${taskId}:${periodKey}`
            }
          }

          const newDoneItems = item
            ? [...state.doneItems.filter((i) => i.taskId !== taskId), item]
            : state.doneItems
          return {
            doneTasks: [...state.doneTasks.filter((id) => id !== completionKey), completionKey],
            doneItems: newDoneItems,
          }
        }),

      // Mark done at specific time — marks ONLY this task as done
      // and sets lastDoneAt so the scheduler recalibrates remaining
      // tasks from this point onwards on next resolve.
      markDoneAt: (taskId, doneAtMinutes, day) =>
        set((state) => {
          const schedule = state.schedule
          const dayItems = schedule?.days[day]?.items ?? []
          const obligations = useObligationStore.getState().obligations

          const dateStr = getDateStr(day)
          const resolveKey = (tid: string) => {
            const item = dayItems.find((i) => i.taskId === tid)
            // Routine tasks: anchor-scoped
            if (item && item.source === 'routine' && item.resetAnchorId) {
              return `${tid}:${item.resetAnchorId}:${dateStr}`
            }
            // Obligations: period-scoped
            if (item && item.source === 'obligation' && item.sourceId) {
              const matchingOb = obligations.find((o) => o.id === item.sourceId)
              if (matchingOb && matchingOb.recurrence !== 'one-time') {
                const periodKey = dateStr.slice(0, 7)
                return `${tid}:${periodKey}`
              }
            }
            return `${tid}:${dateStr}`
          }

          const currentTaskIdKey = resolveKey(taskId)
          const allDoneIds = [...new Set([...state.doneTasks, currentTaskIdKey])]

          // Save position of the done task for display
          const newDoneItems = [...state.doneItems]
          const doneItem = dayItems.find((i) => i.taskId === taskId)
          if (doneItem && !newDoneItems.find((d) => d.taskId === taskId)) {
            newDoneItems.push(doneItem)
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
          doneTasks: state.doneTasks.filter((id) => id !== taskId && !id.startsWith(taskId + ':')),
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

      recalibrateFrom: (minutes, day) =>
        set((state) => ({
          lastDoneAt: { ...state.lastDoneAt, [day]: minutes },
        })),

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
