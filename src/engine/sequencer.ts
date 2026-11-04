import type { CandidateTask, ValueModel, ResolvedVariant } from './valueModel'
import { defaultValueModel } from './valueModel'

// ============================================================================
// Patch 0004: RoutineSequencer Contract & Cooking Reference Implementation
// ============================================================================

/**
 * Context passed to a RoutineSequencer when evaluating or transitioning a task inside a Routine.
 */
export interface SequencerContext {
  dateStr: string
  dayIndex: number
  anchorId?: string
  slotId?: string
  candidateTimeMinutes: number
}

/**
 * Decision returned by `RoutineSequencer.resolveTask(...)` for a task already present in the Routine.
 */
export interface TaskActivation {
  /** If false, the task stays dormant at this timestamp (weight = 0). */
  active: boolean
  /** Optional additive weight boost/penalty (e.g. urgency spike before 3-day prep spoils). */
  weightBonus?: number
  /** Optional multiplicative weight scaling (defaults to 1). */
  weightMultiplier?: number
  /** Optional absolute weight override (replaces base/slot curve if set). */
  weightOverride?: number
  /** Optional duration override in minutes. */
  durationOverrideMinutes?: number
  /** Optional title override (e.g. "Cook Meal (Use Expiring Prep)"). */
  titleOverride?: string
}

/**
 * Custom code state-machine attached at the Routine level (`routine.sequencerId`).
 * All tasks it controls must already exist in the Routine's blocks.
 */
export interface RoutineSequencer<State = any> {
  readonly id: string
  readonly name: string
  readonly initialState: State

  /**
   * Evaluates whether `taskId` inside the Routine wakes up at `ctx.candidateTimeMinutes`,
   * and what weight/duration/title form it takes given `state`.
   */
  resolveTask(taskId: string, state: State, ctx: SequencerContext): TaskActivation

  /**
   * Simulates the state transition inside the solver when `taskId` is placed over `[start, end]`,
   * allowing downstream tasks on the same day or subsequent days to react immediately.
   */
  onTaskSimulated(
    state: State,
    taskId: string,
    startMinutes: number,
    endMinutes: number,
    ctx: SequencerContext
  ): State

  /**
   * Real-world state transition when the user marks `taskId` done on the Dashboard.
   */
  onTaskCompleted?(state: State, taskId: string, dateStr: string, doneAtMinutes: number): State
}

export interface SequencerScheduleState {
  sequencers: Record<string, any>
  [key: string]: unknown
}

/**
 * Composes one or more `RoutineSequencer` plugins with a base `ValueModel`
 * so the solver evaluates `sequencer.resolveTask` at candidate time `t`
 * and threads `sequencer.onTaskSimulated` through `ScheduleState`.
 */
