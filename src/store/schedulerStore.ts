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
import { resolveObligationDeadline } from '../types/obligation'
import { useRecoveryStore } from './recoveryStore'
import { useObligationStore } from './obligationStore'
import { useTaskStore } from './taskStore'
import { useBlockStore } from './blockStore'
import { getDateStr, getDayOfWeek, makeInstanceKey, solveDay } from '../engine/solver'
import { defaultValueModel, type ValueModel } from '../engine/valueModel'
import { createCookingSequencer, createSequencerValueModel } from '../engine/sequencer'

interface SchedulerStore {
  schedule: WeekSchedule | null
  confirmedAnchors: AnchorConfirmation[]
  adhocTasks: AdhocTask[]
  skippedTaskIds: string[]
  doneTasks: string[]                  // instanceKey:date entries
  doneItems: ScheduledItem[]           // stored positions of done tasks for display
  postponedTasks: string[]
  lastDoneAt: Record<number, number>   // day → minutes from midnight (latest done-at time)
  weightOffsets: Record<string, number> // instanceKey → weight offset
  committedTasks: Record<string, number> // instanceKey → commit time (minutes from midnight)
  lastCommitTime: number | null        // most recent commit timestamp (persists across completion)
  resolveVersion: number               // bumped to trigger re-resolve from actions
  debugMode: boolean                   // persisted debug toggle
  debugDateOverride: string | null     // Patch 0010: Global simulated date override (YYYY-MM-DD)
  debugTimeOverride: number | null     // Patch 0010: Global simulated time override (0..1439 mins)

  // Actions
  resolve: (context: ResolveContext, model?: ValueModel<any>) => void
  confirmAnchor: (conf: AnchorConfirmation) => void
  addAdhocTask: (task: AdhocTask) => void
  updateAdhocTask: (id: string, updates: Partial<AdhocTask>) => void
  removeAdhocTask: (id: string) => void
  skipTask: (taskId: string) => void
  unskipTask: (taskId: string) => void
  markDone: (instanceKey: string) => void
  markDoneAt: (instanceKey: string, doneAtMinutes: number, day: number) => void
  unmarkTask: (instanceKey: string) => void
  setWeightOffset: (instanceKey: string, offset: number) => void
  clearWeightOffset: (instanceKey: string) => void
  commitTask: (instanceKey: string, atMinutes: number) => void
  uncommitTask: (instanceKey: string) => void
  clearRecoveryDone: (planId: string) => void

  recalibrateFrom: (minutes: number, day: number) => void
  toggleDebug: () => void
  setDebugDateOverride: (dateStr: string | null) => void
  setDebugTimeOverride: (mins: number | null) => void
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
  obligationDoneTasks?: string[] // passed explicitly for pure solveDay
  baseDate?: string  // ISO date override (debug) — if absent, uses today
  currentTimeMinutes?: number // minutes from midnight override (debug/recalculate)
}

