import type { Task, WeightPoint, TaskAlterEgo } from '../types/task'
import type { Anchor } from '../types/anchor'
import type { Block } from '../types/block'
import type { Routine, SlotWeightPoint } from '../types/routine'
import type { Obligation } from '../types/obligation'
import type { RecoveryPlan } from '../types/recovery'
import type { DayPlan, CalendarEvent } from '../types/planner'
import type { AnchorConfirmation, AdhocTask, ScheduledItem } from '../types/scheduler'
import { getObligationWeight } from '../types/obligation'
import { getRecoveryWeight } from '../types/recovery'
import { getSlotWeight } from '../types/routine'

// ============================================================================
// Seam 1, 2, 3, 4 + Patch 0002, 0003, 0004: Core Engine Contracts
// ============================================================================

export interface ControlPoint {
  t: number
  v: number
}

/**
 * Seam 3: Hidden schedule state threaded through placement.
 * Default is stateless (`undefined` with identity transition).
 */
export interface ScheduleState {
  readonly [key: string]: unknown
}

/**
 * Seam 4 + Patch 0002: Resolved task variant (alter-ego, continuous durationCurve,
 * or head-clipped duration against fixedEndTime) at candidate start time `t`.
 */
export interface ResolvedVariant {
  title: string
  durationMinutes: number
  alterEgoId?: string
  headClipped?: boolean
}

/**
 * Candidate task or 0-duration Anchor DAG milestone descriptor.
 */
export interface CandidateTask {
  instanceKey: string
  taskId: string
  baseTitle: string
  baseDurationMinutes: number
  minDurationMinutes: number

  // Source metadata preserved for DaySchedule output compatibility
  source: ScheduledItem['source'] | 'anchor'
  sourceId?: string
  sourceName?: string
  day: number
  dateStr?: string
  slotId?: string
  sequencerId?: string       // Patch 0004: RoutineSequencer plugin ID if routine has one
  isBackground: boolean
  isAnchor?: boolean         // true for 0-duration Anchor DAG milestones
  resetAnchorId?: string

  // Explicit DAG prerequisite instanceKeys (e.g. Anchor milestones waiting on pre-anchor routine tasks)
  requiresInstanceKeys?: string[]

  // Time bounds
  earliestStart: number      // initial ideal/cursor start time
  idealTime?: number         // unpushed anchor/task ideal start for delay & expiry calculations
  idealEndTime?: number      // hard end wall (fixedEndTime); head-clips if minDurationMinutes < baseDurationMinutes
  expiryTime?: number        // hard start deadline (drops if start >= expiryTime)

  // Weight evaluation inputs (evaluated dynamically at candidate time `t` by ValueModel)
  baseWeight: number
  weightOffset: number
  eventWeightOffset: number

  // Source-specific curve descriptors (only the relevant one is populated)
  slotCurve?: {
    points: SlotWeightPoint[]
    anchorIdealTime: number
    fallbackWeight: number
    hasSlotConfig: boolean
    matchedSlot: boolean
  }
  taskWeightCurve?: WeightPoint[]
  obligationCurve?: {
    points: WeightPoint[]
    orderBonus: number
  }
  recoveryCurve?: {
    plan: RecoveryPlan
    dateStr: string
    orderBonus: number
  }

  // Variant / Shrinkage rules (evaluated dynamically at candidate time `t`)
  durationCurve?: WeightPoint[]
  selectedAlterEgoId?: string
  alterEgos?: TaskAlterEgo[]
}

/**
 * Seam 2 & 3: Pluggable ValueModel.
 * Evaluates weight and variant at candidate time `t` given current `state`,
 * and transitions `state` when a task is placed.
 */
export interface ValueModel<S = ScheduleState | undefined> {
  readonly initialState: S
  readonly isStateless?: boolean

  /**
   * Evaluates task weight at candidate start time `t` (minutes from midnight).
   * Returns <= 0 if the task cannot or should not be scheduled at `t`.
   */
  value(candidate: CandidateTask, t: number, state: S): number

  /**
   * Resolves the task's effective title and duration at candidate start time `t`.
   * Handles alter-egos (delay from idealTime), continuous `durationCurve`,
   * and head-clipping against `idealEndTime` (`fixedEndTime`).
   */
  resolveVariant(candidate: CandidateTask, t: number, state: S): ResolvedVariant | null

  /**
   * Transitions schedule state when `candidate` is placed over `[start, end]`.
   */
  transition(state: S, candidate: CandidateTask, start: number, end: number): S
}

/**
 * Seam 1: Pure inputs to the day solver (zero Zustand store or localStorage access).
 */
export interface DayManifold {
  dayIndex: number
  dateStr: string
  dayOfWeek: number
  nowMinutes: number
  overflowCutoff: number
  lastDoneAt?: number
}

export interface ObserverState {
  confirmedAnchors: AnchorConfirmation[]
  adhocTasks: AdhocTask[]
  skippedTaskIds: string[]
  doneTasks: string[]
  obligationDoneTasks: string[]
  weightOffsets: Record<string, number>
  committedTasks?: Record<string, number>
}

export interface DomainCatalog {
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
  baseDate?: string
  currentTimeMinutes?: number
}

// ============================================================================
// Default Stateless ValueModel Implementation
// ============================================================================

/**
 * Evaluates the raw weight of a candidate at minute `t` (before user weightOffsets),
 * dynamically reading its curve at `t`.
 */