export function createSequencerValueModel(
  sequencers: Record<string, RoutineSequencer<any>>,
  initialStates?: Record<string, any>,
  baseModel: ValueModel<any> = defaultValueModel
): ValueModel<SequencerScheduleState> {
  const mergedInitial: Record<string, any> = {}
  for (const [id, seq] of Object.entries(sequencers)) {
    mergedInitial[id] =
      initialStates && id in initialStates ? initialStates[id] : seq.initialState
  }

  return {
    initialState: {
      ...(typeof baseModel.initialState === 'object' && baseModel.initialState !== null
        ? baseModel.initialState
        : {}),
      sequencers: mergedInitial,
    },
    isStateless: Object.keys(sequencers).length === 0 && Boolean(baseModel.isStateless),

    value(candidate: CandidateTask, t: number, state: SequencerScheduleState): number {
      const baseW = baseModel.value(candidate, t, state as any)
      if (!candidate.sequencerId) return baseW

      const seq = sequencers[candidate.sequencerId]
      if (!seq) return baseW

      const seqState = state?.sequencers?.[candidate.sequencerId] ?? seq.initialState
      const act = seq.resolveTask(candidate.taskId, seqState, {
        dateStr: candidate.dateStr ?? '',
        dayIndex: candidate.day,
        anchorId: candidate.resetAnchorId,
        slotId: candidate.slotId,
        candidateTimeMinutes: t,
      })

      if (!act.active) return 0

      if (act.weightOverride !== undefined) {
        return Math.max(1, Math.round(act.weightOverride + candidate.weightOffset))
      }

      if (baseW <= 0 && (act.weightBonus === undefined || act.weightBonus <= 0)) {
        return 0
      }

      const mult = act.weightMultiplier ?? 1
      const bonus = act.weightBonus ?? 0
      const effective = Math.round(baseW * mult + bonus)
      return effective > 0 ? effective : 0
    },

    resolveVariant(
      candidate: CandidateTask,
      t: number,
      state: SequencerScheduleState
    ): ResolvedVariant | null {
      const baseVar = baseModel.resolveVariant(candidate, t, state as any)
      if (!baseVar) return null
      if (!candidate.sequencerId) return baseVar

      const seq = sequencers[candidate.sequencerId]
      if (!seq) return baseVar

      const seqState = state?.sequencers?.[candidate.sequencerId] ?? seq.initialState
      const act = seq.resolveTask(candidate.taskId, seqState, {
        dateStr: candidate.dateStr ?? '',
        dayIndex: candidate.day,
        anchorId: candidate.resetAnchorId,
        slotId: candidate.slotId,
        candidateTimeMinutes: t,
      })

      if (!act.active) return null

      let durationMinutes = act.durationOverrideMinutes ?? baseVar.durationMinutes
      if (candidate.idealEndTime !== undefined) {
        const remaining = candidate.idealEndTime - t
        if (remaining < durationMinutes) durationMinutes = remaining
      }
      if (durationMinutes < candidate.minDurationMinutes) return null

      return {
        ...baseVar,
        title: act.titleOverride ?? baseVar.title,
        durationMinutes,
      }
    },

    transition(
      state: SequencerScheduleState,
      candidate: CandidateTask,
      start: number,
      end: number
    ): SequencerScheduleState {
      const nextBase = baseModel.transition(state as any, candidate, start, end)
      if (!candidate.sequencerId) {
        return {
          ...(typeof nextBase === 'object' && nextBase !== null ? nextBase : state),
          sequencers: state.sequencers,
        }
      }

      const seq = sequencers[candidate.sequencerId]
      if (!seq) return state

      const prevSeqState = state?.sequencers?.[candidate.sequencerId] ?? seq.initialState
      const updatedSeqState = seq.onTaskSimulated(prevSeqState, candidate.taskId, start, end, {
        dateStr: candidate.dateStr ?? '',
        dayIndex: candidate.day,
        anchorId: candidate.resetAnchorId,
        slotId: candidate.slotId,
        candidateTimeMinutes: start,
      })

      return {
        ...(typeof nextBase === 'object' && nextBase !== null ? nextBase : state),
        sequencers: {
          ...state.sequencers,
          [candidate.sequencerId]: updatedSeqState,
        },
      }
    },
  }
}

// ============================================================================
// Reference Sequencer: Cooking & Meal Inventory (3-Day Prep Expiry + Fallback)
// ============================================================================

export interface CookingSequencerConfig {
  buyGroceriesTaskId: string
  foodPrepTaskId: string
  cookMealTaskId: string
  quickBitesTaskId: string
  /** Prep expires after this many days (default: 3 days = 4320 minutes). */
  prepExpiryMinutes?: number
  /** How many preps one grocery run supports (default: 2). */
  groceryUsesPerRun?: number
  /** How many meals one food prep supports (default: 2). */
  mealsPerPrep?: number
}

export interface CookingInventoryState {
  groceryUsesRemaining: number
  preppedMealsRemaining: number
  /** Absolute timeline minute (dayIndex * 1440 + minuteOfDay) when current prep was completed. */
  prepCompletedAtAbsMinutes: number | null
  /** Tracks which (dayIndex, anchorId) meal slots have already been satisfied. */
  satisfiedMealSlots: string[]
}

/**
 * Concrete `RoutineSequencer` implementing the exact Cooking & Meal rules:
 * 1. If groceries are 0 AND no valid prep exists -> unlocks `Buy Groceries` with high priority; locks `Food Prep`.
 * 2. `Food Prep` requires groceries (`groceryUsesRemaining > 0`). Once completed, produces
 *    `preppedMealsRemaining` that stay valid for `prepExpiryMinutes` (default 3 days = 4,320 mins).
 * 3. If 3 days pass (`absNow - prepCompletedAtAbsMinutes >= prepExpiryMinutes`), the prepped food
 *    expires! `Cook Meal` is locked and `Food Prep` wakes up again.
 * 4. If valid prep is within 24 hours of expiring, `Cook Meal` gets an urgency weight boost (+60)
 *    so prepped food is cooked before spoiling.
 * 5. For any meal slot: if `Cook Meal` runs, it marks that meal slot satisfied so `Quick Bites`
 *    stays dormant; if `Cook Meal` cannot run (no prep and no time to prep first), `Quick Bites`
 *    remains active as the fallback meal!
 */
