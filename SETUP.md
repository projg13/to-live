# to_live — Setup & Instruction Manual

## Quick Start

```bash
npm install
npm run dev
```

Open in browser. Hit **Factory Reset** (red button at bottom) for clean defaults.

---

## Bundle for Capacitor (Mobile)

```bash
# 1. Build the web app
npm run build

# 2. Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "To Live" "com.tolive.app" --web-dir dist

# 3. Add platforms
npx cap add android
npx cap add ios

# 4. Copy build to native
npx cap copy

# 5. Open in IDE
npx cap open android   # opens Android Studio
npx cap open ios       # opens Xcode

# 6. Run on device
# In Android Studio: Run > Run 'app'
# In Xcode: Select device > Run
```

After any code change:
```bash
npm run build && npx cap copy
```

---

## How the App Works — Instruction Manual

### Concept
Your day is 24 hours. Everything is a **task** (quantum of time). The scheduler fills your day by placing tasks based on their weight (priority).

### The Hierarchy

```
Anchors (time markers)
  └─ Slots (periods between anchors)
       └─ Blocks (ordered task groups in slots)
            └─ Tasks (atomic time units)

Routines → spawn blocks daily/weekly
Obligations → deadline-driven tasks that escalate
Recovery → triggered catch-up when things pile up
Rot → logged wasted time for calibration
```

### Tab: Manage

#### Anchors
- **Anchors**: Named time markers (Wake, Work Start, etc.)
- **Slots**: Named periods (Morning, Work Hours, etc.)
- **Templates**: Combine anchors + times + slots. E.g., "Workday" = Wake@6AM→Morning, Work Start@9AM→Work Hours...

#### Tasks
Each task has:
- **Duration** (mandatory) — how long it takes
- **Weight** — priority (higher = scheduled first)
- **Knobs** (toggleable):
  - Scheduled: fixed start/end time
  - Mother: links to other tasks (active = sequential, passive = background/ghost)
  - Weight Curve: piecewise weight over time
  - Expiry: dies after this datetime
  - Stickiness: resists being displaced

#### Blocks
- Ordered group of tasks attached to a slot
- **Mandatory** tasks survive time pressure, optional ones get dropped
- **Background** tasks (marked "bg") run concurrently — don't consume sequential time
- **Overflow**: "drop" (can't fit = removed) or "push" (pushes next slot forward)

#### Routines
- Wrap blocks with recurrence (daily/weekly/monthly)
- Set **ideal spawn time** (when the routine starts)
- **Per-task slot weights**: piecewise curves saying "this task has weight X during slot Y"
  - E.g., brush=0 during Work Hours (can't do it at office)

#### Day Planner
- **Day Plans**: pick which anchor template + routines apply
- **Week Planner**: assign day plans to weekdays

#### Obligations
- Deadline-driven task groups
- **Weight brackets**: different urgency curves based on days remaining
  - 30 days out: low priority, 5-7 PM only
  - 7 days: medium, 10AM-7PM
  - Last day: MONSTER priority, all day

#### Events
- Date-specific overrides (wedding, dinner)
- Can suspend regular tasks (obligations exempt)
- Can override the day plan

#### Recovery Plans
- Triggered (manual or auto) when tasks pile up
- Growth rate: weight increases per day pending
- Saturation limit: max weight cap

#### Rot
- Log wasted time manually
- Records which tasks were suspended
- Used to calibrate recovery intensity

---

### Tab: Dashboard

The scheduler resolves your week.

#### Timeline (top to bottom)
- **Anchor markers** (bold separators) — edit time inline to say "I actually woke at 8"
- **Tasks** — placed sequentially by weight. Shows time range + weight bar.

#### Actions per task
- **done** — opens time picker (defaults to virtual time). "Done at 7:15 AM" marks this + everything before it as done, shifts remaining tasks.
- **postpone** — removes from today
- **prepone** — move to an earlier/different time (picks new slot)
- **skip** — exclude from schedule
- **+above / +below** — insert any existing task before/after this one
- **undo** — on done/postponed tasks, reverts them

#### Top controls
- **Virtual Time slider** — simulate any time of day
- **Undo** — reverts last action
- **Reset** — clears all schedule state
- **+ Ad-hoc** — add a one-time task at a specific time
- **+ Insert** — search and insert any existing task
- **Recovery** — trigger/resolve recovery plans

#### How scheduling works
1. All tasks get weights from their sources (routine, obligation, recovery)
2. Sorted by weight — highest gets first pick of its ideal time
3. Conflicts: lower-weight task gets pushed to next available gap
4. Background tasks don't block — they overlay
5. Confirmed anchor time = "my day actually started here" → everything shifts

---

### Typical Daily Flow

1. **Morning**: Open dashboard. Edit Wake anchor time to actual wake time.
2. Tasks shift to match. Work through them — hit "done" with actual completion time.
3. **Mid-day interruption**: "+ Ad-hoc" to add surprise task. Schedule auto-adjusts.
4. **Skip something**: Hit "skip" — it disappears, rest fills the gap.
5. **Recovery needed**: Open Recovery panel, trigger "Grocery Run" — it inserts based on weight.
6. **End of day**: Anything not done either expired (obligation rules) or becomes sticky for tomorrow.

---

### Key Principles

- **Tasks are quanta** — fixed duration, never shrink. Either they happen or they don't.
- **Weight wins** — higher weight = gets scheduled first at its preferred time.
- **Stickiness resists displacement** — sticky tasks hold their slot even under pressure.
- **Anchors are just markers** — they mark time boundaries. The scheduler does the rest.
- **Everything is relative** — change one thing, everything downstream recalculates.
