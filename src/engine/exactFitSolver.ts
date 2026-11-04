import type { ScheduledItem, ScheduleDiagnostic } from '../types/scheduler'
import type { Task } from '../types/task'
import { type Block, validateBlockDag } from '../types/block'
import { type CandidateTask, type ValueModel } from './valueModel'

function fmtTime(mins: number): string {
  const m = Math.round(mins)
  const hh = Math.floor((m % 1440) / 60)
  const mm = (m % 1440) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function analyzeCandidateSlab<S>(
  cand: CandidateTask,
  cutoff: number,
  model: ValueModel<S>,
  state: S
): {
  windowStart: number
  windowEnd: number
  peakTime: number
  peakWeight: number
} {
  let lo = Math.max(0, cand.earliestStart)
  let hi = Math.min(
    cutoff,
    cand.expiryTime !== undefined ? cand.expiryTime : cutoff,
    cand.idealEndTime !== undefined ? cand.idealEndTime : cutoff
  )

  if (cand.source === 'routine' && cand.slotCurve?.matchedSlot && cand.slotCurve.points.length >= 2) {
    const pts = [...cand.slotCurve.points].sort((a, b) => a.offsetMinutes - b.offsetMinutes)
    lo = Math.max(lo, cand.slotCurve.anchorIdealTime + pts[0].offsetMinutes)
    hi = Math.min(hi, cand.slotCurve.anchorIdealTime + pts[pts.length - 1].offsetMinutes)
  } else if (cand.taskWeightCurve && cand.taskWeightCurve.length >= 2) {
    const pts = [...cand.taskWeightCurve].sort((a, b) => a.time - b.time)
    lo = Math.max(lo, pts[0].time)
    hi = Math.min(hi, pts[pts.length - 1].time)
  } else if (cand.obligationCurve && cand.obligationCurve.points.length >= 2) {
    const pts = [...cand.obligationCurve.points].sort((a, b) => a.time - b.time)
    lo = Math.max(lo, pts[0].time)
    hi = Math.min(hi, pts[pts.length - 1].time)
  }

  let peakTime = lo
  let peakWeight = 0
  let firstActive = -1
  let lastActive = -1

  for (let t = lo; t <= hi; t++) {
    const w = model.value(cand, t, state)
    if (w > 0) {
      if (firstActive === -1) firstActive = t
      lastActive = t
      if (w > peakWeight) {
        peakWeight = w
        peakTime = t
      }
    }
  }

  if (firstActive === -1) {
    return { windowStart: lo, windowEnd: lo, peakTime: lo, peakWeight: 0 }
  }

  return {
    windowStart: firstActive,
    windowEnd: Math.max(firstActive + cand.minDurationMinutes, lastActive + 1),
    peakTime,
    peakWeight,
  }
}

/**
 * Patch 0005: Exact-Fit Iterative & Pareto Bitmask DP Solver.
 */
export function solveExactFitCandidates<S = undefined>(
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
  let state = initialStateOverride !== undefined ? initialStateOverride : model.initialState
  const diagnostics: ScheduleDiagnostic[] = []

  const toScheduledItem = (
    cand: CandidateTask,
    start: number,
    duration: number,
    title: string,
    weight: number,
    shrunkFromMinutes?: number
  ): ScheduledItem => ({
    taskId: cand.taskId,
    instanceKey: cand.instanceKey,
    title,
    startMinutes: start,
    endMinutes: start + duration,
    isBackground: cand.isBackground,
    source: cand.source as ScheduledItem['source'],
    weight,
    day: cand.day,
    sourceId: cand.sourceId,
    sourceName: cand.sourceName,
    resetAnchorId: cand.resetAnchorId,
    idealTime: cand.idealTime,
    idealEndTime: cand.idealEndTime,
    expiryTime: cand.expiryTime,
    ...(shrunkFromMinutes !== undefined && shrunkFromMinutes > duration
      ? { shrunkFromMinutes }
      : {}),
  })

  const anchorCands = candidates.filter((c) => c.isAnchor)
  const backgroundCands = candidates.filter((c) => !c.isAnchor && c.isBackground)
  const active = candidates.filter((c) => !c.isAnchor && !c.isBackground)
  const anchorOrderList = anchorCands.map((a) => a.taskId)
  const getAnchorRank = (c: CandidateTask): number => {
    if (c.source === 'routine' && c.resetAnchorId) {
      const idx = anchorOrderList.indexOf(c.resetAnchorId)
      if (idx >= 0) return idx
    }
    return -1
  }

  const taskBlockMap = new Map<string, string>()
  const parentsMap = new Map<string, Set<string>>()
  const dropIfParentMissedSet = new Set<string>()
  const dropParentIfMissedEdges = new Map<string, Set<string>>()

  const addParentEdge = (childId: string, parentId: string) => {
    if (!parentsMap.has(childId)) parentsMap.set(childId, new Set())
    parentsMap.get(childId)!.add(parentId)
  }

  const addRollbackEdge = (childId: string, parentId: string) => {
    if (!dropParentIfMissedEdges.has(childId)) dropParentIfMissedEdges.set(childId, new Set())
    dropParentIfMissedEdges.get(childId)!.add(parentId)
  }

  for (const block of blocks) {
    const dagRes = validateBlockDag(block.entries)
    if (!dagRes.valid) {
      throw new Error(
        `Circular dependency detected in block "${block.name}": ${(dagRes.cycle ?? []).join(' -> ')}`
      )
    }

    const blockTaskIds = new Set(block.entries.map((e) => e.taskId))
    for (const entry of block.entries) {
      taskBlockMap.set(entry.taskId, block.id)

      if (entry.requires && entry.requires.length > 0) {
        for (const reqId of entry.requires) {
          if (blockTaskIds.has(reqId)) {
            addParentEdge(entry.taskId, reqId)
            if (entry.dropParentIfMissed) {
              addRollbackEdge(entry.taskId, reqId)
            }
          }
        }
      }
      if (entry.dropIfParentMissed) {
        dropIfParentMissedSet.add(entry.taskId)
      }
    }
  }

  for (const t of tasks) {
    if (t.parentId) {
      const childBlock = taskBlockMap.get(t.id)
      const parentBlock = taskBlockMap.get(t.parentId)
      if (childBlock && childBlock === parentBlock) {
        addParentEdge(t.id, t.parentId)
      }
    }
    if (t.links) {
      for (const link of t.links) {
        const motherBlock = taskBlockMap.get(t.id)
        const childBlock = taskBlockMap.get(link.linkedTaskId)
        if (motherBlock && motherBlock === childBlock) {
          addParentEdge(link.linkedTaskId, t.id)
          const rule = link.continuity ?? 'resumable'
          if (rule === 'resumable') {
            addRollbackEdge(link.linkedTaskId, t.id)
          }
        }
      }
    }
  }

  const getTransitiveAncestors = (taskId: string): Set<string> => {
    const ancestors = new Set<string>()
    const stack = [...(parentsMap.get(taskId) ?? [])]
    while (stack.length > 0) {
      const pid = stack.pop()!
      if (ancestors.has(pid)) continue
      ancestors.add(pid)
      for (const grandParent of parentsMap.get(pid) ?? []) {
        stack.push(grandParent)
      }
    }
    return ancestors
  }

  const applyTopologicalOrder = (list: CandidateTask[]) => {
    if (parentsMap.size === 0) return
    let changed = true
    let passes = 0
    while (changed && passes < 100) {
      changed = false
      passes++
      for (let i = 0; i < list.length; i++) {
        const ancestorIds = getTransitiveAncestors(list[i].taskId)
        if (ancestorIds.size === 0) continue

        let maxParentIdx = -1
        for (const pid of ancestorIds) {
          const pIdx = list.findIndex(
            (a) =>
              a.taskId === pid &&
              a.source === list[i].source &&
              a.sourceId === list[i].sourceId &&
              a.resetAnchorId === list[i].resetAnchorId
          )
          if (pIdx > maxParentIdx) maxParentIdx = pIdx
        }

        if (maxParentIdx > i) {
          const [child] = list.splice(i, 1)
          list.splice(maxParentIdx, 0, child)
          changed = true
          break
        }
      }
    }
  }

  const occupied: { start: number; end: number; instanceKey: string; weight: number }[] = []
  const placed: ScheduledItem[] = backgroundCands.map((bg) => {
    const v = model.resolveVariant(bg, bg.earliestStart, state) ?? {
      title: bg.baseTitle,
      durationMinutes: bg.baseDurationMinutes,
    }
    const w = model.value(bg, bg.earliestStart, state)
    return toScheduledItem(bg, bg.earliestStart, v.durationMinutes, v.title, w)
  })

  const syncBackgroundParents = () => {
    if (parentsMap.size === 0) return
    for (const bg of placed.filter((p) => p.isBackground)) {
      const parentIds = parentsMap.get(bg.taskId)
      if (!parentIds || parentIds.size === 0) continue
      let maxParentEnd = bg.startMinutes
      for (const pid of parentIds) {
        const pItem = placed.find(
          (p) => p.taskId === pid && p.source === bg.source && p.sourceId === bg.sourceId
        )
        if (pItem && pItem.endMinutes > maxParentEnd) {
          maxParentEnd = pItem.endMinutes
        }
      }
      if (maxParentEnd > bg.startMinutes) {
        const dur = bg.endMinutes - bg.startMinutes
        bg.startMinutes = maxParentEnd
        bg.endMinutes = maxParentEnd + dur
      }
    }
  }

  const overflow: ScheduledItem[] = []
  const placedTaskIds = new Set<string>(placed.map((p) => p.taskId))
  const hasSequencerCandidates = active.some((c) => Boolean(c.sequencerId))
  let causalHorizon = 0

  const getEarliestValidStart = (cand: CandidateTask): {
    start: number
    missingRequiredParent: boolean
  } => {
    let start = cand.sequencerId ? Math.max(cand.earliestStart, causalHorizon) : cand.earliestStart
    const requiredParents = parentsMap.get(cand.taskId)
    let missingRequiredParent = false
    if (requiredParents && requiredParents.size > 0) {
      for (const pid of requiredParents) {
        const parentItem = placed.find(
          (p) => p.taskId === pid && p.source === cand.source && p.sourceId === cand.sourceId
        )
        if (parentItem) {
          if (start < parentItem.endMinutes) {
            start = parentItem.endMinutes
          }
        } else {
          const scopeKey = `${cand.source}:${cand.sourceId ?? ''}:${pid}`
          if (!completedTaskScopeKeys.has(scopeKey)) {
            missingRequiredParent = true
          }
        }
      }
    }
    if (cand.requiresInstanceKeys && cand.requiresInstanceKeys.length > 0) {
      for (const reqKey of cand.requiresInstanceKeys) {
        const reqItem = placed.find((p) => p.instanceKey === reqKey)
        if (reqItem && start < reqItem.endMinutes) {
          start = reqItem.endMinutes
        }
      }
    }
    return { start, missingRequiredParent }
  }

  const getHardEndWall = (cand: CandidateTask): number => {
    let wall = cutoff
    if (cand.idealEndTime !== undefined) wall = Math.min(wall, cand.idealEndTime)
    return wall
  }

  const remaining = [...active]

  while (remaining.length > 0) {
    syncBackgroundParents()

    const getFreeStartFrom = (fromTime: number): number => {
      let t = fromTime
      while (t < cutoff) {
        let ov: { start: number; end: number } | null = null
        for (const o of occupied) {
          if (t >= o.start && t < o.end) {
            if (!ov || o.end > ov.end) ov = o
          }
        }
        if (!ov) break
        t = Math.max(t + 1, ov.end)
      }
      return t
    }

    remaining.sort((a, b) => {
      const sa = getFreeStartFrom(getEarliestValidStart(a).start)
      const sb = getFreeStartFrom(getEarliestValidStart(b).start)
      const wa = model.value(a, sa, state)
      const wb = model.value(b, sb, state)

      // When a RoutineSequencer is present, strictly evaluate slots in chronological order (`earliestStart` ascending)
      // BEFORE checking `aActive !== bActive`, so dormant candidates in the Morning slot are evaluated (and discarded)
      // before Evening candidates transition `state`!
      if (hasSequencerCandidates && a.earliestStart !== b.earliestStart) {
        return a.earliestStart - b.earliestStart
      }

      const aActive = wa > 0 ? 1 : 0
      const bActive = wb > 0 ? 1 : 0
      if (aActive !== bActive) return bActive - aActive

      const rankA = getAnchorRank(a)
      const rankB = getAnchorRank(b)
      if (rankA >= 0 && rankB >= 0 && rankA !== rankB) {
        return rankA - rankB
      }
      if (rankA > 0 && rankB === -1 && sb < sa) return 1
      if (rankB > 0 && rankA === -1 && sa < sb) return -1

      // Check 2-Hop Lookahead (Expiry-Rescue + Rising-Gradient Climb)
      if (wa > 0 && wb > 0 && wa !== wb) {
        const leader = wa > wb ? a : b
        const follower = wa > wb ? b : a
        const sLeader = wa > wb ? sa : sb
        const sFollower = wa > wb ? sb : sa
        const vLeader = model.resolveVariant(leader, sLeader, state)
        const vFollower = model.resolveVariant(follower, sFollower, state)

        if (
          vLeader &&
          vFollower &&
          Math.abs(sLeader - sFollower) < vLeader.durationMinutes
        ) {
          const tStart = Math.min(sLeader, sFollower)
          const leaderEndIfFirst = tStart + vLeader.durationMinutes
          const followerDiedIfSecond = follower.expiryTime !== undefined && leaderEndIfFirst >= follower.expiryTime

          const followerEndIfFirst = tStart + vFollower.durationMinutes
          const leaderAliveIfSecond =
            (leader.expiryTime === undefined || followerEndIfFirst < leader.expiryTime) &&
            (leader.idealEndTime === undefined ||
              followerEndIfFirst + leader.minDurationMinutes <= leader.idealEndTime) &&
            followerEndIfFirst + leader.minDurationMinutes <= cutoff &&
            model.value(leader, followerEndIfFirst, state) > 0

          if (followerDiedIfSecond && leaderAliveIfSecond && Math.abs(wa - wb) <= 50) {
            const combinedScore =
              model.value(follower, tStart, state) +
              model.value(leader, followerEndIfFirst, state)
            const soloScore = model.value(leader, tStart, state)
            if (combinedScore > soloScore) {
              return leader === a ? 1 : -1
            }
          }

          // Rising-Gradient Climb: if leader is on an upward slope (W_leader(followerEndIfFirst) > W_leader(tStart))
          // so running follower first yields a strictly higher 2-hop total value, promote follower first!
          const wLeaderNow = model.value(leader, tStart, state)
          const wLeaderAfterFollower = model.value(leader, followerEndIfFirst, state)
          if (leaderAliveIfSecond && wLeaderAfterFollower > wLeaderNow) {
            const scoreFollowerFirst = model.value(follower, tStart, state) + wLeaderAfterFollower
            const scoreLeaderFirst = wLeaderNow + model.value(follower, leaderEndIfFirst, state)
            if (scoreFollowerFirst > scoreLeaderFirst) {
              return leader === a ? 1 : -1
            }
          }
        }
      }

      if (wb !== wa) return wb - wa
      return sa - sb
    })
    applyTopologicalOrder(remaining)

    const cand = remaining.shift()!
    const { start: rawStart, missingRequiredParent } = getEarliestValidStart(cand)

    const requiresParentPresence =
      dropIfParentMissedSet.has(cand.taskId) || dropParentIfMissedEdges.has(cand.taskId)
    if (missingRequiredParent && requiresParentPresence) {
      if (debug) {
        console.log(`  ⏭ DAG DROP (parent missed): ${cand.baseTitle}`)
      }
      continue
    }

    // Advance rawStart past any already-occupied intervals to find actual free start
    let freeStart = rawStart
    while (freeStart < cutoff) {
      let ov: { start: number; end: number } | null = null
      for (const o of occupied) {
        if (freeStart >= o.start && freeStart < o.end) {
          if (!ov || o.end > ov.end) ov = o
        }
      }
      if (!ov) break
      freeStart = Math.max(freeStart + 1, ov.end)
    }

    // Check for Equal-Priority Sharing (`W_A === W_B`) at the same free start window!
    const candWeightAtStart = model.value(cand, freeStart, state)
    const candVariantAtStart = model.resolveVariant(cand, freeStart, state)

    if (candWeightAtStart > 0 && candVariantAtStart && remaining.length > 0) {
      const peerIdx = remaining.findIndex((peer) => {
        let peerFree = getEarliestValidStart(peer).start
        while (peerFree < cutoff) {
          let ov: { start: number; end: number } | null = null
          for (const o of occupied) {
            if (peerFree >= o.start && peerFree < o.end) {
              if (!ov || o.end > ov.end) ov = o
            }
          }
          if (!ov) break
          peerFree = Math.max(peerFree + 1, ov.end)
        }
        if (peerFree !== freeStart) return false
        const peerW = model.value(peer, peerFree, state)
        return peerW === candWeightAtStart
      })

      if (peerIdx >= 0) {
        const peer = remaining[peerIdx]
        const peerVar = model.resolveVariant(peer, freeStart, state)
        if (peerVar) {
          let sharedCeiling = Math.min(getHardEndWall(cand), getHardEndWall(peer))
          for (const o of occupied) {
            if (o.start > freeStart && o.start < sharedCeiling) {
              sharedCeiling = o.start
            }
          }
          const availableWindow = sharedCeiling - freeStart
          const totalIdeal = candVariantAtStart.durationMinutes + peerVar.durationMinutes
          const totalMin = cand.minDurationMinutes + peer.minDurationMinutes

          if (availableWindow < totalIdeal) {
            if (availableWindow >= totalMin) {
              remaining.splice(peerIdx, 1)
              const slackA = Math.max(0, candVariantAtStart.durationMinutes - cand.minDurationMinutes)
              const slackB = Math.max(0, peerVar.durationMinutes - peer.minDurationMinutes)
              const totalSlack = slackA + slackB
              const extraRoom = availableWindow - totalMin

              const durA =
                totalSlack > 0
                  ? cand.minDurationMinutes + Math.round((extraRoom * slackA) / totalSlack)
                  : cand.minDurationMinutes
              const durB = availableWindow - durA

              const itemA = toScheduledItem(
                cand,
                freeStart,
                durA,
                candVariantAtStart.title,
                candWeightAtStart,
                candVariantAtStart.durationMinutes
              )
              const itemB = toScheduledItem(
                peer,
                freeStart + durA,
                durB,
                peerVar.title,
                candWeightAtStart,
                peerVar.durationMinutes
              )

              occupied.push({
                start: itemA.startMinutes,
                end: itemA.endMinutes,
                instanceKey: itemA.instanceKey,
                weight: candWeightAtStart,
              })
              occupied.push({
                start: itemB.startMinutes,
                end: itemB.endMinutes,
                instanceKey: itemB.instanceKey,
                weight: candWeightAtStart,
              })
              placed.push(itemA, itemB)
              placedTaskIds.add(itemA.taskId)
              placedTaskIds.add(itemB.taskId)
              state = model.transition(state, cand, itemA.startMinutes, itemA.endMinutes)
              state = model.transition(state, peer, itemB.startMinutes, itemB.endMinutes)

              diagnostics.push({
                kind: 'EQUAL_PRIORITY_SHARED',
                taskIds: [cand.taskId, peer.taskId],
                instanceKeys: [cand.instanceKey, peer.instanceKey],
                windowStart: freeStart,
                windowEnd: sharedCeiling,
                message: `"${candVariantAtStart.title}" (${candVariantAtStart.durationMinutes}m → ${durA}m) and "${peerVar.title}" (${peerVar.durationMinutes}m → ${durB}m) have equal weight (${candWeightAtStart}) and shared the ${availableWindow}m window (${fmtTime(freeStart)}–${fmtTime(sharedCeiling)}).`,
                suggestion: `Increase the weight of "${candVariantAtStart.title}" or "${peerVar.title}" if one should take full duration priority.`,
              })
              continue
            } else {
              diagnostics.push({
                kind: 'WEIGHT_TIE_AMBIGUITY',
                taskIds: [cand.taskId, peer.taskId],
                instanceKeys: [cand.instanceKey, peer.instanceKey],
                windowStart: freeStart,
                windowEnd: sharedCeiling,
                message: `Weight tie (${candWeightAtStart}) between "${candVariantAtStart.title}" (min ${cand.minDurationMinutes}m) and "${peerVar.title}" (min ${peer.minDurationMinutes}m) inside a ${availableWindow}m window (${fmtTime(freeStart)}–${fmtTime(sharedCeiling)}). Both cannot fit (${totalMin}m min required).`,
                suggestion: `Adjust the weight of "${candVariantAtStart.title}" or "${peerVar.title}" to specify which task should win this slot.`,
              })
            }
          }
        }
      }
    }

    // Iterative Exact-Fit Placement with Intruder Lookahead Compression
    let cursor = rawStart
    let found = false

    while (cursor < cutoff) {
      let overlappingAtCursor: { start: number; end: number; instanceKey: string } | null = null
      for (const o of occupied) {
        if (cursor >= o.start && cursor < o.end) {
          if (!overlappingAtCursor || o.end > overlappingAtCursor.end) {
            overlappingAtCursor = o
          }
        }
      }
      if (overlappingAtCursor) {
        cursor = Math.max(cursor + 1, overlappingAtCursor.end)
        continue
      }

      const variantAtCursor = model.resolveVariant(cand, cursor, state)
      if (!variantAtCursor) break

      let duration = variantAtCursor.durationMinutes
      const idealDurAtCursor = duration
      if (cursor + cand.minDurationMinutes > cutoff) break

      const isCurrentAtCursor = cursor <= nowMinutes && nowMinutes < cursor + duration
      if (cand.expiryTime !== undefined && cursor >= cand.expiryTime && !isCurrentAtCursor) break
      if (cand.idealEndTime !== undefined && cursor + cand.minDurationMinutes > cand.idealEndTime) break

      if (cursor + duration > cutoff) {
        duration = cutoff - cursor
      }
      if (cand.idealEndTime !== undefined && cursor + duration > cand.idealEndTime) {
        duration = cand.idealEndTime - cursor
      }

      const weightAtCursor = model.value(cand, cursor, state)
      if (weightAtCursor <= 0) {
        if (cand.sequencerId) break
        const slab = analyzeCandidateSlab(cand, cutoff, model, state)
        if (slab.peakWeight > 0 && slab.windowStart > cursor) {
          cursor = slab.windowStart
          continue
        }
        break
      }

      let earliestIntruderStart = Infinity
      let intruderKey = ''

      for (const o of occupied) {
        if (o.start > cursor && o.start < cursor + duration) {
          if (o.start < earliestIntruderStart) {
            earliestIntruderStart = o.start
            intruderKey = o.instanceKey
          }
        }
      }

      for (const other of remaining) {
        const otherStart = getEarliestValidStart(other).start
        if (otherStart > cursor && otherStart < cursor + duration) {
          const otherW = model.value(other, otherStart, state)
          if ((otherW > weightAtCursor || (cursor > rawStart && otherW >= weightAtCursor && other.resetAnchorId !== cand.resetAnchorId)) && otherStart < earliestIntruderStart) {
            earliestIntruderStart = otherStart
            intruderKey = other.instanceKey
          }
        }
      }

      if (earliestIntruderStart < cursor + duration) {
        const availableBeforeIntruder = earliestIntruderStart - cursor
        if (availableBeforeIntruder >= cand.minDurationMinutes) {
          duration = availableBeforeIntruder
          diagnostics.push({
            kind: 'INTRUDER_SHRUNK',
            taskIds: [cand.taskId],
            instanceKeys: [cand.instanceKey, intruderKey].filter(Boolean),
            windowStart: cursor,
            windowEnd: earliestIntruderStart,
            message: `"${variantAtCursor.title}" shrunk from ${idealDurAtCursor}m to ${duration}m (${fmtTime(cursor)}–${fmtTime(earliestIntruderStart)}) so higher-priority task at ${fmtTime(earliestIntruderStart)} can start on time.`,
            suggestion: `Increase "${variantAtCursor.title}" weight above the intruding task if it should not compress.`,
          })
        } else {
          const blockingOcc = occupied.find((o) => o.start === earliestIntruderStart)
          if (blockingOcc) {
            cursor = Math.max(cursor + 1, blockingOcc.end)
          } else {
            cursor = earliestIntruderStart + 1
          }
          continue
        }
      }

      if (duration < cand.minDurationMinutes) {
        break
      }

      const item = toScheduledItem(
        cand,
        cursor,
        duration,
        variantAtCursor.title,
        weightAtCursor,
        idealDurAtCursor
      )
      occupied.push({
        start: cursor,
        end: item.endMinutes,
        instanceKey: item.instanceKey,
        weight: weightAtCursor,
      })
      placed.push(item)
      placedTaskIds.add(item.taskId)
      if (cand.sequencerId) {
        causalHorizon = Math.max(causalHorizon, item.endMinutes)
      }
      state = model.transition(state, cand, cursor, item.endMinutes)
      found = true
      break
    }

    if (!found) {
      const vFallback = model.resolveVariant(cand, rawStart, state) ?? {
        title: cand.baseTitle,
        durationMinutes: cand.baseDurationMinutes,
      }
      const wFallback = model.value(cand, rawStart, state)
      if (wFallback > 0) {
        overflow.push(
          toScheduledItem(cand, rawStart, vFallback.durationMinutes, vFallback.title, wFallback)
        )
        diagnostics.push({
          kind: 'STARVED_BY_HIGHER',
          taskIds: [cand.taskId],
          instanceKeys: [cand.instanceKey],
          windowStart: freeStart,
          windowEnd: cand.expiryTime ?? cand.idealEndTime ?? cutoff,
          message: `"${vFallback.title}" (weight ${wFallback}, min ${cand.minDurationMinutes}m) could not fit inside its valid window (${fmtTime(freeStart)}–${fmtTime(cand.expiryTime ?? cand.idealEndTime ?? cutoff)}).`,
          suggestion: `Increase "${vFallback.title}" weight or lower minDurationMinutes (${cand.minDurationMinutes}m) so it can compress into available gaps.`,
        })
      }
    }
  }

  syncBackgroundParents()

  // Post-check: routine items pushed past their expiry -> purge
  const expiredInstanceKeys = new Set<string>()
  for (const item of placed) {
    if (item.source !== 'routine') continue
    const isCurrentItem = item.startMinutes <= nowMinutes && nowMinutes < item.endMinutes
    if (item.expiryTime !== undefined && item.startMinutes >= item.expiryTime && !isCurrentItem) {
      expiredInstanceKeys.add(item.instanceKey)
    }
  }
  for (const iKey of expiredInstanceKeys) {
    const idx = placed.findIndex((p) => p.instanceKey === iKey)
    if (idx >= 0) {
      const item = placed[idx]
      placed.splice(idx, 1)
      const occIdx = occupied.findIndex((o) => o.instanceKey === iKey)
      if (occIdx >= 0) occupied.splice(occIdx, 1)
      placedTaskIds.delete(item.taskId)
    }
  }

  // Post-check 1 & 2: Bidirectional & Forward Contingency Cascade
  if (dropIfParentMissedSet.size > 0 || dropParentIfMissedEdges.size > 0) {
    let cascadeChanged = true
    while (cascadeChanged) {
      cascadeChanged = false

      for (const [childId, parentIds] of dropParentIfMissedEdges) {
        const wasCandidate = active.some(
          (a) => a.taskId === childId && model.value(a, a.earliestStart, state) > 0
        )
        const isChildPlaced = placed.some((p) => p.taskId === childId)
        if (wasCandidate && !isChildPlaced) {
          for (const pid of parentIds) {
            const pIdx = placed.findIndex((p) => p.taskId === pid)
            if (pIdx >= 0) {
              const removed = placed[pIdx]
              placed.splice(pIdx, 1)
              const occIdx = occupied.findIndex((o) => o.instanceKey === removed.instanceKey)
              if (occIdx >= 0) occupied.splice(occIdx, 1)
              placedTaskIds.delete(removed.taskId)
              cascadeChanged = true
            }
          }
        }
      }

      for (let i = placed.length - 1; i >= 0; i--) {
        const item = placed[i]
        const isContingent =
          dropIfParentMissedSet.has(item.taskId) || dropParentIfMissedEdges.has(item.taskId)
        if (!isContingent) continue
        const reqParents = parentsMap.get(item.taskId)
        if (!reqParents) continue
        for (const pid of reqParents) {
          const hasPlacedParent = placed.some(
            (p) => p.taskId === pid && p.source === item.source && p.sourceId === item.sourceId
          )
          const scopeKey = `${item.source}:${item.sourceId ?? ''}:${pid}`
          if (!hasPlacedParent && !completedTaskScopeKeys.has(scopeKey)) {
            placed.splice(i, 1)
            const occIdx = occupied.findIndex((o) => o.instanceKey === item.instanceKey)
            if (occIdx >= 0) occupied.splice(occIdx, 1)
            placedTaskIds.delete(item.taskId)
            cascadeChanged = true
            break
          }
        }
      }
    }
  }

  // Tail-End Slot Anchor Resolution
  const resolvedAnchorTimes = new Map<string, number>()
  for (const anchorCand of anchorCands) {
    let anchorStart = anchorCand.earliestStart
    for (const reqKey of anchorCand.requiresInstanceKeys ?? []) {
      const placedDep = placed.find((p) => p.instanceKey === reqKey)
      if (placedDep && !placedDep.isBackground && placedDep.endMinutes > anchorStart) {
        anchorStart = placedDep.endMinutes
      }
      const prevAnchorTime = resolvedAnchorTimes.get(reqKey)
      if (prevAnchorTime !== undefined && prevAnchorTime > anchorStart) {
        anchorStart = prevAnchorTime
      }
    }
    resolvedAnchorTimes.set(anchorCand.instanceKey, Math.max(anchorCand.idealTime ?? 0, anchorStart))
  }

  return {
    placed: placed.sort((a, b) => a.startMinutes - b.startMinutes),
    overflow,
    resolvedAnchorTimes,
    diagnostics,
    finalState: state,
  }
}
