import { useState, useEffect } from 'react'
import { useSchedulerStore } from '../store/schedulerStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import { useBlockStore } from '../store/blockStore'
import { useRoutineStore } from '../store/routineStore'
import { useObligationStore } from '../store/obligationStore'
import { useRecoveryStore } from '../store/recoveryStore'
import { usePlannerStore } from '../store/plannerStore'
import { formatTime } from '../types/anchor'
import { exportFullState, importFullState, downloadJSON, loadJSONFile, resetAllStores } from '../stateIO'
import type { AdhocTask, ScheduledItem } from '../types/scheduler'
import type { ResolveContext } from '../store/schedulerStore'

// --- Custom SVGs for a polished, cute look ---
const UndoIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
)

const ResetIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
  </svg>
)

const ClockIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const ActivityIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const PostponeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const SkipIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
const InfoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

function getCurrentMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function Dashboard() {
  const scheduler = useSchedulerStore()
  const { tasks } = useTaskStore()
  const { anchors, templates } = useAnchorStore()
  const { blocks } = useBlockStore()
  const { routines } = useRoutineStore()
  const { obligations } = useObligationStore()
  const { plans: recoveryPlans } = useRecoveryStore()
  const { dayPlans, weekPlan, calendarEvents } = usePlannerStore()

  const [selectedDay, setSelectedDay] = useState(0)
  const [showAdhocForm, setShowAdhocForm] = useState(false)
  const [showInsertForm, setShowInsertForm] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [showPrepone, setShowPrepone] = useState<string | null>(null)
  const [preponeTime, setPreponeTime] = useState('')
  const [showDoneAt, setShowDoneAt] = useState<string | null>(null)
  const [doneAtTime, setDoneAtTime] = useState('')
  const [showInsertAt, setShowInsertAt] = useState<{ taskId: string; position: 'above' | 'below' } | null>(null)
  const [showInfo, setShowInfo] = useState<string | null>(null)

  // Debug mode state
  const [showDebug, setShowDebug] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [debugTimeOverride, setDebugTimeOverride] = useState<number | null>(null)
  const [debugDateOverride, setDebugDateOverride] = useState<string | null>(null)

  // Live clock — auto-updates every 30 seconds
  const [currentTime, setCurrentTime] = useState(getCurrentMinutes)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getCurrentMinutes()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Virtual time: debug override or real clock
  const virtualTime = debugTimeOverride ?? currentTime

  const buildContext = (): ResolveContext => ({
    tasks: JSON.parse(JSON.stringify(tasks)),
    anchors: JSON.parse(JSON.stringify(anchors)),
    templates,
    blocks,
    routines,
    obligations,
    recoveryPlans,
    dayPlans,
    weekPlan: weekPlan.days,
    calendarEvents,
    baseDate: debugDateOverride ?? undefined,
    currentTimeMinutes: virtualTime,
  })

  useEffect(() => {
    scheduler.resolve(buildContext())
  }, [
    tasks,
    anchors,
    blocks,
    routines,
    obligations,
    recoveryPlans,
    dayPlans,
    weekPlan,
    calendarEvents,
    scheduler.confirmedAnchors,
    scheduler.adhocTasks,
    scheduler.skippedTaskIds,
    scheduler.postponedTasks,
    scheduler.lastDoneAt,
    debugDateOverride,
    virtualTime,
  ])

  const schedule = scheduler.schedule
  const daySchedule = schedule?.days[selectedDay]

  const maxWeight = daySchedule
    ? Math.max(...daySchedule.items.map((i) => i.weight), 1)
    : 1

  // Build timeline: interleave anchors + tasks + done items
  const timelineItems: { type: 'anchor' | 'task'; time: number; data: any }[] = []

  // Use resolved anchors from the schedule (they shift with overflow)
  if (daySchedule?.resolvedAnchors) {
    for (const ra of daySchedule.resolvedAnchors) {
      timelineItems.push({
        type: 'anchor',
        time: ra.actualTime,
        data: { id: ra.anchorId, name: ra.anchorName, spikeTime: ra.actualTime },
      })
    }
  }

  // Add done items
  const dayDoneItems = scheduler.doneItems.filter((i) => i.day === selectedDay)
  if (showCompleted) {
    for (const item of dayDoneItems) {
      timelineItems.push({ type: 'task', time: item.startMinutes, data: item })
    }
  }

  // Add active scheduled tasks (exclude done ones)
  if (daySchedule) {
    const dayDate = daySchedule.date ?? ''
    const pKey = dayDate.slice(0, 7) // YYYY-MM
    for (const item of daySchedule.items) {
      const isDoneRaw = scheduler.doneTasks.includes(item.taskId)
      const isDonePeriod = pKey && scheduler.doneTasks.includes(`${item.taskId}:${pKey}`)
      if (!isDoneRaw && !isDonePeriod) {
        timelineItems.push({ type: 'task', time: item.startMinutes, data: item })
      }
    }
  }

  // Sort by time
  timelineItems.sort((a, b) => a.time - b.time)

  return (
    <div className="space-y-6">
      {/* Clock + Recalculate + Controls */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg shadow-indigo-950/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-cyan-400 flex items-center justify-center border border-slate-800 shadow-inner">
              <ClockIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {debugTimeOverride !== null ? 'Debug Time' : 'Current Time'}
              </div>
              <div className={`font-mono text-2xl font-bold tracking-tight drop-shadow-[0_0_8px_rgba(34,211,238,0.25)] ${
                debugTimeOverride !== null ? 'text-amber-400' : 'text-cyan-400'
              }`}>
                {formatTime(virtualTime)}
              </div>
              {debugDateOverride && (
                <div className="text-[10px] text-amber-400/70 font-mono font-bold mt-0.5">
                  Date override: {debugDateOverride}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                scheduler.recalibrateFrom(virtualTime, selectedDay)
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/30 transition-all active:scale-95 cursor-pointer"
            >
              <ResetIcon />
              Recalculate
            </button>
            <button
              onClick={() => scheduler.undo()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-950/65 hover:bg-slate-900 text-slate-300 transition-all border border-slate-850 active:scale-95 cursor-pointer"
            >
              <UndoIcon />
              Undo
            </button>
            <button
              onClick={() => scheduler.clearSchedule()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-950/65 hover:bg-slate-900 text-rose-400 transition-all border border-slate-850 active:scale-95 cursor-pointer"
            >
              <TrashIcon />
              Reset
            </button>
            <button
              onClick={() => scheduler.toggleDebug()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border active:scale-95 cursor-pointer ${
                scheduler.debugMode
                  ? 'bg-amber-950/30 text-amber-400 border-amber-800/40'
                  : 'bg-slate-950/65 text-slate-500 border-slate-850 hover:bg-slate-900'
              }`}
            >
              🔍 {scheduler.debugMode ? 'Debug ON' : 'Debug'}
            </button>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border active:scale-95 cursor-pointer ${
                showCompleted
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                  : 'bg-slate-950/65 text-slate-500 border-slate-850 hover:bg-slate-900'
              }`}
            >
              ✓ {showCompleted ? 'Hide Done' : 'Show Done'}
              {dayDoneItems.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  showCompleted ? 'bg-emerald-800/40 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>{dayDoneItems.length}</span>
              )}
            </button>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer active:scale-95 ${
                showDebug
                  ? 'bg-amber-500/20 text-amber-400 border-amber-700/40 shadow-md shadow-amber-950/20'
                  : 'bg-slate-950/65 text-slate-500 border-slate-850 hover:text-slate-300'
              }`}
            >
              ⚙ Debug
            </button>
          </div>
        </div>

        {/* Collapsible Debug Panel */}
        {showDebug && (
          <div className="mt-4 pt-4 border-t border-amber-900/30 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest">Debug Controls</span>
              {(debugTimeOverride !== null || debugDateOverride !== null) && (
                <button
                  onClick={() => {
                    setDebugTimeOverride(null)
                    setDebugDateOverride(null)
                  }}
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer ml-2"
                >
                  Reset to live
                </button>
              )}
            </div>

            {/* Virtual Time Slider */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 flex items-center justify-between">
                <span>Virtual Time Override</span>
                <span className="font-mono text-amber-400/80 text-[11px]">
                  {debugTimeOverride !== null ? formatTime(debugTimeOverride) : 'Off (using live clock)'}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={1439}
                value={debugTimeOverride ?? currentTime}
                onChange={(e) => setDebugTimeOverride(Number(e.target.value))}
                className="w-full h-2 bg-slate-950 border border-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:59</span>
              </div>
            </div>

            {/* Date Override */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">Date Override</label>
              <input
                type="date"
                value={debugDateOverride ?? ''}
                onChange={(e) => setDebugDateOverride(e.target.value || null)}
                className="text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:outline-none cursor-pointer w-full max-w-xs"
              />
              <p className="text-[10px] text-slate-500">
                Override the base date used for schedule resolution. Affects which day plans, obligations, and recurrence rules activate.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* State Management */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2">State</span>
          <button
            onClick={() => {
              const snapshot = exportFullState()
              const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
              downloadJSON(snapshot, `to-live-state-${ts}.json`)
            }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-950/65 hover:bg-slate-900 text-emerald-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
          >
            ↓ Export State
          </button>
          <button
            onClick={async () => {
              try {
                const data = await loadJSONFile()
                if (confirm('This will replace ALL app state and reload. Continue?')) {
                  importFullState(data)
                }
              } catch (e: any) {
                if (e?.message !== 'No file selected') alert(e?.message ?? 'Import failed')
              }
            }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-950/65 hover:bg-slate-900 text-cyan-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
          >
            ↑ Import State
          </button>
          <button
            onClick={() => {
              const snapshot = exportFullState()
              snapshot._meta.type = 'defaults'
              downloadJSON(snapshot, 'to-live-defaults.json')
            }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-950/65 hover:bg-slate-900 text-indigo-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
          >
            ⬡ Save as Defaults
          </button>
          <button
            onClick={() => {
              if (confirm('Reset ALL stores to factory defaults? This cannot be undone.')) {
                resetAllStores()
              }
            }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-950/65 hover:bg-slate-900 text-rose-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
          >
            ✕ Reset Defaults
          </button>
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {schedule?.days.map((day, i) => {
          const isSelected = selectedDay === i
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`flex-none px-4 py-2.5 rounded-full text-xs font-bold tracking-wide transition-all active:scale-95 shadow-sm border cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white border-transparent shadow-md shadow-indigo-950/30'
                  : 'bg-slate-950/40 hover:bg-slate-900 text-slate-400 border-slate-900'
              }`}
            >
              {i === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
            </button>
          )
        }) ?? <div className="text-sm text-slate-500 animate-pulse py-2">Loading Week Planner...</div>}
      </div>

      {daySchedule && (
        <div className="space-y-6">
          {/* Day header & quick controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900/60 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-100">
                {daySchedule.dayPlanName}
              </h2>
              <div className="text-xs text-slate-450 mt-0.5 flex items-center gap-1.5">
                <CalendarIcon />
                {daySchedule.date}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowAdhocForm(!showAdhocForm)
                  setShowInsertForm(false)
                  setShowRecovery(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all border cursor-pointer ${
                  showAdhocForm
                    ? 'bg-cyan-500 border-transparent text-slate-950 shadow-md shadow-cyan-950/40'
                    : 'bg-cyan-950/20 text-cyan-400 hover:bg-cyan-950/40 border-cyan-800/30'
                }`}
              >
                <PlusIcon />
                Ad-hoc
              </button>
              <button
                onClick={() => {
                  setShowInsertForm(!showInsertForm)
                  setShowAdhocForm(false)
                  setShowRecovery(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all border cursor-pointer ${
                  showInsertForm
                    ? 'bg-cyan-500 border-transparent text-slate-950 shadow-md shadow-cyan-950/40'
                    : 'bg-cyan-950/20 text-cyan-400 hover:bg-cyan-950/40 border-cyan-800/30'
                }`}
              >
                <PlusIcon />
                Insert
              </button>
              <button
                onClick={() => {
                  setShowRecovery(!showRecovery)
                  setShowAdhocForm(false)
                  setShowInsertForm(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all border cursor-pointer ${
                  showRecovery
                    ? 'bg-rose-500 border-transparent text-white shadow-md shadow-rose-950/40'
                    : 'bg-rose-950/20 text-rose-450 hover:bg-rose-950/40 border-rose-800/30'
                }`}
              >
                <ActivityIcon />
                Recovery
              </button>
            </div>
          </div>

          {/* Conditional panels */}
          {showAdhocForm && (
            <div className="bg-slate-950/30 border border-slate-850 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <AdhocTaskForm
                day={selectedDay}
                onAdd={(task) => {
                  scheduler.addAdhocTask(task)
                  setShowAdhocForm(false)
                }}
                onCancel={() => setShowAdhocForm(false)}
              />
            </div>
          )}

          {showInsertForm && (
            <div className="bg-slate-950/30 border border-slate-850 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <InsertTaskForm
                tasks={tasks}
                onInsert={(taskId, startTime) => {
                  scheduler.insertTask(taskId, startTime, selectedDay)
                  setShowInsertForm(false)
                }}
                onCancel={() => setShowInsertForm(false)}
              />
            </div>
          )}

          {showRecovery && (
            <div className="bg-slate-950/30 border border-slate-850 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <RecoveryQuickPanel onClose={() => setShowRecovery(false)} />
            </div>
          )}

          {/* Timeline: anchors + tasks interleaved */}
          <div className="relative pl-6 ml-4 border-l-2 border-dashed border-slate-800 space-y-6">
            {timelineItems.length === 0 && (
              <p className="text-sm italic text-slate-500 py-4 pl-2">
                No items scheduled for today.
              </p>
            )}
            {timelineItems.map((entry, i) => {
              if (entry.type === 'anchor') {
                const anchor = entry.data as { id: string; name: string; spikeTime: number }
                const conf = daySchedule.confirmedAnchors.find((c) => c.anchorId === anchor.id)
                const displayTime = conf?.actualTime ?? anchor.spikeTime

                return (
                  <div
                    key={`anchor-${i}`}
                    className="relative group transition-all duration-300 hover:translate-x-1"
                  >
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center border-2 border-[#0b0f19] shadow-sm">
                      <ClockIcon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-950/10 border border-indigo-900/30 rounded-2xl p-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-900/40">
                          {formatTime(displayTime)}
                        </span>
                        <div>
                          <strong className="text-slate-200 font-semibold">{anchor.name}</strong>
                          {conf && (
                            <span className="text-[10px] text-indigo-455 font-bold ml-2 uppercase tracking-wider bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/20">
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          defaultValue={toTimeStr(displayTime)}
                          key={`anchor-input-${displayTime}`}
                          onBlur={(e) => {
                            if (e.target.value) {
                              const [h, m] = e.target.value.split(':').map(Number)
                              scheduler.confirmAnchor({
                                anchorId: anchor.id,
                                actualTime: (h || 0) * 60 + (m || 0),
                                day: selectedDay,
                              })
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-250 focus:ring-2 focus:ring-indigo-500/25 focus:outline-none w-28 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              // Task item
              const item: ScheduledItem = entry.data
              const dayDate = scheduler.schedule?.days[selectedDay]?.date ?? ''
              const periodKey = dayDate.slice(0, 7) // YYYY-MM
              const isDone = scheduler.doneTasks.includes(item.taskId) || scheduler.doneTasks.includes(`${item.taskId}:${periodKey}`)
              const isPostponed = scheduler.postponedTasks.includes(item.taskId)
              const isSkipped = scheduler.skippedTaskIds.includes(item.taskId)
              const isCurrent = virtualTime >= item.startMinutes && virtualTime < item.endMinutes
              const weightPct = Math.round((item.weight / maxWeight) * 100)

              let borderClass = 'border-slate-850 bg-slate-900/30'
              let glowDot = 'bg-slate-700'

              if (isCurrent) {
                borderClass = 'border-cyan-500/50 bg-cyan-950/10 shadow-lg shadow-cyan-950/15 ring-2 ring-cyan-500/10'
                glowDot = 'bg-cyan-400'
              } else if (isDone) {
                borderClass = 'border-slate-850/50 bg-slate-950/15 opacity-55'
                glowDot = 'bg-emerald-450'
              } else if (isSkipped) {
                borderClass = 'border-dashed border-slate-800/80 bg-slate-950/10 opacity-45'
                glowDot = 'bg-slate-600'
              } else if (isPostponed) {
                borderClass = 'border-slate-850/60 bg-slate-950/20 opacity-55'
                glowDot = 'bg-amber-400'
              }

              return (
                <div
                  key={`task-${item.taskId}-${i}`}
                  className="relative group transition-all duration-300 hover:translate-x-1"
                >
                  {/* Timeline node marker */}
                  <div className="absolute -left-[35px] top-4 w-6 h-6 rounded-full bg-slate-950 flex items-center justify-center border-2 border-slate-800 shadow-sm z-10">
                    <span className={`w-2.5 h-2.5 rounded-full ${glowDot}`} />
                    {isCurrent && (
                      <span className="absolute w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
                    )}
                  </div>

                  <div className={`border rounded-2xl p-4 shadow-sm transition-all duration-300 ${borderClass}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      
                      {/* Left: Weight, Time, and Title info */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Weight progress bar */}
                        <div className="w-12 h-2.5 bg-slate-950 border border-slate-850 rounded-full overflow-hidden relative shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.45)]"
                            style={{ width: `${weightPct}%` }}
                          />
                        </div>

                        {/* Start/End Time block */}
                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-950/60 border border-slate-850 px-2.5 py-1 rounded-lg">
                          {formatTime(item.startMinutes)}–{formatTime(item.endMinutes)}
                        </span>

                        {/* Title & Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/40 border border-cyan-850/30 shadow-[0_0_6px_rgba(34,211,238,0.15)] animate-pulse">
                              Now
                            </span>
                          )}
                          <span className={`font-semibold text-slate-202 ${item.isBackground ? 'italic text-slate-450' : ''} ${isDone ? 'line-through text-slate-500' : ''}`}>
                            {item.isBackground ? '☁️ ' : ''}
                            {item.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const key = `${item.taskId}-${item.startMinutes}`
                              setShowInfo(showInfo === key ? null : key)
                            }}
                            className="p-1 rounded bg-slate-950/65 hover:bg-slate-900 text-slate-400 hover:text-cyan-400 border border-slate-850 cursor-pointer"
                            title="Task Info Details"
                          >
                            <InfoIcon />
                          </button>
                          {isDone && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-950/35 text-emerald-400 border border-emerald-800/30">
                              Done
                            </span>
                          )}
                          {isPostponed && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-950/35 text-amber-400 border border-amber-800/30">
                              Postponed
                            </span>
                          )}
                          {isSkipped && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-950/40 text-slate-400 border border-slate-800/30">
                              Skipped
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-500 font-bold tracking-wide">
                          w:{Math.round(item.weight)}
                        </span>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap self-end lg:self-auto">
                        {!isDone && !isPostponed && !isSkipped && (
                          <>
                            <button
                              onClick={() => {
                                setShowDoneAt(showDoneAt === item.taskId ? null : item.taskId)
                                setDoneAtTime(toTimeStr(virtualTime))
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-950/30 hover:bg-emerald-900/30 text-emerald-400 border border-emerald-800/30 transition-all active:scale-95 cursor-pointer"
                            >
                              <CheckIcon />
                              Done
                            </button>
                            <button
                              onClick={() => scheduler.postpone(item.taskId)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-950/30 hover:bg-amber-900/30 text-amber-400 border border-amber-800/30 transition-all active:scale-95 cursor-pointer"
                            >
                              <PostponeIcon />
                              Postpone
                            </button>
                            <button
                              onClick={() => setShowPrepone(showPrepone === item.taskId ? null : item.taskId)}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-950/60 hover:bg-slate-900 text-slate-405 border border-slate-850 transition-all active:scale-95 cursor-pointer"
                            >
                              Prepone
                            </button>
                            <button
                              onClick={() => scheduler.skipTask(item.taskId)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-950/60 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
                            >
                              <SkipIcon />
                              Skip
                            </button>
                          </>
                        )}
                        {isSkipped && (
                          <button
                            onClick={() => scheduler.unskipTask(item.taskId)}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-950/80 hover:bg-slate-900 text-slate-300 transition-all border border-slate-850 active:scale-95 cursor-pointer"
                          >
                            Unskip
                          </button>
                        )}
                        {(isDone || isPostponed) && (
                          <button
                            onClick={() => scheduler.unmarkTask(item.taskId)}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-cyan-950/30 hover:bg-cyan-900/30 text-cyan-400 border border-cyan-800/30 transition-all active:scale-95 cursor-pointer"
                          >
                            Undo
                          </button>
                        )}
                        {item.source === 'adhoc' && (
                          <button
                            onClick={() => scheduler.removeAdhocTask(item.taskId)}
                            className="p-1 rounded-xl bg-rose-950/30 hover:bg-rose-900/30 text-rose-450 border border-rose-800/30 transition-all cursor-pointer"
                          >
                            <TrashIcon />
                          </button>
                        )}
                        <button
                          onClick={() => setShowInsertAt({ taskId: item.taskId, position: 'above' })}
                          className="p-1 px-1.5 rounded-xl bg-slate-950/40 hover:bg-slate-900 text-slate-400 transition-all flex items-center gap-0.5 border border-slate-850 cursor-pointer"
                          title="Insert above"
                        >
                          <ArrowUpIcon />
                          <span className="text-[9px]">above</span>
                        </button>
                        <button
                          onClick={() => setShowInsertAt({ taskId: item.taskId, position: 'below' })}
                          className="p-1 px-1.5 rounded-xl bg-slate-950/40 hover:bg-slate-900 text-slate-400 transition-all flex items-center gap-0.5 border border-slate-850 cursor-pointer"
                          title="Insert below"
                        >
                          <ArrowDownIcon />
                          <span className="text-[9px]">below</span>
                        </button>
                      </div>
                    </div>

                    {/* Conditional: Done at time picker */}
                    {showDoneAt === item.taskId && (
                      <div className="mt-3 ml-2 pl-4 border-l-2 border-emerald-450 flex flex-wrap gap-2 items-center bg-emerald-950/10 border border-emerald-900/20 p-3 rounded-xl">
                        <span className="text-xs font-bold text-slate-400">Done at:</span>
                        <input
                          type="time"
                          defaultValue={doneAtTime}
                          onChange={(e) => setDoneAtTime(e.target.value)}
                          className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                        />
                        <button
                          onClick={() => {
                            if (doneAtTime) {
                              const [h, m] = doneAtTime.split(':').map(Number)
                              scheduler.markDoneAt(item.taskId, (h || 0) * 60 + (m || 0), selectedDay)
                            } else {
                              scheduler.markDone(item.taskId)
                            }
                            setShowDoneAt(null)
                            setDoneAtTime('')
                          }}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg transition-all cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            scheduler.markDone(item.taskId)
                            setShowDoneAt(null)
                            setDoneAtTime('')
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-lg transition-all cursor-pointer"
                        >
                          Now
                        </button>
                        <button
                          onClick={() => {
                            setShowDoneAt(null)
                            setDoneAtTime('')
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-450 hover:text-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Conditional: Prepone form */}
                    {showPrepone === item.taskId && (
                      <div className="mt-3 ml-2 pl-4 border-l-2 border-indigo-400 flex flex-wrap gap-2 items-center bg-indigo-950/10 border border-indigo-900/20 p-3 rounded-xl">
                        <span className="text-xs font-bold text-slate-400">Move to:</span>
                        <input
                          type="time"
                          defaultValue={preponeTime}
                          onChange={(e) => setPreponeTime(e.target.value)}
                          className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                        />
                        <button
                          onClick={() => {
                            if (preponeTime) {
                              const [h, m] = preponeTime.split(':').map(Number)
                              scheduler.preponeTask(item.taskId, (h || 0) * 60 + (m || 0), selectedDay)
                              setShowPrepone(null)
                              setPreponeTime('')
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all cursor-pointer"
                        >
                          Move
                        </button>
                        <button
                          onClick={() => {
                            setShowPrepone(null)
                            setPreponeTime('')
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-450 hover:text-slate-200 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Conditional: Info Details */}
                    {showInfo === `${item.taskId}-${item.startMinutes}` && (
                      <div className="mt-3 p-3.5 bg-slate-950/80 border border-slate-850 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-850 pb-1.5 mb-1.5">
                          <span className="font-bold text-slate-205">Scheduling Metadata</span>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {item.taskId}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Source type</span>
                            <span className="text-slate-350 capitalize font-medium">{item.source}</span>
                          </div>
                          {item.sourceName && (
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Origin name</span>
                              <span className="text-slate-300 font-semibold">{item.sourceName}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Resolved weight</span>
                            <span className="text-cyan-405 font-mono font-bold">{Math.round(item.weight)}</span>
                          </div>
                          {item.sourceId && (
                            <div className="col-span-2">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Origin ID</span>
                              <span className="text-slate-400 font-mono text-[10px] break-all">{item.sourceId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Conditional: Insert above/below */}
                    {showInsertAt?.taskId === item.taskId && (
                      <div className="mt-3 bg-slate-950 border border-slate-850 rounded-xl p-3">
                        <InlineInsertForm
                          tasks={tasks}
                          targetTime={showInsertAt.position === 'above' ? item.startMinutes : item.endMinutes}
                          label={
                            showInsertAt.position === 'above'
                              ? `Insert above (@ ${formatTime(item.startMinutes)})`
                              : `Insert below (@ ${formatTime(item.endMinutes)})`
                          }
                          onInsert={(taskId, startTime) => {
                            scheduler.insertTask(taskId, startTime, selectedDay)
                            setShowInsertAt(null)
                          }}
                          onCancel={() => setShowInsertAt(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Inner Components Styled Beautifully ---

function AdhocTaskForm({
  day,
  onAdd,
  onCancel,
}: {
  day: number
  onAdd: (task: AdhocTask) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [weight, setWeight] = useState(100)

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
        <PlusIcon /> Add Ad-hoc Task
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          className="text-sm px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
        <div className="flex items-center gap-1.5 bg-slate-955 border border-slate-800 rounded-xl px-3 text-sm">
          <span className="text-slate-450 font-semibold">Starts:</span>
          <input
            type="time"
            defaultValue={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-transparent border-none text-slate-200 focus:outline-none p-1 cursor-pointer"
          />
        </div>
        <div className="flex items-center bg-slate-955 border border-slate-800 rounded-xl px-3.5 text-sm gap-2">
          <span className="text-slate-455 font-semibold whitespace-nowrap">Duration:</span>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 0)}
            className="w-full bg-transparent border-none text-slate-200 focus:outline-none p-1"
          />
          <span className="text-slate-405 text-xs font-semibold">min</span>
        </div>
        <div className="flex items-center bg-slate-955 border border-slate-800 rounded-xl px-3.5 text-sm gap-2">
          <span className="text-slate-455 font-semibold whitespace-nowrap">Weight:</span>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value) || 0)}
            className="w-full bg-transparent border-none text-slate-200 focus:outline-none p-1"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (title && startTime) {
              const [h, m] = startTime.split(':').map(Number)
              onAdd({
                id: crypto.randomUUID(),
                title,
                durationMinutes: duration,
                startTime: (h || 0) * 60 + (m || 0),
                day,
                weight,
              })
            }
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/40 transition-all active:scale-95 cursor-pointer"
        >
          Add Task
        </button>
      </div>
    </div>
  )
}

function InlineInsertForm({
  tasks,
  targetTime,
  onInsert,
  onCancel,
  label,
}: {
  tasks: { id: string; title: string; durationMinutes: number }[]
  targetTime: number
  label: string
  onInsert: (taskId: string, startTime: number) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-3">
      <span className="text-xs font-bold text-slate-400">{label}</span>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search registered tasks to insert..."
          className="w-full text-xs px-3.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none placeholder-slate-500"
        />
        {search && filtered.length > 0 && (
          <div className="absolute z-20 w-full mt-1.5 max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-1.5 divide-y divide-slate-850">
            {filtered.slice(0, 8).map((t) => (
              <div
                key={t.id}
                onClick={() => onInsert(t.id, targetTime)}
                className="px-3 py-2 text-xs text-slate-300 hover:text-cyan-400 hover:bg-slate-850/50 cursor-pointer rounded-lg font-bold transition-all"
              >
                {t.title} <span className="text-slate-500 font-normal text-[10px] ml-1.5">({t.durationMinutes} min)</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 text-[11px] font-semibold text-slate-450 hover:text-slate-200 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function InsertTaskForm({
  tasks,
  onInsert,
  onCancel,
}: {
  tasks: { id: string; title: string; durationMinutes: number }[]
  onInsert: (taskId: string, startTime: number) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [startTime, setStartTime] = useState('')

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
        <PlusIcon /> Insert Task
      </h3>
      
      {!selectedTaskId ? (
        <div className="space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search registered tasks..."
            className="w-full text-sm px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
          />
          {search && filtered.length > 0 && (
            <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-1.5 shadow-inner divide-y divide-slate-850">
              {filtered.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTaskId(t.id)
                    setSearch(t.title)
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-350 hover:text-cyan-400 hover:bg-slate-900 cursor-pointer rounded-lg transition-all"
                >
                  {t.title} <span className="text-slate-500 font-normal ml-1">({t.durationMinutes}min)</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-955 hover:bg-slate-900 text-slate-400 border border-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3.5 border border-slate-850 rounded-xl">
          <div className="text-sm font-semibold text-slate-300">
            Selected: <span className="text-cyan-400 font-bold">{search}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 text-xs">
              <span className="text-slate-450 font-semibold mr-1.5">Start at:</span>
              <input
                type="time"
                defaultValue={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-transparent border-none text-slate-200 focus:outline-none py-1.5 cursor-pointer"
              />
            </div>
            <button
              onClick={() => {
                if (startTime) {
                  const [h, m] = startTime.split(':').map(Number)
                  onInsert(selectedTaskId, (h || 0) * 60 + (m || 0))
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/40 transition-all active:scale-95 cursor-pointer"
            >
              Insert
            </button>
            <button
              onClick={() => {
                setSelectedTaskId('')
                setSearch('')
                setStartTime('')
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-450 hover:text-slate-250 hover:bg-slate-900 border border-slate-850 transition-all cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RecoveryQuickPanel({ onClose }: { onClose: () => void }) {
  const { plans, trigger, resolve } = useRecoveryStore()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
          <ActivityIcon /> Recovery Plans
        </h3>
        <button
          onClick={onClose}
          className="text-xs font-semibold text-slate-450 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-900 transition-all cursor-pointer"
        >
          Close
        </button>
      </div>

      <div className="space-y-2">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex justify-between items-center p-3 rounded-xl border border-slate-850 bg-slate-950/40 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-350">{plan.name}</span>
              {plan.triggered && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-950/35 text-rose-400 border border-rose-800/30 animate-pulse">
                  Active
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              {!plan.triggered ? (
                <button
                  onClick={() => trigger(plan.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/30 hover:bg-rose-900/30 text-rose-400 border border-rose-800/30 transition-all cursor-pointer"
                >
                  Trigger
                </button>
              ) : (
                <button
                  onClick={() => resolve(plan.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-950/30 hover:bg-cyan-900/30 text-cyan-400 border border-cyan-800/30 transition-all cursor-pointer"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <p className="text-xs italic text-slate-500 py-2">
            No recovery plans defined. Define one in the Manage tab.
          </p>
        )}
      </div>
    </div>
  )
}

function toTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default Dashboard