export function evaluateRawWeightAt(candidate: CandidateTask, t: number): number {
  if (candidate.isAnchor) {
    return candidate.baseWeight
  }

  let raw = candidate.baseWeight

  if (candidate.source === 'routine') {
    if (candidate.slotCurve) {
      const sc = candidate.slotCurve
      if (sc.matchedSlot && sc.points.length > 0) {
        const offsetInSlot = Math.max(0, t - sc.anchorIdealTime)
        raw = getSlotWeight(sc.points, offsetInSlot)
      } else {
        raw = sc.fallbackWeight
      }
    } else if (candidate.taskWeightCurve && candidate.taskWeightCurve.length > 0) {
      raw = getObligationWeight(candidate.taskWeightCurve, t)
    }

    if (candidate.eventWeightOffset > 0) {
      raw = raw - candidate.eventWeightOffset
    }
    return raw
  }

  if (candidate.source === 'obligation' && candidate.obligationCurve) {
    const curveWeight = getObligationWeight(candidate.obligationCurve.points, t)
    if (curveWeight <= 0) return 0
    if (candidate.eventWeightOffset > 0 && curveWeight - candidate.eventWeightOffset <= 0) {
      return 0
    }
    const effective = candidate.eventWeightOffset > 0
      ? curveWeight - candidate.eventWeightOffset
      : curveWeight
    return effective + candidate.obligationCurve.orderBonus
  }

  if (candidate.source === 'recovery' && candidate.recoveryCurve) {
    const curveWeight = getRecoveryWeight(
      candidate.recoveryCurve.plan,
      t,
      candidate.recoveryCurve.dateStr
    )
    if (curveWeight <= 0) return 0
    return curveWeight + candidate.recoveryCurve.orderBonus
  }

  // adhoc or event task
  if (candidate.taskWeightCurve && candidate.taskWeightCurve.length > 0) {
    return getObligationWeight(candidate.taskWeightCurve, t)
  }
  return raw
}

/**
 * Evaluates non-wrapping piecewise linear duration curve at timestamp `t` (clamped at endpoints).
 */
export function evaluateDurationCurveAt(curve: WeightPoint[], t: number): number {
  if (curve.length === 0) return 0
  if (curve.length === 1) return Math.round(curve[0].value)
  const sorted = [...curve].sort((a, b) => a.time - b.time)
  if (t <= sorted[0].time) return Math.round(sorted[0].value)
  if (t >= sorted[sorted.length - 1].time) return Math.round(sorted[sorted.length - 1].value)

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time
      if (span <= 0) return Math.round(a.value)
      const frac = (t - a.time) / span
      return Math.round(a.value + frac * (b.value - a.value))
    }
  }
  return Math.round(sorted[sorted.length - 1].value)
}

/**
 * Patch 0002: Resolves the active variant and effective duration at candidate start time `t`.
 */
export function resolveCandidateVariantAt(
  candidate: CandidateTask,
  t: number
): ResolvedVariant | null {
  if (candidate.isAnchor) {
    return {
      title: candidate.baseTitle,
      durationMinutes: 0,
    }
  }

  const idealRef = candidate.idealTime ?? candidate.earliestStart
  const delayFromIdeal = Math.max(0, t - idealRef)

  let activeAlterEgo: TaskAlterEgo | undefined
  if (candidate.selectedAlterEgoId && candidate.alterEgos) {
    activeAlterEgo = candidate.alterEgos.find((a) => a.id === candidate.selectedAlterEgoId)
  } else if (candidate.alterEgos && candidate.alterEgos.length > 0) {
    const matching = candidate.alterEgos
      .filter((a) => a.triggerDelayMinutes !== undefined && delayFromIdeal >= a.triggerDelayMinutes)
      .sort((a, b) => (b.triggerDelayMinutes ?? 0) - (a.triggerDelayMinutes ?? 0))
    if (matching.length > 0) {
      activeAlterEgo = matching[0]
    }
  }

  const title = activeAlterEgo?.titleOverride
    ? activeAlterEgo.titleOverride
    : activeAlterEgo?.name
    ? `${candidate.baseTitle} (${activeAlterEgo.name})`
    : candidate.baseTitle

  let durationMinutes = candidate.baseDurationMinutes
  if (activeAlterEgo) {
    durationMinutes = activeAlterEgo.durationMinutes
  } else if (candidate.durationCurve && candidate.durationCurve.length > 0) {
    durationMinutes = evaluateDurationCurveAt(candidate.durationCurve, t)
  }

  let headClipped = false
  if (candidate.idealEndTime !== undefined) {
    const remainingBeforeWall = candidate.idealEndTime - t
    if (remainingBeforeWall < durationMinutes) {
      durationMinutes = remainingBeforeWall
      headClipped = true
    }
  }

  if (durationMinutes < candidate.minDurationMinutes) {
    return null
  }

  return {
    title,
    durationMinutes,
    alterEgoId: activeAlterEgo?.id,
    headClipped,
  }
}

export const defaultValueModel: ValueModel<undefined> = {
  initialState: undefined,
  isStateless: true,

  value(candidate: CandidateTask, t: number): number {
    const raw = evaluateRawWeightAt(candidate, t)
    if (raw <= 0) return 0
    return Math.max(1, raw + candidate.weightOffset)
  },

  resolveVariant(candidate: CandidateTask, t: number): ResolvedVariant | null {
    return resolveCandidateVariantAt(candidate, t)
  },

  transition(state: undefined): undefined {
    return state
  },
}
