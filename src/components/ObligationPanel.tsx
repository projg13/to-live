import { useState } from 'react'
import { useObligationStore } from '../store/obligationStore'
import { useTaskStore } from '../store/taskStore'
import type { Obligation, ObligationTask, WeightBracket, ObligationRecurrence, MonthlyRecurrenceType, WeekOfMonthSelection, DayOfWeekSelection } from '../types/obligation'
import { resolveObligationDeadline, getActiveBracket } from '../types/obligation'
import { formatTime } from '../types/anchor'

// Icons
const PlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

function ObligationPanel() {
  const { obligations, addObligation, updateObligation, deleteObligation, toggleEnabled, doneTasks: obligationDoneTasks, unmarkObligationDone, clearObligationDone } = useObligationStore()
  const { tasks } = useTaskStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Obligations</h3>
          <p className="text-xs text-slate-400">Tasks with rigid dates and dynamic urgency curves.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> New Obligation
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <ObligationEditor
            onSave={(o) => {
              addObligation(o)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {obligations.map((ob) => {
          if (editing === ob.id) {
            return (
              <div key={ob.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <ObligationEditor
                  initial={ob}
                  onSave={(updated) => {
                    updateObligation(ob.id, updated)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    deleteObligation(ob.id)
                    setEditing(null)
                  }}
                />
              </div>
            )
          }

          const today = new Date().toISOString().split('T')[0]
          const resolvedDeadline = resolveObligationDeadline(ob, today)
          const daysLeft = resolvedDeadline
            ? Math.ceil((new Date(resolvedDeadline).getTime() - new Date(today).getTime()) / 86400000)
            : null

          let daysBadge = null
          if (daysLeft !== null) {
            let badgeColor = 'bg-slate-950/60 text-slate-400 border-slate-850'
            if (daysLeft <= 0) {
              badgeColor = 'bg-rose-955/30 text-rose-400 border-rose-900/30 animate-pulse'
            } else if (daysLeft <= 3) {
              badgeColor = 'bg-rose-955/30 text-rose-400 border-rose-900/30'
            } else if (daysLeft <= 7) {
              badgeColor = 'bg-amber-955/35 text-amber-400 border-amber-900/30'
            }
            daysBadge = (
              <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColor}`}>
                {daysLeft <= 0 ? 'overdue' : `${daysLeft}d left`}
              </span>
            )
          }

          // Find active bracket for display
          const activeBracket = daysLeft !== null
            ? getActiveBracket(ob.weightBrackets, Math.max(0, daysLeft))
            : null

          return (
            <div
              key={ob.id}
              className={`flex justify-between items-center py-3.5 px-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm transition-all ${
                !ob.enabled ? 'opacity-40' : ''
              }`}
            >
              <div
                onClick={() => setEditing(ob.id)}
                className="cursor-pointer flex-1 space-y-1.5 pr-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-205 text-[15px]">
                    {ob.name}
                  </span>
                  {daysBadge}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  <span className="bg-slate-950/60 border border-slate-850 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono">
                    {ob.recurrence === 'monthly'
                      ? ob.monthlyType === 'relative'
                        ? `monthly (${ob.recurrenceWeekOfMonth} ${ob.recurrenceDayOfWeek})`
                        : `monthly (day ${ob.recurrenceDayOfMonth})`
                      : ob.recurrence}
                  </span>
                  <span>• {ob.tasks.length} task(s)</span>
                  <span>• {ob.weightBrackets.length} bracket(s)</span>
                </div>

                {/* Read-only deadline + weight info for recurring obligations */}
                {ob.recurrence !== 'one-time' && resolvedDeadline && (
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">
                    <span>📅 Next: {resolvedDeadline}</span>
                    {activeBracket && (
                      <span>⚖️ Bracket: ≤{activeBracket.maxDaysRemaining}d → peak {Math.max(...activeBracket.timeCurve.map(p => p.value))}w</span>
                    )}
                  </div>
                )}

                {/* Done tasks history */}
                {(() => {
                  const obDoneKeys = obligationDoneTasks.filter((k) => k.startsWith(`obligation:${ob.id}:`))
                  if (obDoneKeys.length === 0) return null
                  // Parse taskId from key format: obligation:obId::taskId:periodKey
                  const doneEntries = obDoneKeys.map((key) => {
                    const parts = key.split(':')
                    const taskId = parts[3] // obligation:obId::taskId → parts[3]
                    const periodKey = parts[4] ?? ''
                    const task = tasks.find((t) => t.id === taskId)
                    const instanceKey = parts.slice(0, 4).join(':')
                    return { key, taskId, taskName: task?.title ?? taskId.slice(0, 8), periodKey, instanceKey }
                  })
                  return (
                    <div className="mt-2 pt-2 border-t border-slate-850">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">✓ Done ({doneEntries.length})</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearObligationDone(ob.id) }}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/20 transition-all cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {doneEntries.map((d) => (
                          <span key={d.key} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400/80 bg-emerald-950/20 border border-emerald-900/20 px-2 py-0.5 rounded-lg">
                            {d.taskName}
                            <button
                              onClick={(e) => { e.stopPropagation(); unmarkObligationDone(d.instanceKey) }}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer ml-0.5"
                              title="Undo done"
                            >
                              ↩
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => toggleEnabled(ob.id)}
                className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 focus:outline-none ${
                  ob.enabled ? 'bg-cyan-500' : 'bg-slate-850'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                    ob.enabled ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
                  }`}
                />
              </button>
            </div>
          )
        })}

        {obligations.length === 0 && !creating && (
          <p className="text-sm italic text-slate-500 py-4">
            No obligations configured yet. Add obligations with dynamic weight bounds.
          </p>
        )}
      </div>
    </div>
  )
}

function ObligationEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Obligation
  onSave: (obligation: Obligation) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { tasks: allTasks } = useTaskStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [recurrence, setRecurrence] = useState<ObligationRecurrence>(initial?.recurrence ?? 'one-time')
  const [recurrenceMonth, setRecurrenceMonth] = useState(initial?.recurrenceMonth ?? 0)
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(initial?.recurrenceDayOfMonth ?? 1)
  const [monthlyType, setMonthlyType] = useState<MonthlyRecurrenceType>(initial?.monthlyType ?? 'specific-day')
  const [recurrenceWeekOfMonth, setRecurrenceWeekOfMonth] = useState<WeekOfMonthSelection>(initial?.recurrenceWeekOfMonth ?? 'first')
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<DayOfWeekSelection>(initial?.recurrenceDayOfWeek ?? 'monday')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [tasks, setTasks] = useState<ObligationTask[]>(initial?.tasks ?? [])
  const [brackets, setBrackets] = useState<WeightBracket[]>(initial?.weightBrackets ?? [])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      tasks,
      deadline: deadline || undefined,
      weightBrackets: brackets,
      recurrence,
      recurrenceMonth: (recurrence === 'yearly' || recurrence === 'quarterly' || recurrence === 'custom') ? recurrenceMonth : undefined,
      recurrenceDayOfMonth: recurrence === 'monthly' ? recurrenceDayOfMonth : undefined,
      monthlyType: recurrence === 'monthly' ? monthlyType : undefined,
      recurrenceWeekOfMonth: (recurrence === 'monthly' && monthlyType === 'relative') ? recurrenceWeekOfMonth : undefined,
      recurrenceDayOfWeek: (recurrence === 'monthly' && monthlyType === 'relative') ? recurrenceDayOfWeek : undefined,
      enabled,
    })
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Obligation Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tax Returns, Annual Checkup"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Deadline, Recurrence & Enabled Checkbox */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/30 p-3.5 rounded-xl border border-slate-800 flex-wrap">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Deadline Date
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            Recurrence
          </label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ObligationRecurrence)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none cursor-pointer"
          >
            <option className="bg-slate-950 text-slate-200" value="one-time">one-time</option>
            <option className="bg-slate-950 text-slate-200" value="monthly">monthly</option>
            <option className="bg-slate-950 text-slate-200" value="yearly">yearly</option>
            <option className="bg-slate-950 text-slate-200" value="quarterly">quarterly</option>
            <option className="bg-slate-950 text-slate-200" value="custom">custom</option>
          </select>
        </div>

        {recurrence === 'monthly' && (
          <div>
            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
              Monthly Type
            </label>
            <select
              value={monthlyType}
              onChange={(e) => setMonthlyType(e.target.value as MonthlyRecurrenceType)}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
            >
              <option className="bg-slate-950 text-slate-200" value="specific-day">Specific Day</option>
              <option className="bg-slate-950 text-slate-200" value="relative">Relative Day</option>
            </select>
          </div>
        )}

        {recurrence === 'monthly' && monthlyType === 'specific-day' && (
          <div>
            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
              Day of Month
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={recurrenceDayOfMonth}
              onChange={(e) => setRecurrenceDayOfMonth(Number(e.target.value) || 1)}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
            />
          </div>
        )}

        {(recurrence === 'yearly' || recurrence === 'quarterly' || recurrence === 'custom') && (
          <div>
            <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
              Start Month
            </label>
            <select
              value={recurrenceMonth}
              onChange={(e) => setRecurrenceMonth(Number(e.target.value))}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
            >
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
                <option className="bg-slate-950 text-slate-200" key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        {recurrence === 'monthly' && monthlyType === 'relative' && (
          <div className="grid grid-cols-2 gap-3 col-span-1 sm:col-span-3 mt-1.5 border-t border-slate-800/40 pt-3">
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
                Week of Month
              </label>
              <select
                value={recurrenceWeekOfMonth}
                onChange={(e) => setRecurrenceWeekOfMonth(e.target.value as WeekOfMonthSelection)}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-305 focus:outline-none cursor-pointer"
              >
                <option className="bg-slate-950 text-slate-200" value="first">first</option>
                <option className="bg-slate-950 text-slate-200" value="second">second</option>
                <option className="bg-slate-950 text-slate-200" value="third">third</option>
                <option className="bg-slate-950 text-slate-200" value="fourth">fourth</option>
                <option className="bg-slate-950 text-slate-200" value="last">last</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
                Day of Week
              </label>
              <select
                value={recurrenceDayOfWeek}
                onChange={(e) => setRecurrenceDayOfWeek(e.target.value as DayOfWeekSelection)}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-305 focus:outline-none cursor-pointer"
              >
                <option className="bg-slate-950 text-slate-200" value="monday">Monday</option>
                <option className="bg-slate-950 text-slate-200" value="tuesday">Tuesday</option>
                <option className="bg-slate-950 text-slate-200" value="wednesday">Wednesday</option>
                <option className="bg-slate-950 text-slate-200" value="thursday">Thursday</option>
                <option className="bg-slate-950 text-slate-200" value="friday">Friday</option>
                <option className="bg-slate-950 text-slate-200" value="saturday">Saturday</option>
                <option className="bg-slate-950 text-slate-200" value="sunday">Sunday</option>
                <option className="bg-slate-950 text-slate-200" value="weekday">Weekday (Mon-Fri)</option>
                <option className="bg-slate-950 text-slate-200" value="weekend-day">Weekend day (Sat-Sun)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 p-2 bg-slate-900/30 border border-slate-800 rounded-xl max-w-xs">
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-700 bg-slate-955 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
          />
          Active Enabled Status
        </label>
      </div>

      {/* Tasks in Obligation */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Spawned Tasks
        </span>
        
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {tasks.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-slate-950/60 border border-slate-850 p-2 rounded-xl"
            >
              <span className="font-mono text-xs font-bold text-slate-500 w-5 text-center">
                {t.order + 1}.
              </span>
              <select
                value={t.taskId}
                onChange={(e) => {
                  const updated = [...tasks]
                  updated[i] = { ...updated[i], taskId: e.target.value }
                  setTasks(updated)
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer flex-1 min-w-[150px]"
              >
                <option value="">-- select task --</option>
                {allTasks.map((at) => (
                  <option key={at.id} value={at.id}>
                    {at.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setTasks(tasks.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer"
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setTasks([...tasks, { taskId: '', order: tasks.length }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-850 transition-all cursor-pointer"
        >
          <PlusIcon /> Add Task
        </button>
      </div>

      {/* Weight Brackets (Urgency Dynamics) */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Weight Brackets (Urgency Curves by Days Remaining)
        </span>
        
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {brackets
            .sort((a, b) => a.maxDaysRemaining - b.maxDaysRemaining)
            .map((bracket, bi) => (
              <div
                key={bi}
                className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl space-y-3"
              >
                <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span className="font-semibold text-slate-500">Trigger when days left &le;</span>
                    <input
                      type="number"
                      value={bracket.maxDaysRemaining}
                      onChange={(e) => {
                        const updated = [...brackets]
                        updated[bi] = { ...updated[bi], maxDaysRemaining: Number(e.target.value) || 0 }
                        setBrackets(updated)
                      }}
                      className="w-14 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded font-semibold text-center text-slate-205 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => setBrackets(brackets.filter((_, j) => j !== bi))}
                    className="p-1 rounded-lg text-rose-400 hover:bg-rose-955/20 transition-all cursor-pointer"
                  >
                    <TrashIcon />
                  </button>
                </div>

                {/* Time curve within this bracket */}
                <div className="space-y-1.5 pl-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Weight values by time of day:
                  </span>
                  {bracket.timeCurve.map((pt, pi) => (
                    <div key={pi} className="flex items-center gap-1.5 text-xs flex-wrap">
                      <span className="font-mono text-slate-500 w-10">{formatTime(pt.time)}</span>
                      <input
                        type="time"
                        value={toTimeStr(pt.time)}
                        onChange={(e) => {
                          const updated = [...brackets]
                          const curve = [...updated[bi].timeCurve]
                          curve[pi] = { ...curve[pi], time: fromTimeStr(e.target.value) }
                          updated[bi] = { ...updated[bi], timeCurve: curve }
                          setBrackets(updated)
                        }}
                        className="text-xs px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-205 cursor-pointer focus:outline-none"
                      />
                      <span className="text-slate-500 font-bold">=</span>
                      <input
                        type="number"
                        value={pt.value}
                        onChange={(e) => {
                          const updated = [...brackets]
                          const curve = [...updated[bi].timeCurve]
                          curve[pi] = { ...curve[pi], value: Number(e.target.value) || 0 }
                          updated[bi] = { ...updated[bi], timeCurve: curve }
                          setBrackets(updated)
                        }}
                        className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-202 font-semibold focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          const updated = [...brackets]
                          updated[bi] = {
                            ...updated[bi],
                            timeCurve: updated[bi].timeCurve.filter((_, j) => j !== pi),
                          }
                          setBrackets(updated)
                        }}
                        className="p-1 rounded text-slate-500 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer"
                      >
                        <XIcon />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => {
                      const updated = [...brackets]
                      const last = bracket.timeCurve[bracket.timeCurve.length - 1]
                      updated[bi] = {
                        ...updated[bi],
                        timeCurve: [...updated[bi].timeCurve, { time: (last?.time ?? 0) + 60, value: 0 }],
                      }
                      setBrackets(updated)
                    }}
                    className="text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer mt-1"
                  >
                    <PlusIcon /> Add time point
                  </button>
                </div>
              </div>
            ))}
        </div>
        
        <button
          onClick={() =>
            setBrackets([...brackets, { maxDaysRemaining: 30, timeCurve: [{ time: 600, value: 50 }] }])
          }
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-slate-350 border border-slate-850 transition-all cursor-pointer mt-1"
        >
          <PlusIcon /> Add Bracket
        </button>
      </div>

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Obligation
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-955 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all cursor-pointer"
          >
            Discard
          </button>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-955/35 hover:bg-rose-900/30 text-rose-455 border border-rose-800/30 transition-all cursor-pointer"
          >
            <TrashIcon /> Delete
          </button>
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

function fromTimeStr(str: string): number {
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export default ObligationPanel
