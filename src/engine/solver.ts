import type { DaySchedule, ScheduledItem, ScheduleDiagnostic } from '../types/scheduler'
import type { Task } from '../types/task'
import { type Block, validateBlockDag } from '../types/block'
import { getActiveBracket, resolveObligationDeadline } from '../types/obligation'
import {
  type CandidateTask,
  type DayManifold,
  type DomainCatalog,
  type ObserverState,
  type ValueModel,
  defaultValueModel,
} from './valueModel'
import { solveExactFitCandidates } from './exactFitSolver'

export function getDateStr(offsetDays: number, base?: string): string {
  const d = base ? new Date(base + 'T00:00:00') : new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay()
}

export function makeInstanceKey(source: string, sourceId: string, anchorId: string, taskId: string): string {
  return `${source}:${sourceId}:${anchorId}:${taskId}`
}

/**
 * Seam 1 + Patch 0002–0009: Pure day solver.
 * - Zero store access, zero localStorage access.
 * - Windowed Slab Weight Curves (`0` outside defined `[first, last]` window).
 * - Routine tasks act as customized slot bearers over Task templates between two Anchors (`[startAnchor, endAnchor]`).
 *   All routine tasks in a slot start with `earliestStart = slotAnchorFloor` (or `taskConfig.idealTime`)
 *   and compete / compress / chain inside `solveExactFitCandidates`, which then resolves
 *   `endAnchor.actualTime` at the tail end of the slot!
 */
