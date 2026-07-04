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
  debugMode: boolean                  // persisted debug toggle

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
          // Anchor-scoped done check: task resets per anchor cycle
          const anchorDoneKey = `${entry.taskId}:${bc.anchorId}:${dateStr}`
          if (doneTasks.includes(anchorDoneKey) || doneTasks.includes(`${entry.taskId}:${periodKey}`)) {
            if (debug) console.log(`      ✅ ${entry.taskId.slice(0,8)}: ALREADY DONE`)
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
        lastDoneAt !== undefined ? lastDoneAt : 0,
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
            idealTime: taskIdealTime,
            expiryTime: itemExpiryTime,
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
      if (doneTasks.includes(`${tid}:${dateStr}`) || doneTasks.includes(`${tid}:${periodKey}`)) return false
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

      items.push({
        taskId: task.id,
        title: task.title,
        startMinutes: obPlacement,
        endMinutes: obPlacement + task.durationMinutes,
        isBackground: false,
        source: 'obligation',
        weight: taskWeight,
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
      if (doneTasks.includes(`${tid}:${dateStr}`) || doneTasks.includes(`${tid}:${periodKey}`)) return false
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

      items.push({
        taskId: task.id,
        title: `[R] ${task.title}`,
        startMinutes: recoveryCursor,
        endMinutes: recoveryCursor + task.durationMinutes,
        isBackground: false,
        source: 'recovery',
        weight: taskWeight,
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
            state.lastDoneAt[i],
            state.debugMode && i === 0  // only debug day 0
          ))
        }

        set({
          doneTasks: freshDoneTasks,
          schedule: {
            days,
            generated: new Date().toISOString(),
          },
        })

        if (state.debugMode) console.log('🔍 [Scheduler] debugMode is ON — toggle with toggleDebug()')

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

      toggleDebug: () => {
        const current = get().debugMode
        set({ debugMode: !current })
        console.log(`🔍 [Debug] ${!current ? 'ON' : 'OFF'} — recalculate to see logs`)
      },

      clearSchedule: () =>
        set({ schedule: null, confirmedAnchors: [], adhocTasks: [], skippedTaskIds: [], doneTasks: [], doneItems: [], postponedTasks: [], lastDoneAt: {} }),
    }),
    { name: 'to-live-scheduler' }
  )
)
