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

  // Actions
  resolve: (context: ResolveContext) => void
  confirmAnchor: (conf: AnchorConfirmation) => void
  addAdhocTask: (task: AdhocTask) => void
  removeAdhocTask: (id: string) => void
  skipTask: (taskId: string) => void
  unskipTask: (taskId: string) => void
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
  skippedTaskIds: string[]
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
    for (const routine of activeRoutines) {
      for (const blockId of routine.blockIds) {
        const block = context.blocks.find((b) => b.id === blockId)
        if (!block) continue

        for (const entry of block.entries) {
          if (skippedTaskIds.includes(entry.taskId)) continue
          const task = context.tasks.find((t) => t.id === entry.taskId)
          if (!task) continue

          // Resolve weight considering routine's slot weight overrides
          let weight = task.weight
          const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === task.id)

          // Find which slot this task ideally belongs to
          if (taskConfig?.slotWeights) {
            const slot = slots.find((s) => s.anchorName === dayAnchors.find((a) => a.id === block.anchorId)?.name)
            if (slot) {
              const anchorId = block.anchorId
              const slotCurve = taskConfig.slotWeights[anchorId]
              if (slotCurve && slotCurve.length > 0) {
                weight = getSlotWeight(slotCurve, 0) // at slot start for now
              }
            }
          }

          if (weight <= 0) continue

          items.push({
            taskId: task.id,
            title: task.title,
            startMinutes: 0,
            endMinutes: task.durationMinutes,
            isBackground: entry.isBackground,
            source: 'routine',
            weight,
            day: dayIndex,
          })
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

// Simple greedy placement: sort by weight, place into first available slot
function placeItems(
  items: ScheduledItem[],
  slots: { startTime: number; endTime: number; anchorName: string }[],
  anchors: Anchor[],
  confirmations: AnchorConfirmation[]
): ScheduledItem[] {
  // Items with user-specified start times (adhoc) keep their position
  const fixed = items.filter((i) => i.source === 'adhoc')
  const floating = items.filter((i) => i.source !== 'adhoc')

  // Sort floating by weight descending
  floating.sort((a, b) => b.weight - a.weight)

  // Track occupied time ranges
  const occupied: { start: number; end: number }[] = fixed.map((f) => ({
    start: f.startMinutes,
    end: f.endMinutes,
  }))

  const placed: ScheduledItem[] = [...fixed]

  for (const item of floating) {
    if (item.isBackground) {
      // Background items don't consume time, just mark them at current position
      item.startMinutes = 0
      item.endMinutes = item.endMinutes // duration stays
      placed.push(item)
      continue
    }

    // Find first gap that fits this task
    const duration = item.endMinutes // endMinutes was set to durationMinutes
    let bestStart = -1

    // Try placing in slots
    for (const slot of slots) {
      let cursor = slot.startTime
      // Adjust for confirmed anchor times
      const conf = confirmations.find((c) => {
        const anchor = anchors.find((a) => a.id === c.anchorId)
        return anchor?.name === slot.anchorName
      })
      if (conf) cursor = conf.actualTime

      while (cursor + duration <= slot.endTime) {
        const conflicts = occupied.some(
          (o) => cursor < o.end && cursor + duration > o.start
        )
        if (!conflicts) {
          bestStart = cursor
          break
        }
        cursor += 5 // try next 5-min slot
      }
      if (bestStart >= 0) break
    }

    if (bestStart >= 0) {
      item.startMinutes = bestStart
      item.endMinutes = bestStart + duration
      occupied.push({ start: item.startMinutes, end: item.endMinutes })
      placed.push(item)
    }
    // If no space found, item gets dropped (not placed)
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
            state.skippedTaskIds
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

      clearSchedule: () =>
        set({ schedule: null, confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [] }),
    }),
    { name: 'to-live-scheduler' }
  )
)