export function solveDay<S = undefined>(
  manifold: DayManifold,
  catalog: DomainCatalog,
  observer: ObserverState,
  model: ValueModel<S> = defaultValueModel as unknown as ValueModel<S>,
  debug: boolean = false,
  initialStateOverride?: S
): DaySchedule & { finalState?: S } {
  const { dayIndex, dateStr, dayOfWeek, nowMinutes, overflowCutoff, lastDoneAt } = manifold
  const {
    confirmedAnchors,
    adhocTasks,
    skippedTaskIds,
    doneTasks,
    obligationDoneTasks,
    weightOffsets,
  } = observer

  const activeInitialState =
    initialStateOverride !== undefined ? initialStateOverride : model.initialState

  // Validate all blocks are cycle-free DAGs upfront
  for (const block of catalog.blocks) {
    const dagCheck = validateBlockDag(block.entries)
    if (!dagCheck.valid) {
      throw new Error(
        `Circular dependency detected in block "${block.name}": ${(dagCheck.cycle ?? []).join(' -> ')}`
      )
    }
  }

  // Find day plan (event override -> week plan)
  const event = catalog.calendarEvents.find((e) => {
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
    dayPlanId = catalog.weekPlan[dayOfWeek] ?? ''
  }

  const dayPlan = catalog.dayPlans.find((p) => p.id === dayPlanId)
  if (dayPlan) dayPlanName = dayPlan.name

  const dayConfirmations = confirmedAnchors.filter((c) => c.day === dayIndex)

  const templates = catalog.templates ?? []
  const dayTemplate = dayPlan?.templateId
    ? templates.find((t) => t.id === dayPlan.templateId)
    : templates[0]

  // Build initial anchor baselines (template ideal -> adjusted by manual confirmations)
  const resolvedAnchors: { anchorId: string; anchorName: string; idealTime: number; actualTime: number }[] = []
  if (dayTemplate) {
    const sorted = [...dayTemplate.entries].sort((a, b) => a.spikeTime - b.spikeTime)
    for (const entry of sorted) {
      const anchor = catalog.anchors.find((a) => a.id === entry.anchorId)
      const conf = dayConfirmations.find((c) => c.anchorId === entry.anchorId)
      resolvedAnchors.push({
        anchorId: entry.anchorId,
        anchorName: anchor?.name ?? '?',
        idealTime: entry.spikeTime,
        actualTime: Math.max(entry.spikeTime, conf?.actualTime ?? entry.spikeTime),
      })
    }
  }

  const completedTaskScopeKeys = new Set<string>()
  const dayAdhocs = adhocTasks.filter((a) => a.day === dayIndex)
  const candidates: CandidateTask[] = []

  // 1. Ad-hoc tasks
  for (const adhoc of dayAdhocs) {
    const iKey = makeInstanceKey('adhoc', adhoc.id, '', adhoc.id)
    const start = dayIndex === 0 ? Math.max(adhoc.startTime, nowMinutes) : adhoc.startTime
    candidates.push({
      instanceKey: iKey,
      taskId: adhoc.id,
      baseTitle: adhoc.title,
      baseDurationMinutes: adhoc.durationMinutes,
      minDurationMinutes: adhoc.durationMinutes,
      source: 'adhoc',
      sourceId: adhoc.id,
      sourceName: 'Adhoc',
      day: dayIndex,
      dateStr,
      isBackground: false,
      earliestStart: start,
      idealTime: adhoc.startTime,
      idealEndTime: adhoc.fixedEndTime,
      baseWeight: adhoc.weight,
      weightOffset: weightOffsets[iKey] ?? 0,
      eventWeightOffset: 0,
    })
  }

  // 2. Event-specific tasks
  if (event) {
    for (const tid of event.taskIds) {
      const task = catalog.tasks.find((t) => t.id === tid)
      if (!task || skippedTaskIds.includes(tid)) continue
      const iKey = makeInstanceKey('event', event.id, '', task.id)
      const baseDur = task.durationMinutes || 30
      candidates.push({
        instanceKey: iKey,
        taskId: task.id,
        baseTitle: task.title,
        baseDurationMinutes: baseDur,
        minDurationMinutes: task.minDurationMinutes ?? baseDur,
        source: 'event',
        sourceId: event.id,
        sourceName: event.name,
        day: dayIndex,
        dateStr,
        isBackground: false,
        earliestStart: 0,
        idealEndTime: task.knobs?.hasFixedEndTime ? task.fixedEndTime : undefined,
        baseWeight: (task.weight || 100) * 2,
        weightOffset: weightOffsets[iKey] ?? 0,
        eventWeightOffset: 0,
        durationCurve: task.knobs?.hasDurationCurve ? task.durationCurve : undefined,
        alterEgos: task.knobs?.hasAlterEgos ? task.alterEgos : undefined,
      })
    }
  }

  const allowRoutines = !suspendRegular || eventWeightOffset > 0

  // 3. Routine tasks (Slot Bearers between startAnchor and endAnchor)
  if (allowRoutines && dayPlan) {
    const activeRoutines = catalog.routines.filter(
      (r) => r.enabled && dayPlan.routineIds.includes(r.id)
    )

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

    for (const routine of activeRoutines) {
      interface RoutineCand {
        task: Task
        entry: Block['entries'][number]
        blockRequiresMap: Map<string, string[]>
        anchorId: string
        slotId?: string
        anchorTime: number
        anchorIdealTime: number
        initialWeight: number
        effectiveTitle: string
        effectiveDuration: number
        effectiveMinDur: number
        effectiveBaseWeight: number
        slotCurve?: CandidateTask['slotCurve']
      }

      const routineCands: RoutineCand[] = []

      for (const bc of routine.blockConfigs) {
        const block = catalog.blocks.find((b) => b.id === bc.blockId)
        if (!block) continue

        const matchedAnchor = resolvedAnchors.find((a) => a.anchorId === bc.anchorId)
        const fallbackAnchorTime = resolvedAnchors.length > 0 ? resolvedAnchors[0].actualTime : 360
        const anchorTime = matchedAnchor?.actualTime ?? fallbackAnchorTime
        const anchorIdealTime = matchedAnchor?.idealTime ?? anchorTime
        const templateEntry = dayTemplate?.entries.find((e) => e.anchorId === bc.anchorId)
        const slotId = templateEntry?.slotId

        // Build intra-block parent lookup for ancestor skip checks & topological ordering
        const blockTaskIdSet = new Set(block.entries.map((e) => e.taskId))
        const blockRequiresMap = new Map<string, string[]>()
        for (const e of block.entries) {
          const reqs = new Set<string>((e.requires ?? []).filter((id) => blockTaskIdSet.has(id)))
          const tObj = catalog.tasks.find((t) => t.id === e.taskId)
          if (tObj?.parentId && blockTaskIdSet.has(tObj.parentId)) reqs.add(tObj.parentId)
          blockRequiresMap.set(e.taskId, [...reqs])
        }
        for (const e of block.entries) {
          const tObj = catalog.tasks.find((t) => t.id === e.taskId)
          for (const link of tObj?.links ?? []) {
            if (blockRequiresMap.has(link.linkedTaskId)) {
              const cur = blockRequiresMap.get(link.linkedTaskId)!
              if (!cur.includes(e.taskId)) cur.push(e.taskId)
            }
          }
        }

        for (const entry of block.entries) {
          const routineInstanceKey = makeInstanceKey('routine', routine.id, bc.anchorId, entry.taskId)
          const routineDoneKey = `${routineInstanceKey}:${dateStr}`
          if (doneTasks.includes(routineDoneKey)) {
            completedTaskScopeKeys.add(`routine:${routine.id}:${entry.taskId}`)
            continue
          }

          if (skippedTaskIds.includes(entry.taskId)) continue

          const task = catalog.tasks.find((t) => t.id === entry.taskId)
          if (!task) continue

          // Ancestor skip check across DAG `requires` and `parentId`
          const visitedAnc = new Set<string>()
          const ancStack = [...(blockRequiresMap.get(task.id) ?? [])]
          let ancestorSkipped = false
          while (ancStack.length > 0) {
            const ancId = ancStack.pop()!
            if (visitedAnc.has(ancId)) continue
            visitedAnc.add(ancId)
            if (skippedTaskIds.includes(ancId)) {
              ancestorSkipped = true
              break
            }
            for (const p of blockRequiresMap.get(ancId) ?? []) {
              ancStack.push(p)
            }
          }
          if (ancestorSkipped) continue

          const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === task.id)

          // Patch 0009: Resolve customized task attributes over Task template defaults
          const effectiveTitle = taskConfig?.titleOverride?.trim()
            ? taskConfig.titleOverride.trim()
            : task.title
          const effectiveDuration =
            taskConfig?.durationMinutes !== undefined && taskConfig.durationMinutes > 0
              ? taskConfig.durationMinutes
              : (task.durationMinutes || 30)
          const effectiveMinDur =
            taskConfig?.minDurationMinutes !== undefined && taskConfig.minDurationMinutes > 0
              ? Math.min(effectiveDuration, taskConfig.minDurationMinutes)
              : task.minDurationMinutes !== undefined
              ? Math.min(effectiveDuration, task.minDurationMinutes)
              : task.knobs?.hasAlterEgos && task.alterEgos && task.alterEgos.length > 0
              ? Math.min(effectiveDuration, ...task.alterEgos.map((a) => a.durationMinutes))
              : task.knobs?.hasDurationCurve && task.durationCurve && task.durationCurve.length > 0
              ? Math.min(effectiveDuration, ...task.durationCurve.map((p) => p.value))
              : effectiveDuration

          const routineBaseWeight =
            routine.baseWeight !== undefined ? routine.baseWeight : (task.weight || 100)
          const relativeOffset = taskConfig?.relativeWeight ?? 0
          const effectiveBaseWeight = Math.max(0, routineBaseWeight + relativeOffset)

          // Collection-time expiry guard (measured from idealTime, NOT pushed actualTime!)
          if (taskConfig?.expiresAfterMinutes !== undefined) {
            const taskIdeal = taskConfig.idealTime ?? anchorIdealTime
            const expiryTime = taskIdeal + taskConfig.expiresAfterMinutes
            const taskEnd = taskIdeal + effectiveDuration
            const isCurrent = dayIndex === 0 && taskIdeal <= nowMinutes && nowMinutes < taskEnd
            if (dayIndex === 0 && nowMinutes >= expiryTime && !isCurrent) {
              continue
            }
          }

          let slotCurveDesc: CandidateTask['slotCurve']
          if (taskConfig?.slotWeights && Object.keys(taskConfig.slotWeights).length > 0) {
            const rawFallback = taskConfig.fallbackWeight ?? 0
            const fallback =
              rawFallback > 0 ? Math.max(0, rawFallback + relativeOffset) : rawFallback
            const rawPoints = slotId ? (taskConfig.slotWeights[slotId] ?? []) : []
            const points = rawPoints.map((pt) => ({
              offsetMinutes: pt.offsetMinutes,
              value: pt.value > 0 ? Math.max(0, pt.value + relativeOffset) : 0,
            }))
            slotCurveDesc = {
              points,
              anchorIdealTime,
              fallbackWeight: fallback,
              hasSlotConfig: true,
              matchedSlot: Boolean(slotId && points.length > 0),
            }
          }

          const probeCand: CandidateTask = {
            instanceKey: routineInstanceKey,
            taskId: task.id,
            baseTitle: effectiveTitle,
            baseDurationMinutes: effectiveDuration,
            minDurationMinutes: Math.max(1, effectiveMinDur),
            source: 'routine',
            sourceId: routine.id,
            sourceName: routine.name,
            day: dayIndex,
            dateStr,
            slotId,
            sequencerId: routine.sequencerId,
            isBackground: entry.isBackground,
            resetAnchorId: bc.anchorId,
            earliestStart: anchorTime,
            baseWeight: effectiveBaseWeight,
            weightOffset: weightOffsets[routineInstanceKey] ?? 0,
            eventWeightOffset,
            slotCurve: slotCurveDesc,
            taskWeightCurve: task.knobs.hasWeightCurve ? task.weightCurve : undefined,
          }

          const initialWeight = model.value(probeCand, anchorTime, activeInitialState)
          if (initialWeight <= 0 && !routine.sequencerId) continue

          routineCands.push({
            task,
            entry,
            blockRequiresMap,
            anchorId: bc.anchorId,
            slotId,
            anchorTime,
            anchorIdealTime,
            initialWeight,
            effectiveTitle,
            effectiveDuration,
            effectiveMinDur,
            effectiveBaseWeight,
            slotCurve: slotCurveDesc,
          })
        }
      }

      routineCands.sort((a, b) => {
        if (a.anchorTime !== b.anchorTime) return a.anchorTime - b.anchorTime
        return b.initialWeight - a.initialWeight
      })

      // Topological fixup on routineCands within the same anchor
      {
        let changed = true
        let passes = 0
        while (changed && passes < 100) {
          changed = false
          passes++
          for (let i = 0; i < routineCands.length; i++) {
            const reqs = routineCands[i].blockRequiresMap.get(routineCands[i].task.id) ?? []
            if (reqs.length === 0) continue
            let maxParentIdx = -1
            for (const pid of reqs) {
              const pIdx = routineCands.findIndex(
                (rc) => rc.anchorId === routineCands[i].anchorId && rc.task.id === pid
              )
              if (pIdx > maxParentIdx) maxParentIdx = pIdx
            }
            if (maxParentIdx > i) {
              const [child] = routineCands.splice(i, 1)
              routineCands.splice(maxParentIdx, 0, child)
              changed = true
              break
            }
          }
        }
      }

      const firstAnchorTime = routineCands[0]?.anchorTime ?? 0
      let cursor = Math.max(
        firstAnchorTime,
        dayIndex === 0 && lastDoneAt !== undefined ? lastDoneAt : 0,
        dayIndex === 0 ? nowMinutes : 0
      )
      let currentAnchorId = routineCands[0]?.anchorId ?? ''

      for (const rc of routineCands) {
        if (rc.anchorId !== currentAnchorId) {
          currentAnchorId = rc.anchorId
          const freshAnchor = resolvedAnchors.find((a) => a.anchorId === rc.anchorId)
          const freshTime = freshAnchor?.actualTime ?? rc.anchorTime
          cursor = Math.max(cursor, freshTime)
        }

        const taskConfig = routine.taskConfigs?.find((tc) => tc.taskId === rc.task.id)
        const taskIdealTime = taskConfig?.idealTime ?? rc.anchorIdealTime
        const slotAnchorFloor = Math.max(
          taskConfig?.idealTime ?? rc.anchorTime,
          dayIndex === 0 && lastDoneAt !== undefined ? lastDoneAt : 0,
          dayIndex === 0 ? nowMinutes : 0
        )

        // Advance pre-pass cursor ONLY for background tasks (so e.g. `Boil Water (bg)` starts after `Brush`)
        // or when no equal-weight sharing / expiry-rescue / DAG dependency is present in the slot:
        const hasDagRequires = (rc.blockRequiresMap.get(rc.task.id) ?? []).length > 0
        const hasBoundedEnd = Boolean(taskConfig?.idealEndTime ?? (rc.task.knobs?.hasFixedEndTime ? rc.task.fixedEndTime : undefined))
        const hasEqualWeightPeerInSlot = hasBoundedEnd && routineCands.some(
          (other) =>
            other !== rc &&
            other.anchorId === rc.anchorId &&
            !other.entry.isBackground &&
            other.initialWeight === rc.initialWeight
        )
        // Only reset slot tasks to slotAnchorFloor for 2-hop expiry-rescue lookahead when
        // sequential placement of foreground tasks in this slot would actually push an expiring peer past its expiryTime!
        let simCursor = rc.anchorTime
        let hasExpiringPeerInSlot = false
        for (const other of routineCands) {
          if (other.anchorId !== rc.anchorId || other.entry.isBackground) continue
          const otherTc = routine.taskConfigs?.find((tc) => tc.taskId === other.task.id)
          const otherIdeal = otherTc?.idealTime ?? other.anchorIdealTime
          if (otherTc?.expiresAfterMinutes !== undefined && simCursor >= otherIdeal + otherTc.expiresAfterMinutes) {
            hasExpiringPeerInSlot = true
            break
          }
          simCursor += other.effectiveDuration
        }

        const bgParentIds = rc.entry.isBackground ? (rc.blockRequiresMap.get(rc.task.id) ?? []) : []
        const bgParentCand = bgParentIds.length > 0
          ? candidates.find((c) => c.source === 'routine' && c.sourceId === routine.id && c.resetAnchorId === rc.anchorId && bgParentIds.includes(c.taskId))
          : undefined
        const idealStart =
          rc.entry.isBackground
            ? (bgParentCand ? bgParentCand.earliestStart + bgParentCand.baseDurationMinutes : Math.max(slotAnchorFloor, cursor))
            : (!hasEqualWeightPeerInSlot && !hasExpiringPeerInSlot && !routine.sequencerId)
              ? Math.max(slotAnchorFloor, cursor)
              : slotAnchorFloor

        if (taskConfig?.expiresAfterMinutes !== undefined) {
          const expiryTime = taskIdealTime + taskConfig.expiresAfterMinutes
          if (idealStart >= expiryTime) continue
        }

        const itemExpiryTime = taskConfig?.expiresAfterMinutes !== undefined
          ? taskIdealTime + taskConfig.expiresAfterMinutes
          : undefined
        const routineIKey = makeInstanceKey('routine', routine.id, rc.anchorId, rc.task.id)
        const itemIdealEndTime = taskConfig?.idealEndTime ?? (rc.task.knobs?.hasFixedEndTime ? rc.task.fixedEndTime : undefined)

        const candObj: CandidateTask = {
          instanceKey: routineIKey,
          taskId: rc.task.id,
          baseTitle: rc.effectiveTitle,
          baseDurationMinutes: rc.effectiveDuration,
          minDurationMinutes: Math.max(1, rc.effectiveMinDur),
          source: 'routine',
          sourceId: routine.id,
          sourceName: routine.name,
          day: dayIndex,
          dateStr,
          slotId: rc.slotId,
          sequencerId: routine.sequencerId,
          isBackground: rc.entry.isBackground,
          resetAnchorId: rc.anchorId,
          earliestStart: idealStart,
          idealTime: taskIdealTime,
          idealEndTime: itemIdealEndTime,
          expiryTime: itemExpiryTime,
          baseWeight: rc.effectiveBaseWeight,
          weightOffset: weightOffsets[routineIKey] ?? 0,
          eventWeightOffset,
          slotCurve: rc.slotCurve,
          taskWeightCurve: rc.task.knobs.hasWeightCurve ? rc.task.weightCurve : undefined,
          durationCurve: rc.task.knobs?.hasDurationCurve ? rc.task.durationCurve : undefined,
          selectedAlterEgoId: taskConfig?.selectedAlterEgoId,
          alterEgos: rc.task.knobs?.hasAlterEgos ? rc.task.alterEgos : undefined,
        }

        const variantAtIdeal = model.resolveVariant(candObj, idealStart, activeInitialState)
        if (!variantAtIdeal && !routine.sequencerId && !hasDagRequires) continue

        candidates.push(candObj)

        if (!rc.entry.isBackground && !routine.sequencerId && rc.initialWeight > 0 && variantAtIdeal) {
          cursor = idealStart + variantAtIdeal.durationMinutes
          const thisAnchorIdx = resolvedAnchors.findIndex((a) => a.anchorId === rc.anchorId)
          if (thisAnchorIdx >= 0) {
            for (let ai = thisAnchorIdx + 1; ai < resolvedAnchors.length; ai++) {
              if (cursor > resolvedAnchors[ai].actualTime) {
                resolvedAnchors[ai].actualTime = cursor
              }
            }
          }
        }
      }
    }
  }

  // 4. Obligations & Recovery (day 0)
  const wakeAnchor = resolvedAnchors.find((a) => a.anchorName === 'Wake')
  const wakeTime = wakeAnchor?.actualTime ?? 360
  const obStart = Math.max(
    wakeTime,
    lastDoneAt !== undefined ? lastDoneAt : 0,
    nowMinutes
  )

  if (dayIndex === 0 && allowRoutines) {
    for (const ob of catalog.obligations) {
      if (!ob.enabled) continue
      if (ob.deadline && ob.recurrence === 'one-time' && dateStr > ob.deadline) continue

      const resolvedDeadline = resolveObligationDeadline(ob, dateStr)
      const daysRemaining = resolvedDeadline
        ? Math.max(0, Math.ceil((new Date(resolvedDeadline).getTime() - new Date(dateStr).getTime()) / 86400000))
        : 999

      const obPeriodKey = resolvedDeadline
        ? (ob.recurrence !== 'one-time' ? resolvedDeadline : dateStr)
        : dateStr

      const bracket = getActiveBracket(ob.weightBrackets, daysRemaining)
      if (!bracket) continue

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

      const obPlacement = Math.max(obStart, windowStart)

      const orderedTaskIds: string[] = ob.tasks.map((t) => t.taskId)
      for (const blockId of (ob.blockIds ?? [])) {
        const block = catalog.blocks.find((b) => b.id === blockId)
        if (!block) continue
        for (const entry of [...block.entries].sort((a, b) => a.order - b.order)) {
          if (!orderedTaskIds.includes(entry.taskId)) {
            orderedTaskIds.push(entry.taskId)
          }
        }
      }

      const validTasks = orderedTaskIds.filter((tid) => {
        const obIKey = makeInstanceKey('obligation', ob.id, '', tid)
        const periodDoneKey = `${obIKey}:${obPeriodKey}`
        const dailyKey = `${obIKey}:${dateStr}`
        if (obligationDoneTasks.includes(periodDoneKey) || obligationDoneTasks.includes(dailyKey)) {
          completedTaskScopeKeys.add(`obligation:${ob.id}:${tid}`)
          return false
        }
        if (skippedTaskIds.includes(tid)) return false
        if (!catalog.tasks.find((t) => t.id === tid)) return false
        return true
      })

      for (let idx = 0; idx < validTasks.length; idx++) {
        const tid = validTasks[idx]
        const task = catalog.tasks.find((t) => t.id === tid)!
        const obIKey = makeInstanceKey('obligation', ob.id, '', task.id)
        const baseDur = task.durationMinutes || 30

        const candObj: CandidateTask = {
          instanceKey: obIKey,
          taskId: task.id,
          baseTitle: task.title,
          baseDurationMinutes: baseDur,
          minDurationMinutes: task.minDurationMinutes ?? baseDur,
          source: 'obligation',
          sourceId: ob.id,
          sourceName: ob.name,
          day: dayIndex,
          dateStr,
          isBackground: false,
          earliestStart: obPlacement,
          idealTime: obPlacement,
          idealEndTime: task.knobs?.hasFixedEndTime ? task.fixedEndTime : undefined,
          baseWeight: task.weight || 100,
          weightOffset: weightOffsets[obIKey] ?? 0,
          eventWeightOffset,
          obligationCurve: {
            points: bracket.timeCurve,
            orderBonus: idx + 1,
          },
          durationCurve: task.knobs?.hasDurationCurve ? task.durationCurve : undefined,
          alterEgos: task.knobs?.hasAlterEgos ? task.alterEgos : undefined,
        }

        if (model.value(candObj, obPlacement, activeInitialState) <= 0) continue
        candidates.push(candObj)
      }
    }

    // Recovery plans
    for (const plan of catalog.recoveryPlans) {
      if (!plan.triggered) continue

      let recWindowStart = 0
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

      const orderedTaskIds: string[] = [...plan.taskIds]
      for (const blockId of plan.blockIds) {
        const block = catalog.blocks.find((b) => b.id === blockId)
        if (!block) continue
        for (const entry of [...block.entries].sort((a, b) => a.order - b.order)) {
          if (!orderedTaskIds.includes(entry.taskId)) {
            orderedTaskIds.push(entry.taskId)
          }
        }
      }

      const validTasks = orderedTaskIds.filter((tid) => {
        const recIKey = makeInstanceKey('recovery', plan.id, '', tid)
        if (doneTasks.some((dk) => dk.startsWith(recIKey + ':'))) {
          completedTaskScopeKeys.add(`recovery:${plan.id}:${tid}`)
          return false
        }
        if (skippedTaskIds.includes(tid)) return false
        if (!catalog.tasks.find((t) => t.id === tid)) return false
        return true
      })

      const totalTasks = validTasks.length
      for (let idx = 0; idx < validTasks.length; idx++) {
        const tid = validTasks[idx]
        const task = catalog.tasks.find((t) => t.id === tid)!
        const recIKey = makeInstanceKey('recovery', plan.id, '', task.id)
        const baseDur = task.durationMinutes || 30

        const candObj: CandidateTask = {
          instanceKey: recIKey,
          taskId: task.id,
          baseTitle: `[R] ${task.title}`,
          baseDurationMinutes: baseDur,
          minDurationMinutes: task.minDurationMinutes ?? baseDur,
          source: 'recovery',
          sourceId: plan.id,
          sourceName: plan.name,
          day: dayIndex,
          dateStr,
          isBackground: false,
          earliestStart: recPlacement,
          idealTime: recPlacement,
          idealEndTime: task.knobs?.hasFixedEndTime ? task.fixedEndTime : undefined,
          baseWeight: task.weight || 100,
          weightOffset: weightOffsets[recIKey] ?? 0,
          eventWeightOffset: 0,
          recoveryCurve: {
            plan,
            dateStr,
            orderBonus: totalTasks - idx,
          },
          durationCurve: task.knobs?.hasDurationCurve ? task.durationCurve : undefined,
          alterEgos: task.knobs?.hasAlterEgos ? task.alterEgos : undefined,
        }

        if (model.value(candObj, recPlacement, activeInitialState) <= 0) continue
        candidates.push(candObj)
      }
    }
  }

  // 5. Convert Anchors into 0-duration DAG Milestone Candidates (`isAnchor: true`)
  const sortedAnchorIds = resolvedAnchors
    .sort((a, b) => a.idealTime - b.idealTime)
    .map((a) => a.anchorId)

  for (let ai = 0; ai < resolvedAnchors.length; ai++) {
    const ra = resolvedAnchors[ai]
    const anchorInstanceKey = makeInstanceKey('anchor', ra.anchorId, ra.anchorId, ra.anchorId)
    const requiresKeys: string[] = []

    if (ai > 0) {
      const prevAnchor = resolvedAnchors[ai - 1]
      requiresKeys.push(makeInstanceKey('anchor', prevAnchor.anchorId, prevAnchor.anchorId, prevAnchor.anchorId))
    }

    for (const cand of candidates) {
      if (cand.source !== 'routine' || !cand.resetAnchorId) continue
      const candAnchorIdx = sortedAnchorIds.indexOf(cand.resetAnchorId)
      if (candAnchorIdx >= 0 && candAnchorIdx < ai) {
        requiresKeys.push(cand.instanceKey)
      }
    }

    candidates.push({
      instanceKey: anchorInstanceKey,
      taskId: ra.anchorId,
      baseTitle: ra.anchorName,
      baseDurationMinutes: 0,
      minDurationMinutes: 0,
      source: 'anchor',
      sourceId: ra.anchorId,
      sourceName: 'Anchor',
      day: dayIndex,
      dateStr,
      isBackground: false,
      isAnchor: true,
      requiresInstanceKeys: requiresKeys,
      earliestStart: Math.max(ra.idealTime, ra.actualTime),
      idealTime: ra.idealTime,
      baseWeight: 1,
      weightOffset: 0,
      eventWeightOffset: 0,
    })
  }

  const activeBlockIds = new Set<string>()
  if (dayPlan) {
    for (const rId of dayPlan.routineIds) {
      const r = catalog.routines.find((rt) => rt.id === rId)
      if (r && r.enabled) {
        for (const bc of r.blockConfigs) activeBlockIds.add(bc.blockId)
      }
    }
  }
  const activeBlocks = activeBlockIds.size > 0
    ? catalog.blocks.filter((b) => activeBlockIds.has(b.id))
    : catalog.blocks

  // Patch 0005: Run Exact-Fit Iterative & Lookahead Solver
  const { placed, overflow, resolvedAnchorTimes, diagnostics, finalState } = placeCandidates(
    candidates,
    catalog.tasks,
    activeBlocks,
    overflowCutoff,
    nowMinutes,
    model,
    completedTaskScopeKeys,
    debug,
    activeInitialState
  )

  for (const ra of resolvedAnchors) {
    const anchorKey = makeInstanceKey('anchor', ra.anchorId, ra.anchorId, ra.anchorId)
    const dagTime = resolvedAnchorTimes.get(anchorKey)
    if (dagTime !== undefined) {
      ra.actualTime = Math.max(ra.idealTime, dagTime)
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
    diagnostics,
    finalState,
  }
}

export function placeCandidates<S = undefined>(
  candidates: CandidateTask[],
  tasks: Task[],
  blocks: Block[],
  cutoff: number,
  nowMinutes: number,
  model: ValueModel<S>,
  completedTaskScopeKeys: Set<string> = new Set(),
  debug: boolean = false,
  initialStateOverride?: S
): {
  placed: ScheduledItem[]
  overflow: ScheduledItem[]
  resolvedAnchorTimes: Map<string, number>
  diagnostics: ScheduleDiagnostic[]
  finalState: S
} {
  return solveExactFitCandidates(
    candidates,
    tasks,
    blocks,
    cutoff,
    nowMinutes,
    model,
    completedTaskScopeKeys,
    debug,
    initialStateOverride
  )
}