export function createCookingSequencer(
  config: CookingSequencerConfig,
  initialOverride?: Partial<CookingInventoryState>
): RoutineSequencer<CookingInventoryState> {
  const prepTtl = config.prepExpiryMinutes ?? 3 * 1440 // 3 days in minutes
  const groceryBatch = config.groceryUsesPerRun ?? 2
  const prepBatch = config.mealsPerPrep ?? 2

  const defaultState: CookingInventoryState = {
    groceryUsesRemaining: 1,
    preppedMealsRemaining: 0,
    prepCompletedAtAbsMinutes: null,
    satisfiedMealSlots: [],
    ...initialOverride,
  }

  const isPrepValidAt = (state: CookingInventoryState, absTime: number): boolean => {
    if (state.preppedMealsRemaining <= 0 || state.prepCompletedAtAbsMinutes === null) {
      return false
    }
    return absTime - state.prepCompletedAtAbsMinutes < prepTtl
  }

  return {
    id: 'cooking-sequencer',
    name: 'Cooking & Meal Prep Sequencer (3-Day Expiry)',
    initialState: defaultState,

    resolveTask(
      taskId: string,
      state: CookingInventoryState,
      ctx: SequencerContext
    ): TaskActivation {
      const absTime = ctx.dayIndex * 1440 + ctx.candidateTimeMinutes
      const hasValidPrep = isPrepValidAt(state, absTime)
      const hasGroceries = state.groceryUsesRemaining > 0
      const mealSlotKey = `${ctx.dayIndex}:${ctx.anchorId ?? 'default'}`
      const mealDoneInSlot = state.satisfiedMealSlots.includes(mealSlotKey)

      // 1. Buy Groceries: active only when groceries are depleted AND no valid prep is left to cook
      if (taskId === config.buyGroceriesTaskId) {
        if (!hasGroceries && !hasValidPrep) {
          return {
            active: true,
            weightBonus: 55, // high pull when out of both groceries and prep
            titleOverride: 'Buy Groceries (Stock Depleted)',
          }
        }
        return { active: false }
      }

      // 2. Food Prep: requires groceries, active when no valid prep exists (either never prepped, consumed, or 3-day expired!)
      if (taskId === config.foodPrepTaskId) {
        if (!hasGroceries || hasValidPrep) {
          return { active: false }
        }
        const expiredRecently =
          state.prepCompletedAtAbsMinutes !== null &&
          absTime - state.prepCompletedAtAbsMinutes >= prepTtl
        return {
          active: true,
          weightBonus: expiredRecently ? 40 : 30,
          titleOverride: expiredRecently ? 'Food Prep (Previous Batch Expired)' : undefined,
        }
      }

      // 3. Cook Meal: requires valid (unexpired) prepped food and an unsatisfied meal slot
      if (taskId === config.cookMealTaskId) {
        if (!hasValidPrep || mealDoneInSlot) {
          return { active: false }
        }
        const timeRemainingUntilSpoil =
          prepTtl - (absTime - (state.prepCompletedAtAbsMinutes ?? absTime))
        const spoilUrgencyBonus = timeRemainingUntilSpoil <= 1440 ? 60 : 20
        return {
          active: true,
          weightBonus: spoilUrgencyBonus,
          titleOverride:
            timeRemainingUntilSpoil <= 1440 ? 'Cook Meal (Use Expiring Prep!)' : undefined,
        }
      }

      // 4. Quick Bites (Fallback): active only if the meal slot is not yet satisfied by Cook Meal
      if (taskId === config.quickBitesTaskId) {
        if (mealDoneInSlot) {
          return { active: false }
        }
        return {
          active: true,
          weightBonus: 0,
        }
      }

      return { active: true }
    },

    onTaskSimulated(
      state: CookingInventoryState,
      taskId: string,
      startMinutes: number,
      endMinutes: number,
      ctx: SequencerContext
    ): CookingInventoryState {
      const absEnd = ctx.dayIndex * 1440 + endMinutes
      const mealSlotKey = `${ctx.dayIndex}:${ctx.anchorId ?? 'default'}`

      if (taskId === config.buyGroceriesTaskId) {
        return {
          ...state,
          groceryUsesRemaining: state.groceryUsesRemaining + groceryBatch,
        }
      }

      if (taskId === config.foodPrepTaskId) {
        return {
          ...state,
          groceryUsesRemaining: Math.max(0, state.groceryUsesRemaining - 1),
          preppedMealsRemaining: prepBatch,
          prepCompletedAtAbsMinutes: absEnd,
        }
      }

      if (taskId === config.cookMealTaskId) {
        return {
          ...state,
          preppedMealsRemaining: Math.max(0, state.preppedMealsRemaining - 1),
          satisfiedMealSlots: [...state.satisfiedMealSlots, mealSlotKey],
        }
      }

      if (taskId === config.quickBitesTaskId) {
        return {
          ...state,
          satisfiedMealSlots: [...state.satisfiedMealSlots, mealSlotKey],
        }
      }

      return state
    },
  }
}
