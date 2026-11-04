import { useState, useEffect } from 'react'
import AnchorPanel from './components/AnchorPanel'
import AdhocPanel from './components/AdhocPanel'
import Dashboard from './components/Dashboard'
import TaskPanel from './components/TaskPanel'
import BlockPanel from './components/BlockPanel'
import RoutinePanel from './components/RoutinePanel'
import ObligationPanel from './components/ObligationPanel'
import DayPlannerPanel from './components/DayPlannerPanel'
import EventPanel from './components/EventPanel'
import RecoveryPanel from './components/RecoveryPanel'
import RotPanel from './components/RotPanel'
import SettingsPanel from './components/SettingsPanel'
import MenuPanel from './components/MenuPanel'
import { useSchedulerStore } from './store/schedulerStore'
import { useTaskStore } from './store/taskStore'
import { useRoutineStore } from './store/routineStore'
import { useBlockStore } from './store/blockStore'
import { useRecoveryStore } from './store/recoveryStore'
import { formatTime } from './types/anchor'
import { getDateStr } from './engine/solver'
import { loadDemoPresetIntoStores } from './migration'

interface ManageItem {
  id: string
  label: string
  icon: string
  category: 'core' | 'schedule' | 'resilience'
}

const manageItems: ManageItem[] = [
  // Building Blocks
  { id: 'Anchors', label: 'Anchors & Slots', icon: '🎯', category: 'core' },
  { id: 'Tasks', label: 'Task Templates', icon: '⚡', category: 'core' },
  { id: 'Blocks', label: 'Blocks (DAG)', icon: '⏱️', category: 'core' },
  { id: 'Routines', label: 'Routines (Slots)', icon: '🔄', category: 'core' },
  // Schedules & Events
  { id: 'Day Planner', label: 'Day Planner', icon: '📅', category: 'schedule' },
  { id: 'Obligations', label: 'Obligations', icon: '📋', category: 'schedule' },
  { id: 'Events', label: 'Events', icon: '🗓️', category: 'schedule' },
  { id: 'Ad Hoc', label: 'Ad Hoc', icon: '⏳', category: 'schedule' },
  // System & Resilience
  { id: 'Recovery Plans', label: 'Recovery Plans', icon: '🛡️', category: 'resilience' },
  { id: 'Rot', label: 'Rot Track', icon: '🍂', category: 'resilience' },
  { id: 'Settings', label: 'Settings', icon: '⚙️', category: 'resilience' },
]

type ManagePanel = (typeof manageItems)[number]['id']

function getLiveMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function toTimeInputStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function App() {
  const [tab, setTab] = useState<'dashboard' | 'manage' | 'menu'>('dashboard')
  const [activePanel, setActivePanel] = useState<ManagePanel>('Routines')
  const [isPlayingSim, setIsPlayingSim] = useState(false)
  const [demoStep, setDemoStep] = useState<number>(0)
  const [demoBanner, setDemoBanner] = useState<string | null>(null)
  const [autoWalkthrough, setAutoWalkthrough] = useState(false)

  const scheduler = useSchedulerStore()
  const {
    debugMode,
    toggleDebug,
    debugDateOverride,
    debugTimeOverride,
    setDebugDateOverride,
    setDebugTimeOverride,
  } = scheduler

  const [liveMins, setLiveMins] = useState(getLiveMinutes)
  useEffect(() => {
    const t = setInterval(() => setLiveMins(getLiveMinutes()), 15000)
    return () => clearInterval(t)
  }, [])

  // Optional 60x Realtime Play mode (advances simulated time by +5m every 400ms)
  useEffect(() => {
    if (!isPlayingSim) return
    const t = setInterval(() => {
      const cur = useSchedulerStore.getState().debugTimeOverride ?? getLiveMinutes()
      const next = (cur + 5) % 1440
      useSchedulerStore.getState().setDebugTimeOverride(next)
    }, 400)
    return () => clearInterval(t)
  }, [isPlayingSim])

  const executeLiveDemoStep = (stepNumber: number) => {
    setTab('dashboard')
    setDemoStep(stepNumber)
    const sched = useSchedulerStore.getState()

    if (stepNumber === 1) {
      loadDemoPresetIntoStores('user_migrated')
      useSchedulerStore.getState().clearSchedule()
      useSchedulerStore.getState().setDebugDateOverride('2026-11-04')
      useSchedulerStore.getState().setDebugTimeOverride(420) // 07:00 AM
      setDemoBanner(
        '🌅 Step 1 (07:00 AM Baseline): Loaded your migrated Mon/Wed schedule at 07:00 AM. Brush (07:00–07:10, W=900) leads the Morning slot, followed by Drink Protien (07:10–07:20, W=99), Bath (07:40–08:00), Sandhi (08:00–08:20), Cook (Breakfast) (08:20–09:20), and Breakfast (09:20–09:35).'
      )
    } else if (stepNumber === 2) {
      // Mark the first two morning tasks Done at 07:25 AM
      const currentItems = sched.schedule?.days[0]?.items ?? []
      const brushItem = currentItems.find((i) => i.title.toLowerCase().includes('brush'))
      const protienItem = currentItems.find((i) => i.title.toLowerCase().includes('protien'))
      if (brushItem) useSchedulerStore.getState().markDoneAt(brushItem.instanceKey, 430, 0)
      if (protienItem) useSchedulerStore.getState().markDoneAt(protienItem.instanceKey, 445, 0)
      useSchedulerStore.getState().setDebugTimeOverride(445) // 07:25 AM
      setDemoBanner(
        '✅ Step 2 (Mark Done @ 07:25 AM): Marked "Brush" and "Drink Protien" ✓ Done! They move into Completed items, lastDoneAt advances to 07:25 AM, and remaining morning tasks stay cleanly aligned.'
      )
    } else if (stepNumber === 3) {
      // Jump to 10:45 AM (645): Sandhi expires and drops; Rent obligation (trapezoid ramp W=234) preempts Work (W=100)
      useSchedulerStore.getState().setDebugDateOverride('2026-11-04')
      useSchedulerStore.getState().setDebugTimeOverride(645) // 10:45 AM
      setDemoBanner(
        '⏰ Step 3 (Jump to 10:45 AM — Expiry Drop & Rent Obligation): At 10:45 AM, morning tasks past their expiry window automatically drop! Meanwhile, the "Rent" obligation climbs its trapezoid time curve to W=234..401, preempting "Work" (W=100) and scheduling right before Work!'
      )
    } else if (stepNumber === 4) {
      // Inject a high-weight Ad-Hoc task that compresses Work
      useSchedulerStore.getState().addAdhocTask({
        id: 'demo-live-adhoc',
        title: '🚨 Urgent Production Incident (Live Ad-Hoc)',
        day: 0,
        startTime: 690, // 11:30 AM
        durationMinutes: 45,
        weight: 550,
      })
      useSchedulerStore.getState().setDebugTimeOverride(645)
      setDemoBanner(
        '🚨 Step 4 (Live Ad-Hoc Preemption & Shrinkage): Injected "Urgent Production Incident (Live Ad-Hoc)" at 11:30 AM (45m, W=550). It preempts the midday slot and compresses flexible Work duration toward its minDurationMinutes floor so evening tasks still fit!'
      )
    } else if (stepNumber === 5) {
      // Create a Task Template & customize it in Morning/Evening Routine with Relative Weight +50
      const tplId = 'demo-tpl-breathwork'
      const taskStore = useTaskStore.getState()
      if (!taskStore.tasks.some((t) => t.id === tplId)) {
        taskStore.addTask({
          id: tplId,
          title: 'Breathwork Template',
          weight: 100,
          durationMinutes: 30,
          knobs: { isMother: false, hasWeightCurve: false, hasExpiry: false },
        })
      }
      const routineStore = useRoutineStore.getState()
      const blockStore = useBlockStore.getState()
      const morningRoutine = routineStore.routines.find((r) => r.name.includes('Morning'))
      if (morningRoutine && morningRoutine.blockConfigs.length > 0) {
        const bId = morningRoutine.blockConfigs[0].blockId
        const blk = blockStore.blocks.find((b) => b.id === bId)
        if (blk && !blk.entries.some((e) => e.taskId === tplId)) {
          blockStore.updateBlock(bId, {
            entries: [
              ...blk.entries,
              { taskId: tplId, order: blk.entries.length, isBackground: false },
            ],
          })
        }
        const existingConfigs = (morningRoutine.taskConfigs ?? []).filter(
          (tc) => tc.taskId !== tplId
        )
        routineStore.updateRoutine(morningRoutine.id, {
          baseWeight: 100,
          taskConfigs: [
            ...existingConfigs,
            {
              taskId: tplId,
              titleOverride: '🧘 15m Custom Slot Breathwork (Rel +50)',
              durationMinutes: 15,
              minDurationMinutes: 10,
              relativeWeight: 50,
            },
          ],
        })
      }
      useSchedulerStore.getState().setDebugTimeOverride(445)
      setDemoBanner(
        '🎛️ Step 5 (Task Template + Routine Slot Customization): Created "Breathwork Template" (default 30m, W=100) and customized it in the Morning Routine to "🧘 15m Custom Slot Breathwork (Rel +50)" (15m, min 10m, Eff W=150). Look at 07:25 AM on the timeline—it immediately leads the race!'
      )
    } else if (stepNumber === 6) {
      // Trigger Recovery Plan & jump date forward
      const recStore = useRecoveryStore.getState()
      if (recStore.plans.length > 0) {
        recStore.trigger(recStore.plans[0].id)
      }
      setDemoBanner(
        '🛡️ Step 6 (Recovery Plan Triggered): Triggered your Recovery Plan! High-priority [R] recovery tasks are dynamically injected into the active day window to restore momentum.'
      )
    }
  }

  // Auto-walkthrough player (steps 1 -> 6 every 3.2 seconds)
  useEffect(() => {
    if (!autoWalkthrough) return
    const nextStep = demoStep < 1 || demoStep >= 6 ? 1 : demoStep + 1
    executeLiveDemoStep(nextStep)
    const timer = setInterval(() => {
      setDemoStep((prev) => {
        const next = prev >= 6 ? 1 : prev + 1
        executeLiveDemoStep(next)
        if (next === 6) setAutoWalkthrough(false)
        return next
      })
    }, 3200)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWalkthrough])

  const activeTimeMins = debugTimeOverride ?? liveMins
  const activeDateStr = debugDateOverride ?? getDateStr(0)
  const isSimulated = debugDateOverride !== null || debugTimeOverride !== null

  const shiftDateByDays = (delta: number) => {
    const d = new Date(activeDateStr + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setDebugDateOverride(`${y}-${m}-${day}`)
  }

  const shiftTimeByMins = (delta: number) => {
    const next = Math.max(0, Math.min(1439, activeTimeMins + delta))
    setDebugTimeOverride(next)
  }

  const categories = [
    { key: 'core', title: 'Templates & Slot Bearers' },
    { key: 'schedule', title: 'Schedules & Deadlines' },
    { key: 'resilience', title: 'Resilience & System' },
  ] as const

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans pb-12 transition-colors duration-300">
      {/* Top Segmented Controls + Live / Debug Date & Time Simulator Bar */}
      <header className="border-b border-slate-900/80 bg-[#0b0f19]/90 backdrop-blur-xl sticky top-0 z-30 px-4 py-2.5 shadow-sm shadow-slate-950/40 space-y-2">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <nav className="flex p-1 bg-slate-950/90 rounded-2xl border border-slate-800/80 shadow-inner flex-1 max-w-md">
            <button
              onClick={() => setTab('dashboard')}
              className={`flex-1 py-1.5 px-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                tab === 'dashboard'
                  ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-750'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <span>📊</span> Dashboard
            </button>
            <button
              onClick={() => setTab('manage')}
              className={`flex-1 py-1.5 px-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                tab === 'manage'
                  ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-750'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <span>🎛️</span> Manage
            </button>
            <button
              onClick={() => setTab('menu')}
              className={`flex-1 py-1.5 px-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                tab === 'menu'
                  ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-750'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <span>🥗</span> Menu
            </button>
          </nav>

          {/* Compact Clock Pill + Debug Bar Toggle */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                isSimulated
                  ? 'bg-amber-950/40 border-amber-700/50 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-cyan-400'
              }`}
            >
              <span>{isSimulated ? '🧪 SIM' : '🟢 LIVE'}</span>
              <span>{activeDateStr}</span>
              <span>•</span>
              <span>{formatTime(activeTimeMins)}</span>
            </div>
            <button
              onClick={() => {
                setTab('manage')
                setActivePanel('Settings')
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-700/50 text-emerald-300 transition-all cursor-pointer"
            >
              🚀 Push to GitHub
            </button>
            <button
              onClick={() => toggleDebug()}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                debugMode
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ⏱️ {debugMode ? 'Hide Sim Bar' : 'Time & Date Sim'}
            </button>
          </div>
        </div>

        {/* Live Interactive Date & Time Simulator Bar */}
        {debugMode && (
          <div className="max-w-6xl mx-auto bg-slate-950/90 border border-slate-800/90 rounded-2xl px-3.5 py-2.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Simulator Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
                  📅 Date:
                </span>
                <button
                  type="button"
                  onClick={() => shiftDateByDays(-1)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono font-bold cursor-pointer"
                >
                  -1d
                </button>
                <input
                  type="date"
                  value={activeDateStr}
                  onChange={(e) => setDebugDateOverride(e.target.value || null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-300 font-mono text-xs focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => shiftDateByDays(1)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono font-bold cursor-pointer"
                >
                  +1d
                </button>
              </div>

              {/* Time Simulator Controls + Scrubber */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[260px] flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  ⏰ Time:
                </span>
                <button
                  type="button"
                  onClick={() => shiftTimeByMins(-30)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono font-bold cursor-pointer"
                >
                  -30m
                </button>
                <input
                  type="time"
                  value={toTimeInputStr(activeTimeMins)}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const [h, m] = e.target.value.split(':').map(Number)
                    setDebugTimeOverride((h || 0) * 60 + (m || 0))
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => shiftTimeByMins(15)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono font-bold cursor-pointer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => shiftTimeByMins(60)}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono font-bold cursor-pointer"
                >
                  +1h
                </button>

                <input
                  type="range"
                  min={0}
                  max={1439}
                  value={activeTimeMins}
                  onChange={(e) => setDebugTimeOverride(Number(e.target.value))}
                  className="flex-1 min-w-[110px] h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  title="Scrub time of day (00:00 - 23:59) in real time"
                />
              </div>

              {/* Play 60x & Reset to Live Clock */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlayingSim(!isPlayingSim)}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                    isPlayingSim
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-emerald-400'
                  }`}
                >
                  {isPlayingSim ? '⏸ Pause Clock' : '▶ Scrub 60x'}
                </button>
                {isSimulated && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlayingSim(false)
                      setAutoWalkthrough(false)
                      setDemoBanner(null)
                      setDebugDateOverride(null)
                      setDebugTimeOverride(null)
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 font-bold cursor-pointer"
                  >
                    ↺ Live Clock
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Live Demo Walkthrough Strip */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 mr-1">
                  🎬 Live Demo Actions:
                </span>
                {[
                  { step: 1, label: '1. 07:00 Baseline' },
                  { step: 2, label: '2. Mark Done @ 07:25' },
                  { step: 3, label: '3. 10:45 Expiry + Rent Obligation' },
                  { step: 4, label: '4. Inject Ad-Hoc & Shrink Work' },
                  { step: 5, label: '5. Custom Template Slot (+50W)' },
                  { step: 6, label: '6. Trigger Recovery Plan' },
                ].map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      setAutoWalkthrough(false)
                      executeLiveDemoStep(s.step)
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      demoStep === s.step
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAutoWalkthrough(!autoWalkthrough)}
                className={`px-3 py-1 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                  autoWalkthrough
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                }`}
              >
                {autoWalkthrough ? '⏹ Stop Auto-Demo' : '▶ Auto-Play All 6 Steps'}
              </button>
            </div>

            {demoBanner && (
              <div className="bg-amber-950/30 border border-amber-700/40 text-amber-200 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2">
                <span>{demoBanner}</span>
                <button
                  type="button"
                  onClick={() => setDemoBanner(null)}
                  className="text-amber-400 hover:text-amber-200 font-bold px-1.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full text-base">
        {tab === 'dashboard' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Dashboard />
          </div>
        )}

        {tab === 'manage' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Mobile Scrollable Horizontal Bar */}
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar p-1.5 bg-slate-950/80 rounded-2xl border border-slate-850">
              {manageItems.map((item) => {
                const isActive = activePanel === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePanel(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Desktop 2-Column Sidebar Layout */}
            <div className="md:grid md:grid-cols-[220px_1fr] gap-6 items-start">
              {/* Left Sidebar Navigation */}
              <aside className="hidden md:flex flex-col gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-3.5 sticky top-36 shadow-lg shadow-slate-950/20">
                {categories.map((cat) => (
                  <div key={cat.key} className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2.5 block">
                      {cat.title}
                    </span>
                    <div className="space-y-0.5">
                      {manageItems
                        .filter((item) => item.category === cat.key)
                        .map((item) => {
                          const isActive = activePanel === item.id
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActivePanel(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer relative ${
                                isActive
                                  ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/50 shadow-sm shadow-cyan-950/30'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
                              }`}
                            >
                              <span className="text-sm">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-auto shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                              )}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </aside>

              {/* Main Panel View Card */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-950/20 min-w-0">
                {activePanel === 'Anchors' && <AnchorPanel />}
                {activePanel === 'Ad Hoc' && <AdhocPanel />}
                {activePanel === 'Day Planner' && <DayPlannerPanel />}
                {activePanel === 'Tasks' && <TaskPanel />}
                {activePanel === 'Blocks' && <BlockPanel />}
                {activePanel === 'Routines' && <RoutinePanel />}
                {activePanel === 'Obligations' && <ObligationPanel />}
                {activePanel === 'Events' && <EventPanel />}
                {activePanel === 'Recovery Plans' && <RecoveryPanel />}
                {activePanel === 'Rot' && <RotPanel />}
                {activePanel === 'Settings' && <SettingsPanel />}
              </div>
            </div>
          </div>
        )}

        {tab === 'menu' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MenuPanel />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
