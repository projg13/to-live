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
import { useRecoveryStore } from './recoveryStore'
import { getSlotWeight } from '../types/routine'
import { useObligationStore } from './obligationStore'

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
  resolveVersion: number               // bumped to trigger re-resolve from actions
  debugMode: boolean                   // persisted debug toggle

  // Actions
  resolve: (context: ResolveContext) => void
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
  currentTimeMinutes?: number // minutes from midnight override (debug/recalculate)
}

function getDateStr(offsetDays: number, base?: string): string {
  const d = base ? new Date(base + 'T00:00:00') : new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay()
}

// Core scheduler: resolves a single day
function makeInstanceKey(source: string, sourceId: string, anchorId: string, taskId: string): string {
  return `${source}:${sourceId}:${anchorId}:${taskId}`
}

function resolveDay(
  dayIndex: number,
  dateStr: string,
  context: ResolveContext,
  confirmedAnchors: AnchorConfirmation[],
  adhocTasks: AdhocTask[],
  skippedTaskIds: string[],
  doneTasks: string[],
  weightOffsets: Record<string, number>,
  lastDoneAt?: number,
  debug: boolean = false
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

  // Current time in minutes from midnight (only relevant for today)
  const now = new Date()
  const nowMinutes = dayIndex === 0
    ? (context.currentTimeMinutes !== undefined ? context.currentTimeMinutes : now.getHours() * 60 + now.getMinutes())
    : 0

  // Collect all candidate tasks with their resolved weights
  const items: ScheduledItem[] = []

  // Add adhoc tasks first (user-specified times, highest priority placement)
  for (const adhoc of dayAdhocs) {
    const iKey = makeInstanceKey('adhoc', adhoc.id, '', adhoc.id)
    items.push({
      taskId: adhoc.id,
      instanceKey: iKey,
      title: adhoc.title,
      startMinutes: dayIndex === 0 ? Math.max(adhoc.startTime, nowMinutes) : adhoc.startTime,
      endMinutes: (dayIndex === 0 ? Math.max(adhoc.startTime, nowMinutes) : adhoc.startTime) + adhoc.durationMinutes,
      isBackground: false,
      source: 'adhoc',
      weight: Math.max(1, adhoc.weight + (weightOffsets[iKey] ?? 0)),
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
      const iKey = makeInstanceKey('event', event.id, '', task.id)
      items.push({
        taskId: task.id,
        instanceKey: iKey,
        title: task.title,
        startMinutes: 0, // scheduler will place
        endMinutes: task.durationMinutes,
        isBackground: false,
        source: 'event',
        weight: Math.max(1, task.weight * 2 + (weightOffsets[iKey] ?? 0)),
        day: dayIndex,
        sourceId: event.id,
        sourceName: event.name,
      })
    }
  }

  // Skip routine/block tasks if event suspends regular AND no weightOffset lets them through
  const allowRoutines = !suspendRegular || eventWeightOffset > 0


  // DEBUG: trace resolve chain
  if (debug) {
    console.group(`🔍 [Scheduler] Day ${dayIndex} (${dateStr})`)
    console.log('dayPlanId:', dayPlanId, '| dayPlan found:', !!dayPlan)
    console.log('weekPlan mapping:', context.weekPlan)
    console.log('dayOfWeek:', dayOfWeek)
    if (dayPlan) {
      console.log('dayPlan.routineIds:', dayPlan.routineIds)
      console.log('dayPlan.templateId:', dayPlan.templateId)
    }
    console.log('templates available:', context.templates?.length ?? 0)
    console.log('dayTemplate found:', !!dayTemplate, dayTemplate?.id)
    console.log('resolvedAnchors:', resolvedAnchors.map((a) => `${a.anchorName}@${a.actualTime}`))
    console.log('allowRoutines:', allowRoutines)
    console.log('all routines:', context.routines.map((r) => `${r.name}(${r.id.slice(0,8)}) enabled=${r.enabled} blocks=${r.blockConfigs.length}`))
    console.log('all blocks:', context.blocks.map((b) => `${b.name}(${b.id.slice(0,8)}) entries=${b.entries.length}`))
    console.log('all tasks:', context.tasks.length)
  }

  if (allowRoutines && dayPlan) {
    // Get active routines for this day plan
    const activeRoutines = context.routines.filter(
      (r) => r.enabled && dayPlan.routineIds.includes(r.id)
    )

    // Sort routines by their earliest anchor time (ascending)
    // This ensures overflow from earlier anchors pushes later anchors before they're processed
    activeRoutines.sort((a, b) => {
      const aMinAnchor = Math.min(...a.blockConfigs.map((bc) => {
        const anchor = resolvedAnchors.find((ra) => ra.anchorId === bc.anchorId)
        return anchor?.actualTime ?? 9999
      }))
      const bMinAnchor = Math.min(...b.blockConfigs.map((bc) => {
        const anchor = resolvedAnchors.find((ra) => ra.anchorId === bc.anchorId)
        return anchor?.actualTime ?? 9999
      }))
      return aMinAnchor - bMinAnchor
    })

    if (debug) {
      console.log('activeRoutines:', activeRoutines.map((r) => r.name))
      if (activeRoutines.length === 0) {
        console.warn('⚠️ No active routines! Check: routineIds in dayPlan match actual routine IDs, and routines are enabled')
      }
    }

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
        if (!block) {
          if (debug) console.warn(`    ❌ block ${bc.blockId.slice(0,8)} NOT FOUND`)
          continue
        }

        // Determine anchor start time — fall back to first anchor (Wake) if not matched
        const matchedAnchor = resolvedAnchors.find((a) => a.anchorId === bc.anchorId)
        const fallbackAnchorTime = resolvedAnchors.length > 0 ? resolvedAnchors[0].actualTime : 360
        const anchorTime = matchedAnchor?.actualTime ?? fallbackAnchorTime

        if (debug) {
          console.log(`    block "${block.name}" → anchor ${bc.anchorId.slice(0,8)} (matchedAnchor: ${!!matchedAnchor}, anchorTime: ${anchorTime}), ${block.entries.length} entries`)
        }

        for (const entry of block.entries) {
          if (skippedTaskIds.includes(entry.taskId)) {
            if (debug) console.log(`      ⏭ ${entry.taskId.slice(0,8)}: SKIPPED`)
            continue
          }
          // Instance-scoped done check
          const routineInstanceKey = makeInstanceKey('routine', routine.id, bc.anchorId, entry.taskId)
          const routineDoneKey = `${routineInstanceKey}:${dateStr}`
          if (doneTasks.includes(routineDoneKey)) {
            if (debug) console.log(`      ✅ ${entry.taskId.slice(0,8)}: ALREADY DONE (${routineInstanceKey})`)
            continue
          }
          const task = context.tasks.find((t) => t.id === entry.taskId)
          if (!task) {
            if (debug) console.warn(`      ❌ ${entry.taskId.slice(0,8)}: TASK NOT FOUND in context`)
            continue
          }

          // If any ancestor is skipped, skip this task too
          let ancestor = task.parentId
          let ancestorSkipped = false
          while (ancestor) {
            if (skippedTaskIds.includes(ancestor)) { ancestorSkipped = true; break }
            const parentTask = context.tasks.find((t) => t.id === ancestor)
            ancestor = parentTask?.parentId
          }
          if (ancestorSkipped) {
            if (debug) console.log(`      ⏭ ${task.title}: ANCESTOR SKIPPED`)
            continue
          }

          // Resolve weight
          let weight = task.weight
          const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === task.id)

          // Check expiry: anchor time + offset = deadline
          // If current time already past the deadline, skip during collection
          if (taskConfig?.expiresAfterMinutes !== undefined) {
            const taskIdeal = taskConfig.idealTime ?? anchorTime
            const expiryTime = taskIdeal + taskConfig.expiresAfterMinutes
            const nowMins = context.currentTimeMinutes !== undefined ? context.currentTimeMinutes : (new Date().getHours() * 60 + new Date().getMinutes())
            // Protect current task: if it would be active now, don't expire it
            const taskEnd = taskIdeal + task.durationMinutes
            const isCurrent = dayIndex === 0 && taskIdeal <= nowMins && nowMins < taskEnd
            if (dayIndex === 0 && nowMins >= expiryTime && !isCurrent) {
              if (debug) console.log(`      ⏰ ${task.title}: EXPIRED at collection (now=${nowMins} >= expiry@${expiryTime})`)
              continue
            }
          }

          if (taskConfig?.slotWeights && Object.keys(taskConfig.slotWeights).length > 0) {
            const fallback = taskConfig.fallbackWeight ?? 0
            const templateEntry = dayTemplate?.entries.find((e) => e.anchorId === bc.anchorId)
            const slotId = templateEntry?.slotId
            if (slotId) {
              const slotCurve = taskConfig.slotWeights[slotId]
              if (slotCurve && slotCurve.length > 0) {
                const offsetInSlot = Math.max(0, anchorTime - (matchedAnchor?.idealTime ?? anchorTime))
                weight = getSlotWeight(slotCurve, offsetInSlot)
              } else {
                weight = fallback
              }
            } else {
              weight = fallback
            }
            if (debug) console.log(`      🎚 ${task.title}: slotWeight resolved to ${weight} (fallback=${fallback})`)
          } else if (task.knobs.hasWeightCurve && task.weightCurve && task.weightCurve.length > 0) {
            // 24h circular weight curve on the task itself
            weight = getObligationWeight(task.weightCurve, anchorTime)
            if (debug) console.log(`      🎚 ${task.title}: taskWeightCurve resolved to ${weight} @${anchorTime}`)
          }

          // Apply event weight offset
          if (eventWeightOffset > 0) {
            weight = weight - eventWeightOffset
          }

          if (weight <= 0) {
            if (debug) console.log(`      ⚖️ ${task.title}: WEIGHT=0 (base=${task.weight}, resolved=${weight})`)
            continue
          }

          if (debug) console.log(`      ✓ ${task.title}: weight=${weight} @${anchorTime}`)
          candidates.push({ task, entry, anchorId: bc.anchorId, anchorTime, weight })
        }
      }
      if (debug) {
        console.log(`  routine "${routine.name}": ${candidates.length} candidates`, candidates.map((c) => `${c.task.title}(w=${c.weight},@${c.anchorTime})`))
      }

      // Sort candidates: first by anchor time (asc), then by weight (desc) within same anchor
      candidates.sort((a, b) => {
        if (a.anchorTime !== b.anchorTime) return a.anchorTime - b.anchorTime
        return b.weight - a.weight
      })

      // Place tasks sequentially, grouped by anchor
      // On day 0, cursor starts at max(firstAnchor, lastDoneAt, nowMinutes)
      // This ensures recalculate moves undone tasks to current time
      const firstAnchorTime = candidates[0]?.anchorTime ?? 0
      let cursor = Math.max(
        firstAnchorTime,
        dayIndex === 0 && lastDoneAt !== undefined ? lastDoneAt : 0,
        dayIndex === 0 ? nowMinutes : 0
      )
      let currentAnchorId = candidates[0]?.anchorId ?? ''

      for (const cand of candidates) {
        // When we move to a different anchor, jump cursor forward to that anchor's actual time
        // (which may have been pushed by overflow from the previous anchor group)
        if (cand.anchorId !== currentAnchorId) {
          currentAnchorId = cand.anchorId
          // Re-read the anchor's actual time (may have been pushed by earlier overflow)
          const freshAnchor = resolvedAnchors.find((a) => a.anchorId === cand.anchorId)
          const freshTime = freshAnchor?.actualTime ?? cand.anchorTime
          cursor = Math.max(cursor, freshTime)
        }

        const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === cand.task.id)

        // idealTime defaults to the block's anchor time (from day plan template)
        // User can override per-task via taskConfig.idealTime
        const taskIdealTime = taskConfig?.idealTime ?? cand.anchorTime
        const idealStart = Math.max(taskIdealTime, cursor)

        if (debug) {
          console.log(`      📍 ${cand.task.title}: anchorTime=${cand.anchorTime} taskConfig.idealTime=${taskConfig?.idealTime} → taskIdealTime=${taskIdealTime} cursor=${cursor} → idealStart=${idealStart}`)
        }

        // Double-check expiry against actual placement time
        // expiryTime uses ORIGINAL anchor — if pushed anchor makes idealStart exceed it, task is dropped
        // Expiry: idealTime (or anchor) + offset = deadline
        // If placement would start at or past expiry, drop it
        if (taskConfig?.expiresAfterMinutes !== undefined) {
          const expiryTime = taskIdealTime + taskConfig.expiresAfterMinutes
          if (idealStart >= expiryTime) {
            if (debug) console.log(`      ⏰ EXPIRED: ${cand.task.title} — idealStart=${idealStart} >= expiryTime=${expiryTime} (ideal=${taskIdealTime} + ${taskConfig.expiresAfterMinutes}min)`)
            continue
          }
        }

        const itemExpiryTime = taskConfig?.expiresAfterMinutes !== undefined
          ? taskIdealTime + taskConfig.expiresAfterMinutes
          : undefined

        const routineIKey = makeInstanceKey('routine', routine.id, cand.anchorId, cand.task.id)
        const offsetWeight = Math.max(1, cand.weight + (weightOffsets[routineIKey] ?? 0))

        if (cand.entry.isBackground) {
           items.push({
            taskId: cand.task.id,
            instanceKey: routineIKey,
            title: cand.task.title,
            startMinutes: idealStart,
            endMinutes: idealStart + cand.task.durationMinutes,
            isBackground: true,
            source: 'routine',
            weight: offsetWeight,
            day: dayIndex,
            sourceId: routine.id,
            sourceName: routine.name,
            resetAnchorId: cand.anchorId,
            idealTime: taskIdealTime,
            expiryTime: itemExpiryTime,
          })
        } else {
          items.push({
            taskId: cand.task.id,
            instanceKey: routineIKey,
            title: cand.task.title,
            startMinutes: idealStart,
            endMinutes: idealStart + cand.task.durationMinutes,
            isBackground: false,
            source: 'routine',
            weight: offsetWeight,
            day: dayIndex,
            sourceId: routine.id,
            sourceName: routine.name,
            resetAnchorId: cand.anchorId,
            idealTime: taskIdealTime,
            expiryTime: itemExpiryTime,
          })
          cursor = idealStart + cand.task.durationMinutes

          // Inline anchor push: if cursor overflowed past any subsequent anchors, push them now
          // so the next routine/candidate sees the updated times
          const thisAnchorIdx = resolvedAnchors.findIndex((a) => a.anchorId === cand.anchorId)
          if (thisAnchorIdx >= 0) {
            for (let ai = thisAnchorIdx + 1; ai < resolvedAnchors.length; ai++) {
              if (cursor > resolvedAnchors[ai].actualTime) {
                if (debug) console.log(`      🔀 ANCHOR PUSH: "${resolvedAnchors[ai].anchorName}" ${resolvedAnchors[ai].actualTime} → ${cursor} (overflow from "${cand.task.title}")`)
                resolvedAnchors[ai].actualTime = cursor
              }
            }
          }
        }
      }
    }
  }

  if (debug) {
    console.log('Total items collected:', items.length)
    console.groupEnd()
  }


  // Wake anchor — used as the pivot for obligations and recovery plans
  const wakeAnchor = resolvedAnchors.find((a) => a.anchorName === 'Wake')
  const wakeTime = wakeAnchor?.actualTime ?? 360


  // Obligation/recovery start: latest of wake, lastDoneAt, or current time
  // This ensures on recalculate, pending tasks move to NOW
  const obStart = Math.max(
    wakeTime,
    lastDoneAt !== undefined ? lastDoneAt : 0,
    nowMinutes
  )

  // Obligations and recovery: only on today (day 0).
  // When tomorrow becomes day 0, undone obligations naturally reappear.
  // Obligations follow the same suspend/weightOffset rules as routines.
  if (dayIndex === 0 && allowRoutines) {

  // Obligations
  if (debug) console.group(`📋 Obligations: ${context.obligations.length} total, obStart=${obStart}`)
  for (const ob of context.obligations) {
    if (!ob.enabled) {
      if (debug) console.log(`  ⏭ "${ob.name}": disabled`)
      continue
    }
    const resolvedDeadline = resolveObligationDeadline(ob, dateStr)
    const daysRemaining = resolvedDeadline
      ? Math.max(0, Math.ceil((new Date(resolvedDeadline).getTime() - new Date(dateStr).getTime()) / 86400000))
      : 999

    // Compute the period key for this obligation's done tracking.
    // For recurring obligations, this is the resolved deadline itself (e.g. "2026-07-01").
    // This way, when a new period starts (e.g. "2026-08-01"), old done entries don't match.
    // For one-time obligations, it's the deadline or dateStr.
    const obPeriodKey = resolvedDeadline
      ? (ob.recurrence !== 'one-time' ? resolvedDeadline : dateStr)
      : dateStr

    if (debug) console.log(`  📌 "${ob.name}": deadline=${resolvedDeadline ?? 'none'} daysRemaining=${daysRemaining} obPeriodKey=${obPeriodKey} brackets=${ob.weightBrackets.length}`)

    const bracket = getActiveBracket(ob.weightBrackets, daysRemaining)
    if (!bracket) {
      if (debug) console.log(`    ❌ No matching bracket for daysRemaining=${daysRemaining}`)
      continue
    }

    if (debug) console.log(`    ✓ Bracket: maxDaysRemaining=${bracket.maxDaysRemaining} timeCurve=${JSON.stringify(bracket.timeCurve)}`)

    // Find earliest time the curve has weight > 0 for placement
    let windowStart = 0
    if (bracket.timeCurve.length > 0) {
      if (bracket.timeCurve[0].value > 0) {
        windowStart = bracket.timeCurve[0].time
      } else {
        for (let i = 0; i < bracket.timeCurve.length - 1; i++) {
          const a = bracket.timeCurve[i]
          const b = bracket.timeCurve[i + 1]
          if (a.value === 0 && b.value > 0) {
            windowStart = a.time + 1
            break
          }
        }
      }
    }

    // Placement: max(obStart, windowStart) — never before now, never before weight window
    const obPlacement = Math.max(obStart, windowStart)

    // Collect all tasks in order: direct tasks first, then block entries
    const orderedTaskIds: string[] = ob.tasks.map((t) => t.taskId)
    for (const blockId of (ob.blockIds ?? [])) {
      const block = context.blocks.find((b) => b.id === blockId)
      if (!block) continue
      for (const entry of [...block.entries].sort((a, b) => a.order - b.order)) {
        if (!orderedTaskIds.includes(entry.taskId)) {
          orderedTaskIds.push(entry.taskId)
        }
      }
    }

    // Filter to valid, non-done, non-skipped tasks
    // Done key uses obPeriodKey (deadline-scoped) so tasks from old periods are automatically undone
    const validTasks = orderedTaskIds.filter((tid) => {
      if (skippedTaskIds.includes(tid)) return false
      const obIKey = makeInstanceKey('obligation', ob.id, '', tid)
      const periodDoneKey = `${obIKey}:${obPeriodKey}`
      const dailyKey = `${obIKey}:${dateStr}`
      const isDone = doneTasks.includes(periodDoneKey) || doneTasks.includes(dailyKey)
      if (debug) console.log(`      📝 ${tid}: periodDoneKey=${periodDoneKey} dailyKey=${dailyKey} isDone=${isDone}`)
      if (isDone) return false
      if (!context.tasks.find((t) => t.id === tid)) return false
      return true
    })

    if (debug) console.log(`    📝 Tasks: ${orderedTaskIds.length} total → ${validTasks.length} valid`)



    for (let idx = 0; idx < validTasks.length; idx++) {
      const tid = validTasks[idx]
      const task = context.tasks.find((t) => t.id === tid)!

      // Evaluate the weight curve at the placement window start
      const curveWeight = getObligationWeight(bracket.timeCurve, obPlacement)
      if (curveWeight <= 0) {
        if (debug) console.log(`      ⚖️ ${task.title}: WEIGHT=0 at ${obPlacement}min, skipping`)
        continue
      }

      if (eventWeightOffset > 0 && curveWeight - eventWeightOffset <= 0) {
        if (debug) console.log(`      ⚖️ ${task.title}: weight ${curveWeight} - eventOffset ${eventWeightOffset} <= 0, skipping`)
        continue
      }

      const effectiveWeight = eventWeightOffset > 0 ? curveWeight - eventWeightOffset : curveWeight
      // Order bonus: first task gets +1, last gets +totalTasks
      const taskWeight = effectiveWeight + (idx + 1)

      if (debug) console.log(`      ✓ ${task.title}: weight=${taskWeight} (curve=${curveWeight}) @${obPlacement}`)

      const obIKey = makeInstanceKey('obligation', ob.id, '', task.id)
      items.push({
        taskId: task.id,
        instanceKey: obIKey,
        title: task.title,
        startMinutes: obPlacement,
        endMinutes: obPlacement + task.durationMinutes,
        isBackground: false,
        source: 'obligation',
        weight: Math.max(1, taskWeight + (weightOffsets[obIKey] ?? 0)),
        day: dayIndex,
        sourceId: ob.id,
        sourceName: ob.name,
      })
    }
  }
  if (debug) console.groupEnd()

  // Recovery plans (triggered only)
  // Blocks provide tasks (duration only), weight comes from plan + order offset
  for (const plan of context.recoveryPlans) {
    if (!plan.triggered) continue

    // Find peak weight and weight window start from the base time curve
    let recPeakWeight = 0
    let recWindowStart = 0
    for (const pt of plan.baseTimeCurve) {
      if (pt.value > recPeakWeight) {
        recPeakWeight = pt.value
      }
    }
    if (plan.baseTimeCurve.length > 0) {
      if (plan.baseTimeCurve[0].value > 0) {
        recWindowStart = plan.baseTimeCurve[0].time
      } else {
        for (let i = 0; i < plan.baseTimeCurve.length - 1; i++) {
          const a = plan.baseTimeCurve[i]
          const b = plan.baseTimeCurve[i + 1]
          if (a.value === 0 && b.value > 0) {
            recWindowStart = a.time + 1
            break
          }
        }
      }
    }

    const recPlacement = Math.max(obStart, recWindowStart)

    // Collect all tasks in order: direct taskIds first, then block entries by order
    const orderedTaskIds: string[] = [...plan.taskIds]
    for (const blockId of plan.blockIds) {
      const block = context.blocks.find((b) => b.id === blockId)
      if (!block) continue
      for (const entry of [...block.entries].sort((a, b) => a.order - b.order)) {
        if (!orderedTaskIds.includes(entry.taskId)) {
          orderedTaskIds.push(entry.taskId)
        }
      }
    }

    // Filter to valid, non-done, non-skipped tasks
    // Recovery uses prefix match (any date) — tasks stay done until plan is resolved
    const validTasks = orderedTaskIds.filter((tid) => {
      if (skippedTaskIds.includes(tid)) return false
      const recIKey = makeInstanceKey('recovery', plan.id, '', tid)
      if (doneTasks.some((dk) => dk.startsWith(recIKey + ':'))) return false
      if (!context.tasks.find((t) => t.id === tid)) return false
      return true
    })

    const totalTasks = validTasks.length

    for (let idx = 0; idx < validTasks.length; idx++) {
      const tid = validTasks[idx]
      const task = context.tasks.find((t) => t.id === tid)!

      // Evaluate the piecewise curve at the window start time
      const curveWeight = getRecoveryWeight(plan, recPlacement, dateStr)
      if (curveWeight <= 0) {
        if (debug) console.log(`      ⚖️ [R] ${task.title}: WEIGHT=0 at ${recPlacement}min, skipping`)
        continue
      }

      // Weight = curve value at this time + order bonus (first task highest)
      const taskWeight = curveWeight + (totalTasks - idx)

      const recIKey = makeInstanceKey('recovery', plan.id, '', task.id)
      items.push({
        taskId: task.id,
        instanceKey: recIKey,
        title: `[R] ${task.title}`,
        startMinutes: recPlacement,
        endMinutes: recPlacement + task.durationMinutes,
        isBackground: false,
        source: 'recovery',
        weight: Math.max(1, taskWeight + (weightOffsets[recIKey] ?? 0)),
        day: dayIndex,
        sourceId: plan.id,
        sourceName: plan.name,
      })
    }
  }

  } // end dayIndex === 0 guard for obligations + recovery

  // Track which routine tasks were placed before each anchor (for Phase 3 recalculation)
  const preAnchorRoutineTasks = new Map<string, string[]>()
  const sortedAnchorIds = resolvedAnchors
    .sort((a, b) => a.actualTime - b.actualTime)
    .map((a) => a.anchorId)
  for (const item of items) {
    if (item.source !== 'routine' || !item.resetAnchorId) continue
    const anchorIdx = sortedAnchorIds.indexOf(item.resetAnchorId)
    // This item belongs to its anchor; record it as "before" all later anchors
    for (let ai = anchorIdx + 1; ai < sortedAnchorIds.length; ai++) {
      const laterAnchorId = sortedAnchorIds[ai]
      if (!preAnchorRoutineTasks.has(laterAnchorId)) preAnchorRoutineTasks.set(laterAnchorId, [])
      preAnchorRoutineTasks.get(laterAnchorId)!.push(item.taskId)
    }
  }

  // Compute overflow cutoff: 1440 + next day's first anchor ideal time
  // Tasks can spill past midnight as long as they start before the next day begins
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
    const nextDayPlan = context.dayPlans.find((p) => p.id === nextDayPlanId)
    const nextTemplate = nextDayPlan?.templateId
      ? templates.find((t) => t.id === nextDayPlan.templateId)
      : templates[0]
    if (nextTemplate && nextTemplate.entries.length > 0) {
      const nextFirstAnchor = Math.min(...nextTemplate.entries.map((e) => e.spikeTime))
      overflowCutoff = 1440 + nextFirstAnchor
    }
  }

  // Phase 2: Global weight merge — all items compete by weight
  const { placed, overflow } = placeItems(items, context.tasks, context.blocks, overflowCutoff, nowMinutes, debug)

  // Phase 3: Anchor recalculation — push only, never pull
  for (const ra of resolvedAnchors) {
    const preAnchorIds = preAnchorRoutineTasks.get(ra.anchorId) ?? []
    if (preAnchorIds.length === 0) continue
    // Find the latest end time of surviving pre-anchor routine tasks
    let maxEnd = 0
    for (const tid of preAnchorIds) {
      const item = placed.find((p) => p.taskId === tid)
      if (item && item.endMinutes > maxEnd) {
        maxEnd = item.endMinutes
      }
    }
    // Push only: anchor can move forward, never pull back from idealTime
    if (maxEnd > ra.actualTime) {
      if (debug) console.log(`  🔀 ANCHOR RECALC: "${ra.anchorName}" ${ra.actualTime} → ${maxEnd}`)
      ra.actualTime = maxEnd
    }
    // Ensure anchor never goes below idealTime
    if (ra.actualTime < ra.idealTime) {
      ra.actualTime = ra.idealTime
    }
  }

  return {
    date: dateStr,
    dayPlanId,
    dayPlanName,
    confirmedAnchors: dayConfirmations,
    resolvedAnchors,
    items: placed,
    overflowItems: overflow,
    adhocTasks: dayAdhocs,
  }
}

