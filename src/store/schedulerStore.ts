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
  weightOffsets: Record<string, number> // instanceKey → weight offset (session-only, not persisted)
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
  insertTask: (taskId: string, startTime: number, day: number) => void
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
    const iKey = makeInstanceKey('adhoc', adhoc.id, '', adhoc.id)
    items.push({
      taskId: adhoc.id,
      instanceKey: iKey,
      title: adhoc.title,
      startMinutes: adhoc.startTime,
      endMinutes: adhoc.startTime + adhoc.durationMinutes,
      isBackground: false,
      source: 'adhoc',
      weight: adhoc.weight + (weightOffsets[iKey] ?? 0),
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
        weight: task.weight * 2 + (weightOffsets[iKey] ?? 0),
        day: dayIndex,
        sourceId: event.id,
        sourceName: event.name,
      })
    }
  }

  // Skip routine/block tasks if event suspends regular AND no weightOffset lets them through
  const allowRoutines = !suspendRegular || eventWeightOffset > 0

  // Current time in minutes from midnight (only relevant for today)
  const now = new Date()
  const nowMinutes = dayIndex === 0
    ? (context.currentTimeMinutes !== undefined ? context.currentTimeMinutes : now.getHours() * 60 + now.getMinutes())
    : 0

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
            if (dayIndex === 0 && nowMins >= expiryTime) {
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
        const offsetWeight = cand.weight + (weightOffsets[routineIKey] ?? 0)

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

    if (debug) console.log(`  📌 "${ob.name}": deadline=${resolvedDeadline ?? 'none'} daysRemaining=${daysRemaining} brackets=${ob.weightBrackets.length}`)

    const bracket = getActiveBracket(ob.weightBrackets, daysRemaining)
    if (!bracket) {
      if (debug) console.log(`    ❌ No matching bracket for daysRemaining=${daysRemaining}`)
      continue
    }

    if (debug) console.log(`    ✓ Bracket: maxDaysRemaining=${bracket.maxDaysRemaining} timeCurve=${JSON.stringify(bracket.timeCurve)}`)

    // Find: (1) peak weight for priority, (2) earliest time weight > 0 for placement
    let peakWeight = 0
    let windowStart = 0  // earliest time the curve has weight > 0

    // Find peak weight
    for (const pt of bracket.timeCurve) {
      if (pt.value > peakWeight) {
        peakWeight = pt.value
      }
    }

    // Find start of weight window: first time where interpolated value > 0
    // Scan curve segments for where weight transitions from 0 to non-zero
    if (bracket.timeCurve.length > 0) {
      if (bracket.timeCurve[0].value > 0) {
        windowStart = bracket.timeCurve[0].time
      } else {
        for (let i = 0; i < bracket.timeCurve.length - 1; i++) {
          const a = bracket.timeCurve[i]
          const b = bracket.timeCurve[i + 1]
          if (a.value === 0 && b.value > 0) {
            // Weight starts rising right after the zero point
            windowStart = a.time + 1  // 1 minute after zero-crossing
            break
          }
        }
      }
    }

    // Placement: max(obStart, windowStart) — never before now, never before weight window
    const obPlacement = Math.max(obStart, windowStart)

    // Use peak weight as the base (the obligation competes at its strongest)
    let baseWeight = peakWeight > 0 ? peakWeight : getObligationWeight(bracket.timeCurve, obPlacement)
    if (debug) console.log(`    ⚖️ peakWeight=${peakWeight} windowStart=${windowStart} placement@${obPlacement} baseWeight=${baseWeight}`)

    if (eventWeightOffset > 0) {
      baseWeight = baseWeight - eventWeightOffset
      if (debug) console.log(`    ⚖️ after eventOffset(-${eventWeightOffset}): ${baseWeight}`)
    }
    if (baseWeight <= 0) {
      if (debug) console.log(`    ❌ Weight <= 0, skipping`)
      continue
    }

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
    const validTasks = orderedTaskIds.filter((tid) => {
      if (skippedTaskIds.includes(tid)) return false
      const obIKey = makeInstanceKey('obligation', ob.id, '', tid)
      if (doneTasks.includes(`${obIKey}:${dateStr}`) || doneTasks.includes(`${obIKey}:${periodKey}`)) return false
      if (!context.tasks.find((t) => t.id === tid)) return false
      return true
    })

    if (debug) console.log(`    📝 Tasks: ${orderedTaskIds.length} total → ${validTasks.length} valid`)



    for (let idx = 0; idx < validTasks.length; idx++) {
      const tid = validTasks[idx]
      const task = context.tasks.find((t) => t.id === tid)!

      // Ascending weight: lower in list → higher weight (opposite of recovery)
      // First task: base + 1, Last task: base + totalTasks
      const taskWeight = baseWeight + (idx + 1)

      if (debug) console.log(`      ✓ ${task.title}: weight=${taskWeight} @${obPlacement}`)

      const obIKey = makeInstanceKey('obligation', ob.id, '', task.id)
      items.push({
        taskId: task.id,
        instanceKey: obIKey,
        title: task.title,
        startMinutes: obPlacement,
        endMinutes: obPlacement + task.durationMinutes,
        isBackground: false,
        source: 'obligation',
        weight: taskWeight + (weightOffsets[obIKey] ?? 0),
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

    // Evaluate weight at peak, with growth multiplier applied
    const baseWeight = recPeakWeight > 0
      ? getRecoveryWeight({ ...plan, baseTimeCurve: [{ time: 0, value: recPeakWeight }] }, 0, dateStr)
      : getRecoveryWeight(plan, recPlacement, dateStr)
    if (baseWeight <= 0) continue

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
    const validTasks = orderedTaskIds.filter((tid) => {
      if (skippedTaskIds.includes(tid)) return false
      const recIKey = makeInstanceKey('recovery', plan.id, '', tid)
      if (doneTasks.includes(`${recIKey}:${dateStr}`) || doneTasks.includes(`${recIKey}:${periodKey}`)) return false
      if (!context.tasks.find((t) => t.id === tid)) return false
      return true
    })

    const totalTasks = validTasks.length
    let recoveryCursor = recPlacement

    for (let idx = 0; idx < validTasks.length; idx++) {
      const tid = validTasks[idx]
      const task = context.tasks.find((t) => t.id === tid)!

      // Weight = base + (totalTasks - index) → first task highest, descending
      const taskWeight = baseWeight + (totalTasks - idx)

      const recIKey = makeInstanceKey('recovery', plan.id, '', task.id)
      items.push({
        taskId: task.id,
        instanceKey: recIKey,
        title: `[R] ${task.title}`,
        startMinutes: recoveryCursor,
        endMinutes: recoveryCursor + task.durationMinutes,
        isBackground: false,
        source: 'recovery',
        weight: taskWeight + (weightOffsets[recIKey] ?? 0),
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

  // Post-placement anchor adjustment: push anchors past any routine items that should be before them
  // Only routine tasks push anchors — adhoc/obligation/recovery/event do not
  const routinePlaced = placed.filter((i) => i.source === 'routine')
  const sortedAnchors = [...resolvedAnchors].sort((a, b) => a.actualTime - b.actualTime)
  for (const ra of sortedAnchors) {
    let maxEnd = 0
    const raIdx = sortedAnchors.indexOf(ra)
    const earlierAnchorIds = new Set(sortedAnchors.slice(0, raIdx).map((a) => a.anchorId))

    for (const item of routinePlaced) {
      if (item.startMinutes < ra.actualTime && item.endMinutes > maxEnd) {
        maxEnd = item.endMinutes
      }
      if (item.resetAnchorId && earlierAnchorIds.has(item.resetAnchorId) && item.endMinutes > maxEnd) {
        maxEnd = item.endMinutes
      }
    }
    if (maxEnd > ra.actualTime) {
      if (debug) console.log(`  🔀 POST-PLACE ANCHOR PUSH: "${ra.anchorName}" ${ra.actualTime} → ${maxEnd}`)
      ra.actualTime = maxEnd
    }
  }

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

    // Check expiry at ideal position
    if (item.expiryTime !== undefined && start >= item.expiryTime) {
      continue // already past expiry, drop
    }

    if (!hasConflict(start, duration, occupied)) {
      item.startMinutes = start
      item.endMinutes = start + duration
      occupied.push({ start, end: start + duration })
      placed.push(item)
      continue
    }

    // Conflict at ideal time — find next available gap from ideal start
    let cursor = start

    while (cursor + duration <= 1440) {
      // If scanning past expiry, drop the task
      if (item.expiryTime !== undefined && cursor >= item.expiryTime) {
        break
      }
      if (!hasConflict(cursor, duration, occupied)) {
        item.startMinutes = cursor
        item.endMinutes = cursor + duration
        occupied.push({ start: cursor, end: cursor + duration })
        placed.push(item)
        break
      }
      cursor += 5
    }

    // If no space before expiry or end of day, task is dropped
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
      weightOffsets: {},
      debugMode: false,
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
            state.weightOffsets,
            state.lastDoneAt[i],
            state.debugMode  // debug all days when enabled
          ))
        }

        // Prune orphaned weight offsets
        const allInstanceKeys = new Set(days.flatMap((d) => d.items.map((i) => i.instanceKey)))
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

          // Obligations with recurrence: key by month
          if (item && item.source === 'obligation' && item.sourceId) {
            const obligations = useObligationStore.getState().obligations
            const matchingOb = obligations.find((o) => o.id === item.sourceId)
            if (matchingOb && matchingOb.recurrence !== 'one-time') {
              completionKey = `${instanceKey}:${dateStr.slice(0, 7)}`
            }
          }

          const newDoneItems = item
            ? [...state.doneItems.filter((i) => i.instanceKey !== instanceKey), item]
            : state.doneItems

          const result: Partial<SchedulerStore> = {
            doneTasks: [...state.doneTasks.filter((id) => id !== completionKey), completionKey],
            doneItems: newDoneItems,
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
              completionKey = `${instanceKey}:${dateStr.slice(0, 7)}`
            }
          }

          const allDoneIds = [...new Set([...state.doneTasks, completionKey])]

          // Save position of the done task for display
          const newDoneItems = [...state.doneItems]
          if (item && !newDoneItems.find((d) => d.instanceKey === instanceKey)) {
            newDoneItems.push(item)
          }

          return {
            doneTasks: allDoneIds,
            doneItems: newDoneItems,
            lastDoneAt: { ...state.lastDoneAt, [day]: doneAtMinutes },
          }
        }),

      unmarkTask: (instanceKey) =>
        set((state) => ({
          doneTasks: state.doneTasks.filter((id) => !id.startsWith(instanceKey + ':')),
          doneItems: state.doneItems.filter((i) => i.instanceKey !== instanceKey),
        })),

      setWeightOffset: (instanceKey, offset) =>
        set((state) => ({
          weightOffsets: { ...state.weightOffsets, [instanceKey]: offset },
        })),

      clearWeightOffset: (instanceKey) =>
        set((state) => {
          const { [instanceKey]: _, ...rest } = state.weightOffsets
          return { weightOffsets: rest }
        }),

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

      toggleDebug: () => {
        const current = get().debugMode
        set({ debugMode: !current })
        console.log(`🔍 [Debug] ${!current ? 'ON' : 'OFF'} — recalculate to see logs`)
      },

      clearSchedule: () =>
        set({ schedule: null, confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], weightOffsets: {}, lastDoneAt: {} }),
    }),
    {
      name: 'to-live-scheduler',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { weightOffsets, ...rest } = state
        return rest
      },
    }
  )
)
