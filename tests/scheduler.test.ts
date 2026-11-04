import assert from 'assert'
import { solveDay } from '../src/engine/solver'
import { validateBlockDag } from '../src/types/block'
import { getObligationWeight } from '../src/types/obligation'
import { getSlotWeight } from '../src/types/routine'
import {
  defaultValueModel,
  type CandidateTask,
  type DayManifold,
  type DomainCatalog,
  type ObserverState,
  type ValueModel,
} from '../src/engine/valueModel'
import {
  createCookingSequencer,
  createSequencerValueModel,
} from '../src/engine/sequencer'

function makeBaseCatalog(): DomainCatalog {
  return {
    tasks: [
      {
        id: 't-brush',
        title: 'Brush & Wash',
        weight: 100,
        durationMinutes: 15,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-boil',
        title: 'Boil Water',
        weight: 80,
        durationMinutes: 10,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-tea',
        title: 'Morning Tea & Book',
        weight: 60,
        durationMinutes: 30,
        parentId: 't-boil',
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-cook',
        title: 'Cook Dinner',
        weight: 75,
        durationMinutes: 60,
        alterEgos: [
          {
            id: 'ae-quick',
            name: 'Express',
            titleOverride: 'Quick Bites',
            durationMinutes: 20,
            triggerDelayMinutes: 30,
          },
        ],
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasAlterEgos: true },
      },
      {
        id: 't-tax',
        title: 'File Tax Return',
        weight: 50,
        durationMinutes: 45,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-laundry-wash',
        title: 'Laundry Wash',
        weight: 70,
        durationMinutes: 30,
        links: [{ linkedTaskId: 't-laundry-hang', continuity: 'resumable' }],
        knobs: { isMother: true, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-laundry-hang',
        title: 'Laundry Hang',
        weight: 70,
        durationMinutes: 30,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
    ],
    anchors: [
      { id: 'a-wake', name: 'Wake' },
      { id: 'a-work', name: 'Work Start' },
      { id: 'a-eve', name: 'Work End' },
      { id: 'a-sleep', name: 'Sleep' },
    ],
    templates: [
      {
        id: 'tpl-workday',
        name: 'Standard Workday',
        entries: [
          { anchorId: 'a-wake', spikeTime: 420, slotId: 's-morning' },  // 07:00
          { anchorId: 'a-work', spikeTime: 540, slotId: 's-work' },     // 09:00
          { anchorId: 'a-eve', spikeTime: 1050, slotId: 's-evening' },  // 17:30
          { anchorId: 'a-sleep', spikeTime: 1380, slotId: 's-night' },  // 23:00
        ],
      },
    ],
    blocks: [
      {
        id: 'b-morning',
        name: 'Morning Block',
        entries: [
          { taskId: 't-brush', order: 0, isBackground: false },
          { taskId: 't-boil', order: 1, isBackground: true },
          { taskId: 't-tea', order: 2, isBackground: false },
        ],
      },
      {
        id: 'b-evening',
        name: 'Evening Block',
        entries: [
          { taskId: 't-cook', order: 0, isBackground: false },
        ],
      },
      {
        id: 'b-laundry',
        name: 'Laundry Chain Block',
        entries: [
          { taskId: 't-laundry-wash', order: 0, isBackground: false },
          { taskId: 't-laundry-hang', order: 1, isBackground: false },
        ],
      },
    ],
    routines: [
      {
        id: 'r-daily',
        name: 'Daily Routine',
        enabled: true,
        blockConfigs: [
          { blockId: 'b-morning', anchorId: 'a-wake' },
          { blockId: 'b-evening', anchorId: 'a-eve' },
        ],
        taskConfigs: [
          {
            taskId: 't-tea',
            expiresAfterMinutes: 120,
            slotWeights: {
              's-morning': [
                { offsetMinutes: 0, value: 60 },
                { offsetMinutes: 60, value: 30 },
                { offsetMinutes: 120, value: 0 },
              ],
            },
          },
        ],
      },
    ],
    obligations: [],
    recoveryPlans: [],
    dayPlans: [
      {
        id: 'dp-work',
        name: 'Workday Plan',
        templateId: 'tpl-workday',
        routineIds: ['r-daily'],
      },
    ],
    weekPlan: { 0: 'dp-work', 1: 'dp-work', 2: 'dp-work', 3: 'dp-work', 4: 'dp-work', 5: 'dp-work', 6: 'dp-work' },
    calendarEvents: [],
  }
}

function makeBaseManifold(overrides?: Partial<DayManifold>): DayManifold {
  return {
    dayIndex: 0,
    dateStr: '2026-11-03',
    dayOfWeek: 2,
    nowMinutes: 420,
    overflowCutoff: 1440 + 420,
    ...overrides,
  }
}

function makeBaseObserver(overrides?: Partial<ObserverState>): ObserverState {
  return {
    confirmedAnchors: [],
    adhocTasks: [],
    skippedTaskIds: [],
    doneTasks: [],
    obligationDoneTasks: [],
    weightOffsets: {},
    ...overrides,
  }
}

export function runAllTests() {
  const results: { name: string; passed: boolean; detail: string }[] = []

  // Test 1: Purity & Isolation + Flat-Weight Baseline
  {
    const catalog = makeBaseCatalog()
    const schedule = solveDay(makeBaseManifold(), catalog, makeBaseObserver())
    const brush = schedule.items.find((i) => i.taskId === 't-brush')
    const boil = schedule.items.find((i) => i.taskId === 't-boil')
    const tea = schedule.items.find((i) => i.taskId === 't-tea')
    const cook = schedule.items.find((i) => i.taskId === 't-cook')

    assert(brush && brush.startMinutes === 420 && brush.endMinutes === 435, 'Brush at 420..435')
    assert(boil && boil.isBackground && boil.startMinutes === 435 && boil.endMinutes === 445, 'Boil (bg) at 435..445')
    assert(tea && tea.startMinutes === 445 && tea.endMinutes === 475, `Tea waits for bg Boil (445..475), got ${tea?.startMinutes}..${tea?.endMinutes}`)
    assert(cook && cook.startMinutes === 1050 && cook.endMinutes === 1110, 'Cook at 1050..1110')
    results.push({
      name: 'Test 1 & 2: Pure Solver Isolation + Background Parent Gate',
      passed: true,
      detail: `Brush=${brush.startMinutes}-${brush.endMinutes}, Boil(bg)=${boil.startMinutes}-${boil.endMinutes}, Tea=${tea.startMinutes}-${tea.endMinutes}`,
    })
  }

  // Test 3: Seam 2 — Dynamic Curve Re-evaluation (Stale-Weight Fix)
  {
    const catalog = makeBaseCatalog()
    catalog.obligations.push({
      id: 'ob-tax',
      name: 'Tax Filing',
      enabled: true,
      recurrence: 'one-time',
      deadline: '2026-11-05',
      tasks: [{ taskId: 't-tax', order: 0 }],
      weightBrackets: [
        {
          maxDaysRemaining: 5,
          timeCurve: [
            { time: 420, value: 90 },
            { time: 479, value: 50 },
            { time: 480, value: 0 },
          ],
        },
      ],
    })

    const observer = makeBaseObserver({
      adhocTasks: [
        {
          id: 'adhoc-urgent',
          title: 'Urgent Production Fix',
          durationMinutes: 70,
          startTime: 420,
          day: 0,
          weight: 500,
        },
      ],
    })

    const schedule = solveDay(makeBaseManifold(), catalog, observer)
    const taxItem = schedule.items.find((i) => i.taskId === 't-tax')
    assert(!taxItem, `Expected t-tax to drop when pushed to 490 where curve=0, but placed at ${taxItem?.startMinutes}`)
    results.push({
      name: 'Test 3: Seam 2 Dynamic Curve Re-Evaluation (Stale-Weight Bug Fixed)',
      passed: true,
      detail: 'Obligation pushed from t=420 (w=91) to t=490 (w=0 outside slab) cleanly dropped',
    })
  }

  // Test 4: Seam 4 — In-Solver Alter-Ego Morphing During Conflict Resolution
  {
    const catalog = makeBaseCatalog()
    const observer = makeBaseObserver({
      adhocTasks: [
        {
          id: 'adhoc-call-1',
          title: 'Late Work Call',
          durationMinutes: 35,
          startTime: 1050,
          day: 0,
          weight: 300,
        },
        {
          id: 'adhoc-call-2',
          title: 'Evening Meeting',
          durationMinutes: 65,
          startTime: 1105,
          day: 0,
          weight: 300,
        },
      ],
    })

    const schedule = solveDay(makeBaseManifold(), catalog, observer)
    const cook = schedule.items.find((i) => i.taskId === 't-cook')
    assert(
      cook && cook.startMinutes === 1085 && cook.endMinutes === 1105 && cook.title === 'Quick Bites',
      `Expected Cook Dinner to morph into Quick Bites (20m) at 1085..1105, got ${JSON.stringify(cook)}`
    )
    results.push({
      name: 'Test 4: Seam 4 In-Solver Alter-Ego Morphing on Conflict Delay',
      passed: true,
      detail: `Cook Dinner (60m @ 1050) pushed by blocker to 1085 -> morphed to "${cook.title}" (20m) and fit into 1085-1105 gap`,
    })
  }

  // Test 5: 0-Duration Anchor DAG Milestones & Wake-at-3PM Expiry Reality Check
  {
    const catalog = makeBaseCatalog()
    const observer = makeBaseObserver({
      confirmedAnchors: [{ anchorId: 'a-wake', actualTime: 900, day: 0 }],
    })

    const schedule = solveDay(makeBaseManifold({ nowMinutes: 900 }), catalog, observer)
    const brush = schedule.items.find((i) => i.taskId === 't-brush')
    const tea = schedule.items.find((i) => i.taskId === 't-tea')
    const workAnchor = schedule.resolvedAnchors.find((a) => a.anchorId === 'a-work')

    assert(brush && brush.startMinutes === 900 && brush.endMinutes === 915, 'Brush still runs at 3 PM')
    assert(!tea, 'Morning Tea expired at 9 AM (ideal 420 + 120) and dropped when waking at 3 PM')
    assert(workAnchor && workAnchor.actualTime === 915, `Work Start DAG milestone settled at 915, got ${workAnchor?.actualTime}`)
    results.push({
      name: 'Test 5: 0-Duration Anchor DAG Milestone & Wake-at-3PM Expiry Check',
      passed: true,
      detail: `Wake@900 -> Brush@900-915, Tea dropped (expired@540), 0-dur Work Start milestone settled at ${workAnchor.actualTime}`,
    })
  }

  // Test 6: Resumable Chain All-or-Nothing Rollback
  {
    const catalog = makeBaseCatalog()
    catalog.routines[0].blockConfigs.push({ blockId: 'b-laundry', anchorId: 'a-sleep' })
    const schedule = solveDay(makeBaseManifold({ overflowCutoff: 1420 }), catalog, makeBaseObserver())
    const wash = schedule.items.find((i) => i.taskId === 't-laundry-wash')
    const hang = schedule.items.find((i) => i.taskId === 't-laundry-hang')

    assert(!wash && !hang, 'Incomplete resumable laundry chain rolled back cleanly')
    results.push({
      name: 'Test 6: Resumable Chain All-or-Nothing Rollback',
      passed: true,
      detail: 'Wash (30m) fit before 1420 cutoff but Hang (30m) overflowed -> both rolled back',
    })
  }

  // Test 7 & 8: Seam 3 Stateful ValueModel + 7-Day Performance
  {
    const catalog = makeBaseCatalog()
    const transitionsRecorded: string[] = []

    const energyModel: ValueModel<{ energy: number }> = {
      initialState: { energy: 100 },
      isStateless: false,
      value(cand: CandidateTask, t: number, state: { energy: number }) {
        const base = defaultValueModel.value(cand, t, undefined)
        return base > 0 ? Math.round(base * (state.energy / 100)) : 0
      },
      resolveVariant(cand: CandidateTask, t: number) {
        return defaultValueModel.resolveVariant(cand, t, undefined)
      },
      transition(state: { energy: number }, cand: CandidateTask, start: number, end: number) {
        transitionsRecorded.push(`${cand.taskId}@${start}-${end}(E:${state.energy}->${state.energy - 20})`)
        return { energy: Math.max(10, state.energy - 20) }
      },
    }

    const t0 = Date.now()
    for (let d = 0; d < 7; d++) {
      solveDay(makeBaseManifold({ dayIndex: d }), catalog, makeBaseObserver(), energyModel)
    }
    const elapsedMs = Date.now() - t0

    assert(transitionsRecorded.length > 0, 'State transitions threaded through placement')
    assert(elapsedMs < 50, `7-day solve took ${elapsedMs}ms (budget < 50ms)`)
    results.push({
      name: 'Test 7 & 8: Seam 3 Stateful Transition + 7-Day Speed Budget',
      passed: true,
      detail: `7-day solve completed in ${elapsedMs}ms (<50ms budget); state transitions=${transitionsRecorded.slice(0, 3).join(', ')}`,
    })
  }

  // Test 9 (Patch 0002): Head-Clipping on fixedEndTime (Football / Sleep Joining Late)
  {
    const catalog = makeBaseCatalog()
    catalog.tasks.push(
      {
        id: 't-football',
        title: 'Evening Football',
        weight: 95,
        durationMinutes: 60,
        minDurationMinutes: 30,
        fixedEndTime: 1110,
        links: [{ linkedTaskId: 't-bath', continuity: 'resumable' }],
        knobs: { isMother: true, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true },
      },
      {
        id: 't-bath',
        title: 'Post-Football Bath',
        weight: 90,
        durationMinutes: 20,
        parentId: 't-football',
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      }
    )
    catalog.blocks.push({
      id: 'b-football',
      name: 'Football Block',
      entries: [
        { taskId: 't-football', order: 0, isBackground: false },
        { taskId: 't-bath', order: 1, isBackground: false },
      ],
    })
    catalog.routines[0].blockConfigs.push({ blockId: 'b-football', anchorId: 'a-eve' })

    const schedA = solveDay(
      makeBaseManifold(),
      catalog,
      makeBaseObserver({
        adhocTasks: [{ id: 'a-delay20', title: 'Traffic Delay', durationMinutes: 20, startTime: 1050, day: 0, weight: 400 }],
      })
    )
    const fbA = schedA.items.find((i) => i.taskId === 't-football')
    const bathA = schedA.items.find((i) => i.taskId === 't-bath')
    assert(fbA && fbA.startMinutes === 1070 && fbA.endMinutes === 1110, 'Football head-clipped to 40m')
    assert(bathA && bathA.startMinutes === 1110 && bathA.endMinutes === 1130, 'Bath right after Football')

    const schedB = solveDay(
      makeBaseManifold(),
      catalog,
      makeBaseObserver({
        adhocTasks: [{ id: 'a-delay45', title: 'Long Meeting', durationMinutes: 45, startTime: 1050, day: 0, weight: 400 }],
      })
    )
    const fbB = schedB.items.find((i) => i.taskId === 't-football')
    const bathB = schedB.items.find((i) => i.taskId === 't-bath')
    assert(!fbB && !bathB, 'Both Football and Bath dropped when remaining time < minDuration')

    results.push({
      name: 'Test 9 (Patch 0002): Head-Clipping on fixedEndTime + Contingent Chain Drop',
      passed: true,
      detail: '20m delay -> Football head-clipped to 40m (1070-1110) + Bath (1110-1130); 45m delay (<30m floor) -> both Football & Bath dropped',
    })
  }

  // Test 10 (Patch 0002): Continuous durationCurve Shrinkage Over Time
  {
    const catalog = makeBaseCatalog()
    const cookTask = catalog.tasks.find((t) => t.id === 't-cook')!
    cookTask.knobs.hasAlterEgos = false
    cookTask.alterEgos = undefined
    cookTask.knobs.hasDurationCurve = true
    cookTask.minDurationMinutes = 20
    cookTask.durationCurve = [
      { time: 1050, value: 60 },
      { time: 1170, value: 20 },
    ]

    const sched = solveDay(
      makeBaseManifold(),
      catalog,
      makeBaseObserver({
        adhocTasks: [{ id: 'a-60m', title: '1h Delay', durationMinutes: 60, startTime: 1050, day: 0, weight: 300 }],
      })
    )
    const cook = sched.items.find((i) => i.taskId === 't-cook')
    assert(cook && cook.startMinutes === 1110 && cook.endMinutes === 1150, 'Cook compressed to 40m')
    results.push({
      name: 'Test 10 (Patch 0002): Continuous durationCurve Compression Over Time',
      passed: true,
      detail: `Cook Dinner (60m@17:30 -> 20m@19:30) pushed to 18:30 (1110) -> smoothly compressed to ${cook.endMinutes - cook.startMinutes}m (1110-1150)`,
    })
  }

  // Test 11 (Patch 0003): Multi-Parent Block DAG
  {
    const catalog = makeBaseCatalog()
    catalog.tasks.push(
      {
        id: 't-wash-load',
        title: 'Load Washer',
        weight: 85,
        durationMinutes: 10,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-machine-run',
        title: 'Washing Machine Cycle',
        weight: 85,
        durationMinutes: 45,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-fold-prev',
        title: 'Fold Previous Batch (Clear Rack)',
        weight: 80,
        durationMinutes: 20,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-hang-next',
        title: 'Hang Fresh Batch',
        weight: 95,
        durationMinutes: 15,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      }
    )

    catalog.blocks.push({
      id: 'b-laundry-dag',
      name: 'Laundry Multi-Parent DAG',
      entries: [
        { taskId: 't-wash-load', order: 0, isBackground: false },
        { taskId: 't-machine-run', order: 1, isBackground: true, requires: ['t-wash-load'] },
        { taskId: 't-fold-prev', order: 2, isBackground: false },
        {
          taskId: 't-hang-next',
          order: 3,
          isBackground: false,
          requires: ['t-machine-run', 't-fold-prev'],
          dropIfParentMissed: true,
          dropParentIfMissed: true,
        },
      ],
    })

    catalog.routines[0].blockConfigs = [{ blockId: 'b-laundry-dag', anchorId: 'a-wake' }]
    catalog.routines[0].taskConfigs = []

    const sched = solveDay(makeBaseManifold(), catalog, makeBaseObserver())
    const load = sched.items.find((i) => i.taskId === 't-wash-load')
    const machine = sched.items.find((i) => i.taskId === 't-machine-run')
    const fold = sched.items.find((i) => i.taskId === 't-fold-prev')
    const hang = sched.items.find((i) => i.taskId === 't-hang-next')

    assert(load && load.startMinutes === 420 && load.endMinutes === 430, `Load at 420..430, got ${load?.startMinutes}`)
    assert(machine && machine.startMinutes === 430 && machine.endMinutes === 475, 'Machine(bg) at 430..475')
    assert(fold && fold.startMinutes === 430 && fold.endMinutes === 450, 'Fold runs during bg Machine Cycle at 430..450')
    assert(hang && hang.startMinutes === 475 && hang.endMinutes === 490, 'Hang waits for both at 475..490')

    results.push({
      name: 'Test 11 (Patch 0003): Multi-Parent Block DAG (Laundry Wash + bg Machine + Fold -> Hang)',
      passed: true,
      detail: `Load=${load.startMinutes}-${load.endMinutes}, Machine(bg)=${machine.startMinutes}-${machine.endMinutes}, Fold(parallel fg)=${fold.startMinutes}-${fold.endMinutes} -> Hang waits for both at ${hang.startMinutes}-${hang.endMinutes}`,
    })
  }

  // Test 12 (Patch 0003): Forward Contingency (`dropIfParentMissed`) & DAG Cycle Rejection
  {
    const catalog = makeBaseCatalog()
    catalog.tasks.push(
      {
        id: 't-match',
        title: 'Football Match',
        weight: 95,
        durationMinutes: 60,
        minDurationMinutes: 40,
        fixedEndTime: 1110,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true },
      },
      {
        id: 't-shower',
        title: 'Shower After Match',
        weight: 85,
        durationMinutes: 15,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 't-protein',
        title: 'Post-Match Recovery Meal',
        weight: 80,
        durationMinutes: 20,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      }
    )

    catalog.blocks.push({
      id: 'b-match-dag',
      name: 'Match Cascade Block',
      entries: [
        { taskId: 't-match', order: 0, isBackground: false },
        { taskId: 't-shower', order: 1, isBackground: false, requires: ['t-match'], dropIfParentMissed: true },
        { taskId: 't-protein', order: 2, isBackground: false, requires: ['t-shower'], dropIfParentMissed: true },
      ],
    })
    catalog.routines[0].blockConfigs = [{ blockId: 'b-match-dag', anchorId: 'a-eve' }]

    const sched = solveDay(
      makeBaseManifold(),
      catalog,
      makeBaseObserver({
        adhocTasks: [{ id: 'a-block-match', title: 'Overtime', durationMinutes: 35, startTime: 1050, day: 0, weight: 400 }],
      })
    )
    assert(
      !sched.items.some((i) => ['t-match', 't-shower', 't-protein'].includes(i.taskId)),
      'Multi-hop dropIfParentMissed cascade dropped Shower and Protein when Match missed'
    )

    const cycleCheck = validateBlockDag([
      { taskId: 'A', order: 0, isBackground: false, requires: ['C'] },
      { taskId: 'B', order: 1, isBackground: false, requires: ['A'] },
      { taskId: 'C', order: 2, isBackground: false, requires: ['B'] },
    ])
    assert(!cycleCheck.valid && cycleCheck.cycle && cycleCheck.cycle.length >= 3, 'Detected 3-node cycle')

    results.push({
      name: 'Test 12 (Patch 0003): Block DAG Forward Contingency Cascade & Cycle Rejection',
      passed: true,
      detail: `Match missed -> Shower & Protein cascaded drop; cycle check caught [${cycleCheck.cycle?.join(' -> ')}]`,
    })
  }

  // Test 13 (Patch 0004): RoutineSequencer at Routine Level — Cooking
  {
    const buildCookingCatalog = (): DomainCatalog => {
      const cat = makeBaseCatalog()
      cat.tasks = [
        {
          id: 't-groceries',
          title: 'Buy Groceries',
          weight: 60,
          durationMinutes: 40,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
        {
          id: 't-prep',
          title: 'Food Prep',
          weight: 70,
          durationMinutes: 30,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
        {
          id: 't-cook-meal',
          title: 'Cook Meal',
          weight: 80,
          durationMinutes: 30,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
        {
          id: 't-quick-bites',
          title: 'Quick Bites',
          weight: 45,
          durationMinutes: 15,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
      ]

      cat.blocks = [
        {
          id: 'b-morning-meal',
          name: 'Morning Meal Block',
          entries: [
            { taskId: 't-prep', order: 0, isBackground: false },
            { taskId: 't-cook-meal', order: 1, isBackground: false },
            { taskId: 't-quick-bites', order: 2, isBackground: false },
          ],
        },
        {
          id: 'b-evening-kitchen',
          name: 'Evening Kitchen Block',
          entries: [
            { taskId: 't-groceries', order: 0, isBackground: false },
            { taskId: 't-prep', order: 1, isBackground: false },
            { taskId: 't-cook-meal', order: 2, isBackground: false },
            { taskId: 't-quick-bites', order: 3, isBackground: false },
          ],
        },
      ]

      cat.routines = [
        {
          id: 'r-cooking',
          name: 'Cooking & Meal Routine',
          enabled: true,
          sequencerId: 'cooking-sequencer',
          blockConfigs: [
            { blockId: 'b-morning-meal', anchorId: 'a-wake' },
            { blockId: 'b-evening-kitchen', anchorId: 'a-eve' },
          ],
          taskConfigs: [],
        },
      ]
      cat.dayPlans = [
        {
          id: 'dp-cooking',
          name: 'Cooking Plan',
          templateId: 'tpl-workday',
          routineIds: ['r-cooking'],
        },
      ]
      cat.weekPlan = { 0: 'dp-cooking', 1: 'dp-cooking', 2: 'dp-cooking', 3: 'dp-cooking', 4: 'dp-cooking', 5: 'dp-cooking', 6: 'dp-cooking' }
      return cat
    }

    const cookingConfig = {
      buyGroceriesTaskId: 't-groceries',
      foodPrepTaskId: 't-prep',
      cookMealTaskId: 't-cook-meal',
      quickBitesTaskId: 't-quick-bites',
      prepExpiryMinutes: 3 * 1440,
      groceryUsesPerRun: 2,
      mealsPerPrep: 2,
    }

    {
      const cat = buildCookingCatalog()
      const seq = createCookingSequencer(cookingConfig, {
        groceryUsesRemaining: 0,
        preppedMealsRemaining: 0,
        prepCompletedAtAbsMinutes: null,
      })
      const model = createSequencerValueModel({ 'cooking-sequencer': seq })
      const sched = solveDay(makeBaseManifold({ dayIndex: 0 }), cat, makeBaseObserver(), model)

      const morningItems = sched.items.filter((i) => i.resetAnchorId === 'a-wake')
      const eveningItems = sched.items.filter((i) => i.resetAnchorId === 'a-eve')

      assert(
        morningItems.length === 1 && morningItems[0].taskId === 't-quick-bites',
        `Expected Morning to fall back to Quick Bites when out of groceries & prep, got ${morningItems.map((i) => i.taskId)}`
      )
      assert(
        eveningItems.map((i) => i.taskId).join(',') === 't-groceries,t-prep,t-cook-meal',
        `Expected Evening to chain Buy Groceries -> Food Prep -> Cook Meal (and suppress Quick Bites), got ${eveningItems.map((i) => i.taskId)}`
      )
    }

    {
      const cat = buildCookingCatalog()
      const seq = createCookingSequencer(cookingConfig, {
        groceryUsesRemaining: 1,
        preppedMealsRemaining: 0,
        prepCompletedAtAbsMinutes: null,
      })
      const model = createSequencerValueModel({ 'cooking-sequencer': seq })
      const sched = solveDay(makeBaseManifold({ dayIndex: 0 }), cat, makeBaseObserver(), model)
      const morningItems = sched.items.filter((i) => i.resetAnchorId === 'a-wake')

      assert(
        morningItems.map((i) => i.taskId).join(',') === 't-prep,t-cook-meal',
        `Expected Morning to pull in Food Prep -> Cook Meal (suppressing Quick Bites), got ${morningItems.map((i) => i.taskId)}`
      )
      assert(
        morningItems[0].startMinutes === 420 && morningItems[1].startMinutes === 450,
        'Food Prep at 420..450 followed by Cook Meal at 450..480'
      )
    }

    {
      const cat = buildCookingCatalog()
      const seqExpiringSoon = createCookingSequencer(cookingConfig, {
        groceryUsesRemaining: 1,
        preppedMealsRemaining: 2,
        prepCompletedAtAbsMinutes: 1080,
      })
      const schedDay3Morning = solveDay(
        makeBaseManifold({ dayIndex: 3 }),
        cat,
        makeBaseObserver(),
        createSequencerValueModel({ 'cooking-sequencer': seqExpiringSoon })
      )
      const day3MorningCook = schedDay3Morning.items.find(
        (i) => i.resetAnchorId === 'a-wake' && i.taskId === 't-cook-meal'
      )
      assert(
        day3MorningCook && day3MorningCook.title === 'Cook Meal (Use Expiring Prep!)',
        `Expected expiring-soon urgency title on Day 3 Morning, got ${day3MorningCook?.title}`
      )

      const seqExpired = createCookingSequencer(cookingConfig, {
        groceryUsesRemaining: 1,
        preppedMealsRemaining: 1,
        prepCompletedAtAbsMinutes: 1050,
        satisfiedMealSlots: ['3:a-wake'],
      })
      const schedDay3Eve = solveDay(
        makeBaseManifold({ dayIndex: 3 }),
        cat,
        makeBaseObserver(),
        createSequencerValueModel({ 'cooking-sequencer': seqExpired })
      )
      const eveItems = schedDay3Eve.items.filter((i) => i.resetAnchorId === 'a-eve')
      assert(
        eveItems.map((i) => i.taskId).join(',') === 't-prep,t-cook-meal' &&
          eveItems[0].title === 'Food Prep (Previous Batch Expired)',
        `Expected spoiled prep on Day 3 Evening to force re-prep before Cook Meal, got ${eveItems.map((i) => `${i.taskId}:${i.title}`)}`
      )
    }

    results.push({
      name: 'Test 13 (Patch 0004): RoutineSequencer Cooking (Groceries -> 3-Day Prep Expiry -> Cook vs Quick Bites)',
      passed: true,
      detail: 'Verified: (A) No groceries -> Morning Quick Bites fallback + Evening Groceries->Prep->Cook; (B) No prep -> Morning pulls Food Prep->Cook; (C) 3-day TTL urgency boost & post-72h spoilage forces re-prep',
    })
  }

  // Test 14 (Patch 0005): Falsification Suite — Slab Zero-Outside, Intruder Shrinkage, Equal-Priority Sharing, Weight-Tie Callout, and 2-Hop Expiry Rescue
  {
    // 14A: Slab Curve Strictly Zero Outside [first.time, last.time]
    const slabCurve = [
      { time: 540, value: 80 }, // 09:00 -> 80
      { time: 660, value: 40 }, // 11:00 -> 40
    ]
    assert(getObligationWeight(slabCurve, 539) === 0, 'Strictly 0 before slab start (08:59)')
    assert(getObligationWeight(slabCurve, 600) === 60, 'Linear gradient 60 at midpoint (10:00)')
    assert(getObligationWeight(slabCurve, 661) === 0, 'Strictly 0 after slab end (11:01)')

    const slotSlab = [
      { offsetMinutes: 15, value: 90 },
      { offsetMinutes: 45, value: 30 },
    ]
    assert(getSlotWeight(slotSlab, 14) === 0, 'Slot curve strictly 0 before first offset')
    assert(getSlotWeight(slotSlab, 30) === 60, 'Slot curve 60 at midpoint')
    assert(getSlotWeight(slotSlab, 46) === 0, 'Slot curve strictly 0 after last offset')

    // 14B: Higher-Priority Intruder Shrinks Lower-Priority Leader
    // Task A (w=60, ideal=60m, min=20m) starts at 09:00 (540).
    // Task B (w=95, dur=30m) intrudes at 09:35 (575).
    // Task A shrinks to 35m (540..575) so Task B runs on time at 575..605, emitting INTRUDER_SHRUNK!
    {
      const cat = makeBaseCatalog()
      cat.tasks = [
        {
          id: 't-flex-leader',
          title: 'Deep Reading',
          weight: 60,
          durationMinutes: 60,
          minDurationMinutes: 20,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
      ]
      cat.blocks = [
        {
          id: 'b-work-slot',
          name: 'Work Slot',
          entries: [{ taskId: 't-flex-leader', order: 0, isBackground: false }],
        },
      ]
      cat.routines[0].blockConfigs = [{ blockId: 'b-work-slot', anchorId: 'a-work' }]
      cat.routines[0].taskConfigs = []

      const sched = solveDay(
        makeBaseManifold({ nowMinutes: 540 }),
        cat,
        makeBaseObserver({
          adhocTasks: [
            {
              id: 'adhoc-intruder',
              title: 'Priority Standup',
              durationMinutes: 30,
              startTime: 575, // 09:35
              day: 0,
              weight: 95,
            },
          ],
        })
      )
      const leader = sched.items.find((i) => i.taskId === 't-flex-leader')
      const intruder = sched.items.find((i) => i.taskId === 'adhoc-intruder')
      assert(
        leader && leader.startMinutes === 540 && leader.endMinutes === 575 && leader.shrunkFromMinutes === 60,
        `Expected Deep Reading to shrink from 60m to 35m (540..575), got ${JSON.stringify(leader)}`
      )
      assert(
        intruder && intruder.startMinutes === 575 && intruder.endMinutes === 605,
        'Intruder starts right on time at 575..605'
      )
      assert(
        sched.diagnostics?.some((d) => d.kind === 'INTRUDER_SHRUNK'),
        'Emitted INTRUDER_SHRUNK diagnostic'
      )
    }

    // 14C: Equal-Priority Slack-Proportional Sharing + Weight-Tie Ambiguity Callout
    // Two tasks with equal weight (w=80) in a 50m window (540..590, bounded by idealEndTime=590):
    // Task A: ideal=40m, min=30m (slack=10m)
    // Task B: ideal=40m, min=10m (slack=30m)
    // Total min = 40m <= 50m window -> extraRoom = 10m distributed 1:3 -> A=33m (540..573), B=17m (573..590)!
    {
      const cat = makeBaseCatalog()
      cat.tasks = [
        {
          id: 't-share-a',
          title: 'Prep Slides',
          weight: 80,
          durationMinutes: 40,
          minDurationMinutes: 30,
          fixedEndTime: 590,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true },
        },
        {
          id: 't-share-b',
          title: 'Review Notes',
          weight: 80,
          durationMinutes: 40,
          minDurationMinutes: 10,
          fixedEndTime: 590,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false, hasFixedEndTime: true },
        },
      ]
      cat.blocks = [
        {
          id: 'b-share',
          name: 'Equal Priority Block',
          entries: [
            { taskId: 't-share-a', order: 0, isBackground: false },
            { taskId: 't-share-b', order: 1, isBackground: false },
          ],
        },
      ]
      cat.routines[0].blockConfigs = [{ blockId: 'b-share', anchorId: 'a-work' }]
      cat.routines[0].taskConfigs = []

      const sched = solveDay(makeBaseManifold({ nowMinutes: 540 }), cat, makeBaseObserver())
      const itemA = sched.items.find((i) => i.taskId === 't-share-a')
      const itemB = sched.items.find((i) => i.taskId === 't-share-b')
      assert(
        itemA && itemB && itemA.endMinutes - itemA.startMinutes === 33 && itemB.endMinutes - itemB.startMinutes === 17,
        `Expected slack-proportional split 33m + 17m = 50m, got ${itemA?.endMinutes! - itemA?.startMinutes!}m and ${itemB?.endMinutes! - itemB?.startMinutes!}m`
      )
      assert(
        sched.diagnostics?.some((d) => d.kind === 'EQUAL_PRIORITY_SHARED'),
        'Emitted EQUAL_PRIORITY_SHARED diagnostic'
      )

      // Now shrink window to 35m (fixedEndTime = 575 < totalMin 40m) -> must emit WEIGHT_TIE_AMBIGUITY callout for user!
      cat.tasks[0].fixedEndTime = 575
      cat.tasks[1].fixedEndTime = 575
      const schedTie = solveDay(makeBaseManifold({ nowMinutes: 540 }), cat, makeBaseObserver())
      assert(
        schedTie.diagnostics?.some((d) => d.kind === 'WEIGHT_TIE_AMBIGUITY'),
        'Emitted WEIGHT_TIE_AMBIGUITY diagnostic when equal-weight tasks cannot both fit'
      )
    }

    // 14D: 2-Hop Expiry-Rescue Lookahead
    // Task A (w=85, 30m, flexible all morning) vs Task B (w=80, 30m, expires in 35m at 575).
    // Greedy picks A (85 > 80) at 540..570, pushing B to 570 where B still fits if expiry=600,
    // OR if B expires at 570 (expiresAfterMinutes=30), running B first at 540..570 and A at 570..600 saves BOTH!
    {
      const cat = makeBaseCatalog()
      cat.tasks = [
        {
          id: 't-heavy-flex',
          title: 'Flexible Deep Work',
          weight: 85,
          durationMinutes: 30,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
        {
          id: 't-urgent-expiring',
          title: 'Morning Standup Check-in',
          weight: 80,
          durationMinutes: 30,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        },
      ]
      cat.blocks = [
        {
          id: 'b-rescue',
          name: 'Lookahead Block',
          entries: [
            { taskId: 't-heavy-flex', order: 0, isBackground: false },
            { taskId: 't-urgent-expiring', order: 1, isBackground: false },
          ],
        },
      ]
      cat.routines[0].blockConfigs = [{ blockId: 'b-rescue', anchorId: 'a-work' }]
      cat.routines[0].taskConfigs = [
        {
          taskId: 't-urgent-expiring',
          idealTime: 540,
          expiresAfterMinutes: 15, // Must start before 555! If t-heavy-flex (30m) runs first at 540..570, t-urgent-expiring dies!
        },
        {
          taskId: 't-heavy-flex',
          idealTime: 540, // Also wants to start at 540, but has no expiry!
        },
      ]

      const sched = solveDay(makeBaseManifold({ nowMinutes: 540 }), cat, makeBaseObserver())
      const expItem = sched.items.find((i) => i.taskId === 't-urgent-expiring')
      const flexItem = sched.items.find((i) => i.taskId === 't-heavy-flex')
      assert(
        expItem && expItem.startMinutes === 540 && flexItem && flexItem.startMinutes === 570,
        `Expected lookahead to run expiring task first (540..570) and flexible heavier task second (570..600), got exp=${expItem?.startMinutes}, flex=${flexItem?.startMinutes}`
      )
    }

    // 14E: Trapezoid Rising-Ramp Obligation vs Later-Anchor Work Slot (Rent Obligation Fix)
    // Obligation curve starts at (540, 0) -> (720, 400) -> (1020, 400) -> (1080, 0).
    // Morning routine occupies 420..645, pushing Work (w=100, 480m ideal, 240m min) to 645.
    // Verify Rent is evaluated at freeStart=645 (where W=234 > Work W=100) and scheduled at 645..690!
    {
      const cat = makeBaseCatalog()
      cat.tasks.push(
        { id: 't-morning-long', title: 'Morning Gym & Cook', weight: 95, durationMinutes: 225, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-work-8h', title: 'Work', weight: 100, durationMinutes: 480, minDurationMinutes: 240, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } },
        { id: 't-rent', title: 'Rent', weight: 100, durationMinutes: 45, knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false } }
      )
      cat.blocks = [
        { id: 'b-m-long', name: 'Morning', entries: [{ taskId: 't-morning-long', order: 0, isBackground: false }] },
        { id: 'b-w-8h', name: 'Work', entries: [{ taskId: 't-work-8h', order: 0, isBackground: false }] },
      ]
      cat.routines[0].blockConfigs = [
        { blockId: 'b-m-long', anchorId: 'a-wake' },
        { blockId: 'b-w-8h', anchorId: 'a-work' },
      ]
      cat.routines[0].taskConfigs = []
      cat.obligations = [
        {
          id: 'ob-rent',
          name: 'Rent',
          enabled: true,
          recurrence: 'one-time',
          deadline: '2026-11-10',
          tasks: [{ taskId: 't-rent', order: 0 }],
          weightBrackets: [
            {
              maxDaysRemaining: 30,
              timeCurve: [
                { time: 540, value: 0 },
                { time: 720, value: 400 },
                { time: 1020, value: 400 },
                { time: 1080, value: 0 },
              ],
            },
          ],
        },
      ]
      const schedRent = solveDay(makeBaseManifold({ nowMinutes: 420 }), cat, makeBaseObserver())
      const rentPlaced = schedRent.items.find((i) => i.taskId === 't-rent')
      const workPlaced = schedRent.items.find((i) => i.taskId === 't-work-8h')
      assert(
        rentPlaced && rentPlaced.startMinutes === 645 && rentPlaced.endMinutes === 690,
        `Expected Rent obligation to schedule at 645..690 ahead of Work, got ${JSON.stringify(rentPlaced)}`
      )
      assert(
        workPlaced && workPlaced.startMinutes === 690,
        `Expected Work to start at 690 after Rent, got ${JSON.stringify(workPlaced)}`
      )
    }

    results.push({
      name: 'Test 14 (Patch 0005): Exact-Fit Solver Falsification Suite (Slab Zero-Outside, Intruder Shrink, Equal-Priority Share, Tie Callout & Lookahead)',
      passed: true,
      detail: 'Verified: 14A Slab=0 outside; 14B Intruder shrinks leader 60m->35m; 14C Equal-priority slack split 33m+17m & tie callout; 14D Lookahead rescues expiring task; 14E Trapezoid Rent obligation',
    })
  }

  // Test 15 (Patch 0009): Task Templates & Routine-Level Task Customizations
  {
    const cat = makeBaseCatalog()
    // Two generic Task Templates with identical default weight (100) and default duration (30m)
    cat.tasks = [
      {
        id: 'tpl-workout',
        title: 'Workout',
        weight: 100,
        durationMinutes: 30,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
      {
        id: 'tpl-stretch',
        title: 'Stretch',
        weight: 100,
        durationMinutes: 30,
        knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
      },
    ]
    cat.blocks = [
      {
        id: 'b-slot-tpl',
        name: 'Morning Fitness Slot',
        entries: [
          { taskId: 'tpl-stretch', order: 0, isBackground: false },
          { taskId: 'tpl-workout', order: 1, isBackground: false },
        ],
      },
    ]
    // Customize inside the Routine:
    // - Routine origin baseWeight = 120
    // - tpl-workout customized to 45m (min 25m), relativeWeight = +15 (eff W = 135), titleOverride = "Morning HIIT Workout"
    // - tpl-stretch customized to 15m (min 10m), relativeWeight = +5 (eff W = 125), titleOverride = "Cooldown Mobility"
    cat.routines[0].baseWeight = 120
    cat.routines[0].blockConfigs = [{ blockId: 'b-slot-tpl', anchorId: 'a-wake' }]
    cat.routines[0].taskConfigs = [
      {
        taskId: 'tpl-workout',
        titleOverride: 'Morning HIIT Workout',
        durationMinutes: 45,
        minDurationMinutes: 25,
        relativeWeight: 15,
      },
      {
        taskId: 'tpl-stretch',
        titleOverride: 'Cooldown Mobility',
        durationMinutes: 15,
        minDurationMinutes: 10,
        relativeWeight: 5,
      },
    ]

    const sched = solveDay(makeBaseManifold({ nowMinutes: 420 }), cat, makeBaseObserver())
    const workoutItem = sched.items.find((i) => i.taskId === 'tpl-workout')
    const stretchItem = sched.items.find((i) => i.taskId === 'tpl-stretch')

    assert(
      workoutItem &&
        workoutItem.title === 'Morning HIIT Workout' &&
        workoutItem.startMinutes === 420 &&
        workoutItem.endMinutes === 465 &&
        workoutItem.weight === 135,
      `Expected customized workout (title="Morning HIIT Workout", 45m, W=135) to lead at 420..465, got ${JSON.stringify(workoutItem)}`
    )
    assert(
      stretchItem &&
        stretchItem.title === 'Cooldown Mobility' &&
        stretchItem.startMinutes === 465 &&
        stretchItem.endMinutes === 480 &&
        stretchItem.weight === 125,
      `Expected customized stretch (title="Cooldown Mobility", 15m, W=125) to follow at 465..480, got ${JSON.stringify(stretchItem)}`
    )

    results.push({
      name: 'Test 15 (Patch 0009): Task Templates & Routine-Level Task Customizations (Duration, Min-Floor, Title, Origin + Relative Weights)',
      passed: true,
      detail: `Workout customized to "${workoutItem.title}" (45m, W=${workoutItem.weight}) at ${workoutItem.startMinutes}..${workoutItem.endMinutes}; Stretch customized to "${stretchItem.title}" (15m, W=${stretchItem.weight}) at ${stretchItem.startMinutes}..${stretchItem.endMinutes}`,
    })
  }

  return results
}