// Phase 2: Global weight-based placement
// All items (routine + obligation + recovery + adhoc + event) compete by weight.
// Highest weight gets first pick of time. Lower weight items gap-fill forward.
// Post-placement: routine items checked for expiry violations, resumable chains enforced.
function placeItems(
  items: ScheduledItem[],
  tasks: Task[],
  blocks: Block[],
  cutoff: number,
  nowMinutes: number,
  debug: boolean
): { placed: ScheduledItem[]; overflow: ScheduledItem[] } {
  const background = items.filter((i) => i.isBackground)
  const active = items.filter((i) => !i.isBackground)

  // Sort by weight descending — highest weight gets first pick of time
  active.sort((a, b) => b.weight - a.weight)

  // Build taskId → blockId map from actual Block entries (not task.blockId which may be unset)
  const taskBlockMap = new Map<string, string>()
  for (const block of blocks) {
    for (const entry of block.entries) {
      taskBlockMap.set(entry.taskId, block.id)
    }
  }

  // Build parent map for ordering (only for tasks in the same block)
  const parentMap = new Map<string, string>()
  for (const t of tasks) {
    if (t.parentId) {
      // Only enforce parent-child if both are in the same block
      const childBlock = taskBlockMap.get(t.id)
      const parentBlock = taskBlockMap.get(t.parentId)
      if (childBlock && childBlock === parentBlock) {
        parentMap.set(t.id, t.parentId)
      }
    }
  }

  // Build link continuity map: childTaskId → continuity rule (same-block only)
  // AND register links in parentMap so children wait for mother during placement
  const continuityOf = new Map<string, string>()
  for (const t of tasks) {
    if (t.links) {
      for (const link of t.links) {
        // Only evaluate links within same block
        const motherBlock = taskBlockMap.get(t.id)
        const childBlock = taskBlockMap.get(link.linkedTaskId)
        if (motherBlock && motherBlock === childBlock) {
          continuityOf.set(link.linkedTaskId, link.continuity ?? 'resumable')
          // Register in parentMap so placeItems enforces ordering
          if (!parentMap.has(link.linkedTaskId)) {
            parentMap.set(link.linkedTaskId, t.id)
          }
        }
      }
    }
  }

  // Topological fixup: ensure child tasks always come AFTER their parent
  if (parentMap.size > 0) {
    let changed = true
    let passes = 0
    while (changed && passes < 50) {
      changed = false
      passes++
      for (let i = 0; i < active.length; i++) {
        const parentId = parentMap.get(active[i].taskId)
        if (!parentId) continue
        const parentIdx = active.findIndex((a) => a.taskId === parentId)
        if (parentIdx > i) {
          const [child] = active.splice(i, 1)
          active.splice(parentIdx, 0, child)
          changed = true
          break
        }
      }
    }
  }

  const occupied: { start: number; end: number }[] = []
  const placed: ScheduledItem[] = [...background]
  const overflow: ScheduledItem[] = []
  const placedTaskIds = new Set<string>()

  // Place all items independently by weight order
  const placedEndByTaskId = new Map<string, number>()

  for (const item of active) {
    const duration = item.endMinutes - item.startMinutes
    let start = item.startMinutes

    // Child tasks always wait for their parent to finish (same-block only)
    const pid = parentMap.get(item.taskId)
    if (pid) {
      const parentEnd = placedEndByTaskId.get(pid)
      if (parentEnd !== undefined && start < parentEnd) {
        start = parentEnd
      }
    }

    // Check expiry before even trying — but protect current task
    const wouldBeCurrent = start <= nowMinutes && nowMinutes < start + duration
    if (item.expiryTime !== undefined && start >= item.expiryTime && !wouldBeCurrent) continue

    // Try ideal time
    if (start < cutoff && !hasConflict(start, duration, occupied)) {
      item.startMinutes = start
      item.endMinutes = start + duration
      occupied.push({ start, end: start + duration })
      placed.push(item)
      placedTaskIds.add(item.taskId)
      placedEndByTaskId.set(item.taskId, start + duration)
      continue
    }

    // Gap-fill: find next available slot
    let cursor = start
    let found = false
    while (cursor + duration <= cutoff) {
      if (item.expiryTime !== undefined && cursor >= item.expiryTime && !(cursor <= nowMinutes && nowMinutes < cursor + duration)) break
      if (!hasConflict(cursor, duration, occupied)) {
        item.startMinutes = cursor
        item.endMinutes = cursor + duration
        occupied.push({ start: cursor, end: cursor + duration })
        placed.push(item)
        placedTaskIds.add(item.taskId)
        placedEndByTaskId.set(item.taskId, cursor + duration)
        found = true
        break
      }
      cursor += 5
    }

    // If can't fit before cutoff → overflow
    if (!found) {
      overflow.push(item)
    }
  }

  // Align background children to start AFTER their parent finishes
  if (parentMap.size > 0) {
    for (const bg of background) {
      const pid = parentMap.get(bg.taskId)
      if (!pid) continue
      const parentItem = placed.find((p) => p.taskId === pid)
      if (parentItem) {
        const dur = bg.endMinutes - bg.startMinutes
        bg.startMinutes = parentItem.endMinutes
        bg.endMinutes = parentItem.endMinutes + dur
      }
    }
  }

  // Post-check: routine items pushed past their expiry → purge
  const expiredRoutineIds = new Set<string>()
  for (const item of placed) {
    if (item.source !== 'routine') continue
    const isCurrentItem = item.startMinutes <= nowMinutes && nowMinutes < item.endMinutes
    if (item.expiryTime !== undefined && item.startMinutes >= item.expiryTime && !isCurrentItem) {
      expiredRoutineIds.add(item.taskId)
      if (debug) console.log(`  ⏰ POST-PURGE: ${item.title} expired (start=${item.startMinutes} >= expiry=${item.expiryTime})`)
    }
  }
  // Remove expired items
  for (const id of expiredRoutineIds) {
    const idx = placed.findIndex((p) => p.taskId === id)
    if (idx >= 0) {
      const item = placed[idx]
      placed.splice(idx, 1)
      const occIdx = occupied.findIndex((o) => o.start === item.startMinutes && o.end === item.endMinutes)
      if (occIdx >= 0) occupied.splice(occIdx, 1)
      placedTaskIds.delete(id)
    }
  }

  // Post-check: resumable chains — if any member wasn't placed, remove ALL (same-block only)
  if (parentMap.size > 0) {
    const collectResumableChain = (taskId: string): string[] => {
      const descendants: string[] = []
      for (const [childId, pid] of parentMap) {
        if (pid === taskId) {
          const rule = continuityOf.get(childId) ?? 'resumable'
          if (rule === 'resumable') {
            descendants.push(childId)
            descendants.push(...collectResumableChain(childId))
          }
        }
      }
      return descendants
    }

    // Find resumable chain roots
    const resumableRoots = new Set<string>()
    for (const [childId] of parentMap) {
      const rule = continuityOf.get(childId) ?? 'resumable'
      if (rule === 'resumable') {
        let root = parentMap.get(childId)!
        while (parentMap.has(root) && (continuityOf.get(root) ?? 'resumable') === 'resumable') {
          root = parentMap.get(root)!
        }
        resumableRoots.add(root)
      }
    }

    // For each root, check if all chain members were placed
    for (const root of resumableRoots) {
      const chain = [root, ...collectResumableChain(root)]
      const activeInChain = chain.filter((id) => active.some((a) => a.taskId === id))
      const allPlaced = activeInChain.every((id) => placedTaskIds.has(id))
      if (!allPlaced) {
        if (debug) console.log(`  🔗 CHAIN DROP: [${chain.join(', ')}] — not all members placed`)
        // Remove all chain members from placed
        for (const id of chain) {
          const idx = placed.findIndex((p) => p.taskId === id)
          if (idx >= 0) {
            const item = placed[idx]
            placed.splice(idx, 1)
            const occIdx = occupied.findIndex((o) => o.start === item.startMinutes && o.end === item.endMinutes)
            if (occIdx >= 0) occupied.splice(occIdx, 1)
          }
        }
      }
    }
  }

  return {
    placed: placed.sort((a, b) => a.startMinutes - b.startMinutes),
    overflow
  }
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
      weightOffsets: {},
      committedTasks: {},
      resolveVersion: 0,
      debugMode: false,
      lastDoneAt: {},

      resolve: (context) => {
        const state = get()
        const today = getDateStr(0, context.baseDate)
        const currentMonth = today.slice(0, 7) // YYYY-MM

        // Purge stale doneTasks — keep today, yesterday, current obligation deadlines,
        // AND all recovery-sourced done entries (they persist until plan is resolved)
        const yesterday = getDateStr(-1, context.baseDate)
        const triggeredRecoveryIds = new Set(context.recoveryPlans.filter((p) => p.triggered).map((p) => p.id))
        // Collect all active obligation deadline periods to keep their done keys
        const activeObDeadlines = new Set<string>()
        for (const ob of context.obligations) {
          if (!ob.enabled) continue
          const dl = resolveObligationDeadline(ob, today)
          if (dl && ob.recurrence !== 'one-time') activeObDeadlines.add(dl)
        }
        activeObDeadlines.add(currentMonth) // backward compat
        const freshDoneTasks = state.doneTasks.filter((key) => {
          const colonIdx = key.lastIndexOf(':')
          if (colonIdx === -1) return false // bare IDs from old format — drop
          const suffix = key.slice(colonIdx + 1)
          // Keep recovery done entries for active (triggered) plans
          if (key.startsWith('recovery:')) {
            const parts = key.split(':')
            const planId = parts[1]
            if (triggeredRecoveryIds.has(planId)) return true
          }
          // Keep obligation done entries for current deadline periods
          if (key.startsWith('obligation:') && activeObDeadlines.has(suffix)) return true
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
            state.weightOffsets,
            state.lastDoneAt[i],
            state.debugMode  // debug all days when enabled
          ))
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

        if (state.debugMode) console.log('🔍 [Scheduler] debugMode is ON — toggle with toggleDebug()')

        // Auto-backup handled by hourly timer in backup.ts (started from SettingsPanel)
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

      markDone: (instanceKey) =>
        set((state) => {
          const schedule = state.schedule
          const item = schedule?.days.flatMap((d) => d.items).find((i) => i.instanceKey === instanceKey)
          const dayIdx = item?.day ?? 0
          const dateStr = getDateStr(dayIdx)

          // Use instanceKey:date as the completion key
          let completionKey = `${instanceKey}:${dateStr}`

          // Obligations with recurrence: key by resolved deadline period
          if (item && item.source === 'obligation' && item.sourceId) {
            const obligations = useObligationStore.getState().obligations
            const matchingOb = obligations.find((o) => o.id === item.sourceId)
            if (matchingOb && matchingOb.recurrence !== 'one-time') {
              const resolvedDeadline = resolveObligationDeadline(matchingOb, dateStr)
              if (resolvedDeadline) {
                completionKey = `${instanceKey}:${resolvedDeadline}`
              }
            }
          }

          const newDoneItems = item
            ? [...state.doneItems.filter((i) => i.instanceKey !== instanceKey), item]
            : state.doneItems

          const { [instanceKey]: _dropCommit, ...remainingCommits } = state.committedTasks

          const result: Partial<SchedulerStore> = {
            doneTasks: [...state.doneTasks.filter((id) => id !== completionKey), completionKey],
            doneItems: newDoneItems,
            committedTasks: remainingCommits,
            resolveVersion: state.resolveVersion + 1,
          }

          // Recovery auto-resolve: check if all tasks in this recovery plan are now done
          if (item && item.source === 'recovery' && item.sourceId) {
            const allDone = [...state.doneTasks, completionKey]
            const recoveryPlans = useRecoveryStore.getState().plans
            const plan = recoveryPlans.find((p) => p.id === item.sourceId)
            if (plan) {
              const allTaskIds = [...plan.taskIds]
              for (const blockId of plan.blockIds) {
                const block = JSON.parse(localStorage.getItem('to-live-blocks') ?? '{}')?.state?.blocks ?? []
                const b = block.find((bl: any) => bl.id === blockId)
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

      // Mark done at specific time — marks ONLY this task as done
      // and sets lastDoneAt so the scheduler recalibrates remaining
      // tasks from this point onwards on next resolve.
      markDoneAt: (instanceKey, doneAtMinutes, day) =>
        set((state) => {
          const schedule = state.schedule
          const dayItems = schedule?.days[day]?.items ?? []
          const dateStr = getDateStr(day)

          const item = dayItems.find((i) => i.instanceKey === instanceKey)

          // Build completion key using instanceKey
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
          }

          const allDoneIds = [...new Set([...state.doneTasks, completionKey])]

          // Save position of the done task for display
          const newDoneItems = [...state.doneItems]
          if (item && !newDoneItems.find((d) => d.instanceKey === instanceKey)) {
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
        set((state) => ({
          doneTasks: state.doneTasks.filter((id) => !id.startsWith(instanceKey + ':')),
          doneItems: state.doneItems.filter((i) => i.instanceKey !== instanceKey),
          resolveVersion: state.resolveVersion + 1,
        })),

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

      toggleDebug: () => {
        const current = get().debugMode
        set({ debugMode: !current })
        console.log(`🔍 [Debug] ${!current ? 'ON' : 'OFF'} — recalculate to see logs`)
      },

      clearSchedule: () =>
        set({ schedule: null, confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, committedTasks: {}, lastDoneAt: {} }),
    }),
    {
      name: 'to-live-scheduler',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { resolveVersion, ...rest } = state
        return rest
      },
    }
  )
)