function computeOverflowCutoff(dayIndex: number, context: ResolveContext): number {
  let overflowCutoff = 1440
  if (dayIndex < 6) {
    const nextDateStr = getDateStr(dayIndex + 1, context.baseDate)
    const nextDayOfWeek = getDayOfWeek(nextDateStr)
    const nextEvent = context.calendarEvents.find((e) => {
      if (e.date === nextDateStr) return true
      if (e.endDate && nextDateStr >= e.date && nextDateStr <= e.endDate) return true
      return false
    })
    let nextDayPlanId = ''
    if (nextEvent?.dayPlanOverrides?.[nextDateStr]) {
      nextDayPlanId = nextEvent.dayPlanOverrides[nextDateStr]
    } else if (nextEvent?.dayPlanOverride) {
      nextDayPlanId = nextEvent.dayPlanOverride
    } else {
      nextDayPlanId = context.weekPlan[nextDayOfWeek] ?? ''
    }
    const templates = context.templates ?? []
    const nextDayPlan = context.dayPlans.find((p) => p.id === nextDayPlanId)
    const nextTemplate = nextDayPlan?.templateId
      ? templates.find((t) => t.id === nextDayPlan.templateId)
      : templates[0]
    if (nextTemplate && nextTemplate.entries.length > 0) {
      const nextFirstAnchor = Math.min(...nextTemplate.entries.map((e) => e.spikeTime))
      overflowCutoff = 1440 + nextFirstAnchor
    }
  }
  return overflowCutoff
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
      weightOffsets: {},
      committedTasks: {},
      lastCommitTime: null,
      resolveVersion: 0,
      debugMode: true,
      debugDateOverride: null,
      debugTimeOverride: null,
      lastDoneAt: {},

      resolve: (context, model) => {
        const state = get()
        const effectiveBaseDate = context.baseDate ?? state.debugDateOverride ?? undefined
        const effectiveContext: ResolveContext = {
          ...context,
          baseDate: effectiveBaseDate,
        }

        let activeModel: ValueModel<any> = model ?? defaultValueModel
        if (!model && effectiveContext.routines.some((r) => r.sequencerId === 'cooking-sequencer')) {
          const cookSeq = createCookingSequencer({
            buyGroceriesTaskId: 't-groceries',
            foodPrepTaskId: 't-prep',
            cookMealTaskId: 't-cook-meal',
            quickBitesTaskId: 't-quick-bites',
            prepExpiryMinutes: 3 * 1440,
            groceryUsesPerRun: 2,
            mealsPerPrep: 2,
          })
          activeModel = createSequencerValueModel({ 'cooking-sequencer': cookSeq })
        }
        const today = getDateStr(0, effectiveBaseDate)
        const currentMonth = today.slice(0, 7) // YYYY-MM

        const yesterday = getDateStr(-1, effectiveBaseDate)
        const triggeredRecoveryIds = new Set(effectiveContext.recoveryPlans.filter((p) => p.triggered).map((p) => p.id))
        const freshDoneTasks = state.doneTasks.filter((key) => {
          const colonIdx = key.lastIndexOf(':')
          if (colonIdx === -1) return false
          const suffix = key.slice(colonIdx + 1)
          if (key.startsWith('recovery:')) {
            const parts = key.split(':')
            const planId = parts[1]
            if (triggeredRecoveryIds.has(planId)) return true
          }
          if (key.startsWith('obligation:')) return false
          return suffix === today || suffix === yesterday || suffix === currentMonth
        })

        // Purge stale obligation done keys from obligation store
        useObligationStore.getState().purgeStaleDone(today)
        const obligationDoneTasks = effectiveContext.obligationDoneTasks ?? useObligationStore.getState().doneTasks

        const now = new Date()
        const resolvedNowMinutes =
          effectiveContext.currentTimeMinutes !== undefined
            ? effectiveContext.currentTimeMinutes
            : state.debugTimeOverride !== null
              ? state.debugTimeOverride
              : now.getHours() * 60 + now.getMinutes()

        const days: DaySchedule[] = []
        for (let i = 0; i < 7; i++) {
          const dateStr = getDateStr(i, effectiveBaseDate)
          const dayOfWeek = getDayOfWeek(dateStr)
          const nowMinutes = i === 0 ? resolvedNowMinutes : 0
          const overflowCutoff = computeOverflowCutoff(i, effectiveContext)

          days.push(
            solveDay(
              {
                dayIndex: i,
                dateStr,
                dayOfWeek,
                nowMinutes,
                overflowCutoff,
                lastDoneAt: state.lastDoneAt[i],
              },
              effectiveContext,
              {
                confirmedAnchors: state.confirmedAnchors,
                adhocTasks: state.adhocTasks,
                skippedTaskIds: [...state.skippedTaskIds, ...state.postponedTasks],
                doneTasks: freshDoneTasks,
                obligationDoneTasks,
                weightOffsets: state.weightOffsets,
                committedTasks: state.committedTasks,
              },
              activeModel,
              state.debugMode
            )
          )
        }

        // Prune orphaned weight offsets (include overflow items too)
        const allInstanceKeys = new Set(days.flatMap((d) => [
          ...d.items.map((i) => i.instanceKey),
          ...(d.overflowItems ?? []).map((i) => i.instanceKey),
        ]))
        const prunedOffsets: Record<string, number> = {}
        for (const [key, val] of Object.entries(state.weightOffsets)) {
          if (allInstanceKeys.has(key)) prunedOffsets[key] = val
        }

        set({
          doneTasks: freshDoneTasks,
          weightOffsets: prunedOffsets,
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

      updateAdhocTask: (id, updates) =>
        set((state) => ({
          adhocTasks: state.adhocTasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          )
        })),

      removeAdhocTask: (id) =>
        set((state) => ({ adhocTasks: state.adhocTasks.filter((t) => t.id !== id) })),

      skipTask: (taskId) => {
        const allTasks = useTaskStore.getState().tasks
        const toSkip: string[] = [taskId]

        const collectDescendants = (parentId: string) => {
          const children = allTasks.filter((t) => t.parentId === parentId)
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

      markDone: (instanceKey) =>
        set((state) => {
          const schedule = state.schedule
          const item = schedule?.days.flatMap((d) => d.items).find((i) => i.instanceKey === instanceKey)
          const dayIdx = item?.day ?? 0
          const dateStr = getDateStr(dayIdx, state.debugDateOverride ?? undefined)

          let completionKey = `${instanceKey}:${dateStr}`

          if (item && item.source === 'obligation' && item.sourceId) {
            const obligations = useObligationStore.getState().obligations
            const matchingOb = obligations.find((o) => o.id === item.sourceId)
            if (matchingOb && matchingOb.recurrence !== 'one-time') {
              const resolvedDeadline = resolveObligationDeadline(matchingOb, dateStr)
              if (resolvedDeadline) {
                completionKey = `${instanceKey}:${resolvedDeadline}`
              }
            }
            useObligationStore.getState().markObligationDone(completionKey)
          }

          const isObligation = item?.source === 'obligation'
          const newDoneItems = isObligation
            ? state.doneItems
            : (item
              ? [...state.doneItems.filter((i) => i.instanceKey !== instanceKey), item]
              : state.doneItems)

          const { [instanceKey]: _dropCommit, ...remainingCommits } = state.committedTasks

          const result: Partial<SchedulerStore> = {
            doneTasks: isObligation
              ? state.doneTasks
              : [...state.doneTasks.filter((id) => id !== completionKey), completionKey],
            doneItems: newDoneItems,
            committedTasks: remainingCommits,
            resolveVersion: state.resolveVersion + 1,
          }

          if (item) {
            const now = new Date()
            const nowMinutes = state.debugTimeOverride ?? (now.getHours() * 60 + now.getMinutes())
            result.lastDoneAt = { ...state.lastDoneAt, [dayIdx]: nowMinutes }
          }

          if (item && item.source === 'recovery' && item.sourceId) {
            const allDone = [...state.doneTasks, completionKey]
            const recoveryPlans = useRecoveryStore.getState().plans
            const plan = recoveryPlans.find((p) => p.id === item.sourceId)
            if (plan) {
              const allTaskIds = [...plan.taskIds]
              const allBlocks = useBlockStore.getState().blocks
              for (const blockId of plan.blockIds) {
                const b = allBlocks.find((bl) => bl.id === blockId)
                if (b) for (const e of b.entries) allTaskIds.push(e.taskId)
              }
              const allRecoveryDone = allTaskIds.every((tid) => {
                const recKey = makeInstanceKey('recovery', plan.id, '', tid)
                return allDone.some((dk) => dk.startsWith(recKey + ':'))
              })
              if (allRecoveryDone) {
                setTimeout(() => useRecoveryStore.getState().resolve(plan.id), 0)
              }
            }
          }

          return result
        }),

      markDoneAt: (instanceKey, doneAtMinutes, day) =>
        set((state) => {
          const schedule = state.schedule
          const dayItems = schedule?.days[day]?.items ?? []
          const dateStr = getDateStr(day, state.debugDateOverride ?? undefined)

          const item = dayItems.find((i) => i.instanceKey === instanceKey)

          let completionKey = `${instanceKey}:${dateStr}`
          const isObligation = item?.source === 'obligation'
          if (item && isObligation && item.sourceId) {
            const obligations = useObligationStore.getState().obligations
            const matchingOb = obligations.find((o) => o.id === item.sourceId)
            if (matchingOb && matchingOb.recurrence !== 'one-time') {
              const resolvedDeadline = resolveObligationDeadline(matchingOb, dateStr)
              if (resolvedDeadline) {
                completionKey = `${instanceKey}:${resolvedDeadline}`
              }
            }
            useObligationStore.getState().markObligationDone(completionKey)
          }

          const allDoneIds = isObligation
            ? state.doneTasks
            : [...new Set([...state.doneTasks, completionKey])]

          const newDoneItems = [...state.doneItems]
          if (item && !isObligation && !newDoneItems.find((d) => d.instanceKey === instanceKey)) {
            newDoneItems.push(item)
          }

          const { [instanceKey]: _dropCommit, ...remainingCommits } = state.committedTasks

          return {
            doneTasks: allDoneIds,
            doneItems: newDoneItems,
            committedTasks: remainingCommits,
            lastDoneAt: { ...state.lastDoneAt, [day]: doneAtMinutes },
            resolveVersion: state.resolveVersion + 1,
          }
        }),

      unmarkTask: (instanceKey) =>
        set((state) => {
          if (instanceKey.startsWith('obligation:')) {
            useObligationStore.getState().unmarkObligationDone(instanceKey)
          }
          return {
            doneTasks: state.doneTasks.filter((id) => !id.startsWith(instanceKey + ':')),
            doneItems: state.doneItems.filter((i) => i.instanceKey !== instanceKey),
            resolveVersion: state.resolveVersion + 1,
          }
        }),

      setWeightOffset: (instanceKey, offset) =>
        set((state) => ({
          weightOffsets: { ...state.weightOffsets, [instanceKey]: offset },
          resolveVersion: state.resolveVersion + 1,
        })),

      clearWeightOffset: (instanceKey) =>
        set((state) => {
          const { [instanceKey]: _, ...rest } = state.weightOffsets
          return { weightOffsets: rest, resolveVersion: state.resolveVersion + 1 }
        }),

      clearRecoveryDone: (planId) =>
        set((state) => ({
          doneTasks: state.doneTasks.filter((dk) => !dk.startsWith(`recovery:${planId}:`)),
          resolveVersion: state.resolveVersion + 1,
        })),

      commitTask: (instanceKey, atMinutes) =>
        set((state) => ({
          committedTasks: { ...state.committedTasks, [instanceKey]: atMinutes },
          lastCommitTime: atMinutes,
        })),

      uncommitTask: (instanceKey) =>
        set((state) => {
          const { [instanceKey]: _, ...rest } = state.committedTasks
          return { committedTasks: rest }
        }),

      recalibrateFrom: (minutes, day) =>
        set((state) => ({
          lastDoneAt: { ...state.lastDoneAt, [day]: minutes },
          resolveVersion: state.resolveVersion + 1,
        })),

      undo: () =>
        set((state) => {
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

      toggleDebug: () => set((state) => ({ debugMode: !state.debugMode })),

      setDebugDateOverride: (dateStr) =>
        set((state) => ({
          debugDateOverride: dateStr,
          resolveVersion: state.resolveVersion + 1,
        })),

      setDebugTimeOverride: (mins) =>
        set((state) => ({
          debugTimeOverride: mins !== null ? Math.max(0, Math.min(1439, mins)) : null,
          resolveVersion: state.resolveVersion + 1,
        })),

      clearSchedule: () =>
        set({
          schedule: null,
          confirmedAnchors: [],
          adhocTasks: [],
          skippedTaskIds: [],
          doneTasks: [],
          doneItems: [],
          postponedTasks: [],
          weightOffsets: {},
          committedTasks: {},
          lastCommitTime: null,
          lastDoneAt: {},
        }),
    }),
    {
      name: 'to-live-scheduler',
    }
  )
)
