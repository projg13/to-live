import { useState } from 'react'
import { useSchedulerStore } from '../store/schedulerStore'
import { useTaskStore } from '../store/taskStore'

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const dayLabels = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const mins = m % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`
}

function toTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fromTimeStr(str: string): number {
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function AdhocPanel() {
  const { adhocTasks, addAdhocTask, updateAdhocTask, removeAdhocTask } = useSchedulerStore()
  const { tasks } = useTaskStore()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // New Adhoc Form state
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(0)
  const [startTime, setStartTime] = useState(600) // 10:00 AM
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [weight, setWeight] = useState(200)
  const [fixedEndTime, setFixedEndTime] = useState<number | undefined>(undefined)

  const handleCreate = () => {
    if (!title.trim() || durationMinutes <= 0) return
    addAdhocTask({
      id: crypto.randomUUID(),
      title: title.trim(),
      day,
      startTime,
      durationMinutes,
      weight,
      fixedEndTime,
    })
    setTitle('')
    setCreating(false)
  }

  // Group by day
  const tasksByDay = adhocTasks.reduce<Record<number, typeof adhocTasks>>((acc, task) => {
    if (!acc[task.day]) acc[task.day] = []
    acc[task.day].push(task)
    return acc
  }, {})

  const sortedDays = Object.keys(tasksByDay)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Ad Hoc Tasks</h3>
          <p className="text-xs text-slate-400">
            Inject on-the-fly tasks (or instantiate a Task Template) at a specific time and weight.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/20 transition-all cursor-pointer"
          >
            <PlusIcon /> New Ad Hoc Task
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Inject Ad Hoc Task (or Load From Template)
            </span>
            <select
              value=""
              onChange={(e) => {
                const tpl = tasks.find((t) => t.id === e.target.value)
                if (!tpl) return
                setTitle(tpl.title)
                setDurationMinutes(tpl.durationMinutes || 30)
                setWeight((tpl.weight || 100) * 2)
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 cursor-pointer"
            >
              <option value="">⚡ Fill from Task Template…</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.durationMinutes || 30}m)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Doctor Appointment, Urgent Call"
                className="text-xs px-3 py-2 w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Day</label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="text-xs px-3 py-2 w-full bg-slate-900 border border-slate-800 rounded-xl text-slate-200 cursor-pointer"
              >
                {dayLabels.map((lbl, idx) => (
                  <option key={idx} value={idx}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start Time</label>
              <input
                type="time"
                value={toTimeStr(startTime)}
                onChange={(e) => setStartTime(fromTimeStr(e.target.value))}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Duration (m)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 15)}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-cyan-400 uppercase block mb-1">Weight</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value) || 100)}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-cyan-900/40 rounded-lg text-cyan-300 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-amber-400 uppercase block mb-1">Hard End (opt)</label>
              <input
                type="time"
                value={fixedEndTime !== undefined ? toTimeStr(fixedEndTime) : ''}
                onChange={(e) =>
                  setFixedEndTime(e.target.value ? fromTimeStr(e.target.value) : undefined)
                }
                className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-amber-900/40 rounded-lg text-amber-300"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 cursor-pointer"
            >
              Inject Task
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {adhocTasks.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm font-semibold text-slate-500">No ad hoc tasks active.</p>
          <p className="text-xs text-slate-600 mt-1">
            Click "New Ad Hoc Task" above or "+ Ad-hoc" on the Dashboard timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedDays.map((dayIndex) => (
            <div key={dayIndex} className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />
                {dayLabels[dayIndex] ?? `Day ${dayIndex + 1}`}
                <span className="text-slate-600 font-mono">({tasksByDay[dayIndex].length})</span>
              </h4>
              <div className="space-y-2">
                {tasksByDay[dayIndex]
                  .sort((a, b) => a.startTime - b.startTime)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col gap-2 bg-slate-900/40 border border-slate-850 p-3.5 rounded-2xl hover:border-slate-700 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <h5 className="text-sm font-bold text-slate-200 truncate">{task.title}</h5>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-400">
                            <span>⏰ {formatMinutes(task.startTime)}</span>
                            <span>⏱️ {task.durationMinutes}m</span>
                            <span>⚡ W: {task.weight}</span>
                            {task.fixedEndTime !== undefined && (
                              <span>🛑 End: {formatMinutes(task.fixedEndTime)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setEditingId(editingId === task.id ? null : task.id)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 cursor-pointer"
                          >
                            {editingId === task.id ? 'Close' : 'Edit'}
                          </button>
                          {confirmDeleteId === task.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  removeAdhocTask(task.id)
                                  setConfirmDeleteId(null)
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500 hover:bg-rose-600 text-white cursor-pointer uppercase"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 cursor-pointer uppercase"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(task.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-800/30 transition-all cursor-pointer uppercase"
                            >
                              <TrashIcon /> Obliterate
                            </button>
                          )}
                        </div>
                      </div>

                      {editingId === task.id && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={toTimeStr(task.startTime)}
                              onChange={(e) =>
                                updateAdhocTask(task.id, { startTime: fromTimeStr(e.target.value) })
                              }
                              className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 w-full"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                              Duration (m)
                            </label>
                            <input
                              type="number"
                              value={task.durationMinutes}
                              onChange={(e) =>
                                updateAdhocTask(task.id, {
                                  durationMinutes: Number(e.target.value) || 15,
                                })
                              }
                              className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 w-full font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                              Weight
                            </label>
                            <input
                              type="number"
                              value={task.weight}
                              onChange={(e) =>
                                updateAdhocTask(task.id, { weight: Number(e.target.value) || 100 })
                              }
                              className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded text-cyan-300 w-full font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdhocPanel
