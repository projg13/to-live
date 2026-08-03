import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import type { Task, TaskLink, TaskAlterEgo, ContinuityRule } from '../types/task'

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

const LinkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
)

function TaskPanel() {
  const { tasks, addTask, updateTask, deleteTask } = useTaskStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Task Catalog</h3>
          <p className="text-xs text-slate-400">Atomic duration quanta and structural mother-child chains.</p>
        </div>
        {!creating && !editing && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all cursor-pointer"
          >
            <PlusIcon /> New Task
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <TaskEditor
            onSave={(newTask) => {
              addTask(newTask)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3 hover:border-slate-800 transition-colors"
          >
            {editing === task.id ? (
              <TaskEditor
                initial={task}
                onSave={(updated) => {
                  updateTask(task.id, updated)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
                onDelete={() => {
                  deleteTask(task.id)
                  setEditing(null)
                }}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{task.title}</h4>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400 mt-0.5">
                      <span>⚡ W: {task.weight}</span>
                      <span>• ⏱️ {task.durationMinutes}m</span>
                      {task.knobs.isMother && <span>• 🔗 Mother</span>}
                      {task.knobs.hasWeightCurve && <span>• 🎚️ Curve</span>}
                      {task.knobs.hasExpiry && <span>• ⏰ Expiry</span>}
                      {task.knobs.hasFixedEndTime && task.fixedEndTime !== undefined && (
                        <span>• 🛑 End: {Math.floor(task.fixedEndTime / 60)}:{(task.fixedEndTime % 60).toString().padStart(2, '0')}</span>
                      )}
                      {task.knobs.hasAlterEgos && task.alterEgos && task.alterEgos.length > 0 && (
                        <span>• 🎭 {task.alterEgos.length} Alter-Ego(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditing(task.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-cyan-400 px-2 py-1 rounded bg-slate-950 border border-slate-850 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                      title="Delete Task"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {/* Alter Egos summary badges */}
                {task.knobs.hasAlterEgos && task.alterEgos && task.alterEgos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.alterEgos.map((ae) => (
                      <span key={ae.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-955/40 border border-cyan-900/30 text-cyan-300">
                        🎭 {ae.name}: {ae.durationMinutes}m {ae.triggerDelayMinutes !== undefined ? `(≥${ae.triggerDelayMinutes}m delay)` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {tasks.length === 0 && !creating && (
        <div className="text-center py-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm font-semibold text-slate-500">No tasks in catalog yet.</p>
        </div>
      )}
    </div>
  )
}

function TaskEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Task
  onSave: (task: Task) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { tasks: allTasks } = useTaskStore()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [weight, setWeight] = useState(initial?.weight ?? 100)
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30)

  // Knobs
  const [isMother, setIsMother] = useState(initial?.knobs.isMother ?? false)
  const [hasWeightCurve, setHasWeightCurve] = useState(initial?.knobs.hasWeightCurve ?? false)
  const [hasExpiry, setHasExpiry] = useState(initial?.knobs.hasExpiry ?? false)
  const [hasFixedEndTime, setHasFixedEndTime] = useState(initial?.knobs.hasFixedEndTime ?? false)
  const [hasAlterEgos, setHasAlterEgos] = useState(initial?.knobs.hasAlterEgos ?? false)

  // Links
  const [links, setLinks] = useState<TaskLink[]>(initial?.links ?? [])

  // Weight curve (24h circular, time-of-day)
  const [weightCurve, setWeightCurve] = useState<{ time: number; value: number }[]>(
    initial?.weightCurve ?? []
  )

  // Expiry
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? '')

  // Fixed End Time
  const [fixedEndTime, setFixedEndTime] = useState<number | undefined>(initial?.fixedEndTime)

  // Alter Egos
  const [alterEgos, setAlterEgos] = useState<TaskAlterEgo[]>(initial?.alterEgos ?? [])

  const handleSave = () => {
    if (!title.trim() || duration <= 0) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      weight,
      durationMinutes: duration,
      links: isMother ? links : undefined,
      weightCurve: hasWeightCurve ? weightCurve : undefined,
      expiresAt: hasExpiry ? expiresAt : undefined,
      fixedEndTime: hasFixedEndTime ? fixedEndTime : undefined,
      alterEgos: hasAlterEgos ? alterEgos : undefined,
      spawnedIds: initial?.spawnedIds,
      parentId: initial?.parentId,
      knobs: { isMother, hasWeightCurve, hasExpiry, hasFixedEndTime, hasAlterEgos },
    })
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Task Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Write Documentation, Workout Session"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Weight + Duration */}
      <div className="grid grid-cols-2 gap-4 bg-slate-900/30 p-3.5 border border-slate-800 rounded-xl">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Priority Weight
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            Duration (min)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
      </div>

      {/* Knobs Checklist */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Task Settings (Knobs)
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'isMother', label: 'Mother Task', checked: isMother, set: setIsMother },
            { id: 'hasWeightCurve', label: 'Weight Curve', checked: hasWeightCurve, set: setHasWeightCurve },
            { id: 'hasExpiry', label: 'Expiry Date', checked: hasExpiry, set: setHasExpiry },
            { id: 'hasFixedEndTime', label: 'Fixed End Time', checked: hasFixedEndTime, set: setHasFixedEndTime },
            { id: 'hasAlterEgos', label: 'Weight Presets (Alter-Ego)', checked: hasAlterEgos, set: setHasAlterEgos },
          ].map((k) => (
            <label
              key={k.id}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                k.checked
                  ? 'bg-cyan-955/35 text-cyan-400 border-cyan-900/30 shadow-sm'
                  : 'bg-slate-950 border-slate-900 text-slate-500 hover:bg-slate-900'
              }`}
            >
              <input
                type="checkbox"
                checked={k.checked}
                onChange={(e) => k.set(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer"
              />
              {k.label}
            </label>
          ))}
        </div>
      </div>

      {/* Link chains */}
      {isMother && (
        <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <LinkIcon /> Chain Links
          </span>
          
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {links.map((link, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 bg-slate-950/60 border border-slate-850 p-2 rounded-xl"
              >
                <select
                  value={link.linkedTaskId}
                  onChange={(e) => {
                    const updated = [...links]
                    updated[i] = { ...updated[i], linkedTaskId: e.target.value }
                    setLinks(updated)
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer flex-1 min-w-[140px]"
                >
                  <option value="">-- select task --</option>
                  {allTasks
                    .filter((t) => t.id !== initial?.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>

                <select
                  value={link.continuity ?? ''}
                  onChange={(e) => {
                    const updated = [...links]
                    updated[i] = {
                      ...updated[i],
                      continuity: (e.target.value || undefined) as ContinuityRule | undefined,
                    }
                    setLinks(updated)
                  }}
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer"
                >
                  <option value="">(default)</option>
                  <option value="resumable">resumable</option>
                  <option value="breakable">breakable</option>
                </select>

                <button
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setLinks([...links, { linkedTaskId: '' }])}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-955 hover:bg-slate-900 text-slate-350 border border-slate-850 transition-all cursor-pointer"
          >
            <PlusIcon /> Add Link
          </button>
        </div>
      )}

      {/* Weight curve settings */}
      {hasWeightCurve && (
        <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Time-based Weight Scale Curve
          </span>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {weightCurve.map((wp, i) => (
              <div key={i} className="flex items-center gap-2 text-xs flex-wrap bg-slate-955 border border-slate-850 p-2 rounded-xl">
                <input
                  type="time"
                  value={`${String(Math.floor(wp.time / 60)).padStart(2, '0')}:${String(wp.time % 60).padStart(2, '0')}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    const updated = [...weightCurve]
                    updated[i] = { ...updated[i], time: (h || 0) * 60 + (m || 0) }
                    setWeightCurve(updated)
                  }}
                  className="text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-305 cursor-pointer focus:outline-none"
                />
                <span className="text-slate-500 font-bold">=</span>
                <input
                  type="number"
                  value={wp.value}
                  onChange={(e) => {
                    const updated = [...weightCurve]
                    updated[i] = { ...updated[i], value: Number(e.target.value) || 0 }
                    setWeightCurve(updated)
                  }}
                  placeholder="weight"
                  className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-202 font-semibold focus:outline-none"
                />
                <button
                  onClick={() => setWeightCurve(weightCurve.filter((_, j) => j !== i))}
                  className="p-1 rounded text-slate-400 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setWeightCurve([...weightCurve, { time: 540, value: weight }])}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-955 hover:bg-slate-900 text-slate-350 border border-slate-850 transition-all cursor-pointer"
          >
            <PlusIcon /> Add Point
          </button>
        </div>
      )}

      {/* Expiry setting */}
      {hasExpiry && (
        <div className="space-y-2 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Expiration date
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-slate-300 cursor-pointer focus:outline-none"
          />
        </div>
      )}

      {/* Fixed End Time setting */}
      {hasFixedEndTime && (
        <div className="space-y-2 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Fixed End Time
          </label>
          <input
            type="time"
            value={fixedEndTime !== undefined ? `${String(Math.floor(fixedEndTime / 60)).padStart(2, '0')}:${String(fixedEndTime % 60).padStart(2, '0')}` : ''}
            onChange={(e) => {
              if (e.target.value) {
                const [h, m] = e.target.value.split(':').map(Number)
                setFixedEndTime(h * 60 + m)
              } else {
                setFixedEndTime(undefined)
              }
            }}
            className="text-xs px-2.5 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-slate-300 cursor-pointer focus:outline-none"
          />
        </div>
      )}



      {/* Alter-Ego Presets Manager */}
      {hasAlterEgos && (
        <div className="space-y-3 pl-4 border-l-2 border-cyan-500 bg-slate-900/10 p-3 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
              🎭 Alter-Ego Presets & Modes
            </span>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {alterEgos.map((ae, i) => (
              <div key={ae.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-xl space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ae.name}
                    onChange={(e) => {
                      const updated = [...alterEgos]
                      updated[i] = { ...updated[i], name: e.target.value }
                      setAlterEgos(updated)
                    }}
                    placeholder="Preset Name (e.g. Express, Long)"
                    className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  />
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2">
                    <span className="text-[10px] text-slate-450 font-bold">Dur:</span>
                    <input
                      type="number"
                      value={ae.durationMinutes}
                      onChange={(e) => {
                        const updated = [...alterEgos]
                        updated[i] = { ...updated[i], durationMinutes: Number(e.target.value) || 5 }
                        setAlterEgos(updated)
                      }}
                      className="text-xs py-1 bg-transparent border-none text-slate-200 focus:outline-none w-full"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">m</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ae.titleOverride ?? ''}
                    onChange={(e) => {
                      const updated = [...alterEgos]
                      updated[i] = { ...updated[i], titleOverride: e.target.value || undefined }
                      setAlterEgos(updated)
                    }}
                    placeholder="Title Override (Optional)"
                    className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 w-full">
                      <span className="text-[10px] text-slate-450 font-bold whitespace-nowrap">≥ Delay:</span>
                      <input
                        type="number"
                        value={ae.triggerDelayMinutes ?? ''}
                        onChange={(e) => {
                          const updated = [...alterEgos]
                          updated[i] = { ...updated[i], triggerDelayMinutes: e.target.value ? Number(e.target.value) : undefined }
                          setAlterEgos(updated)
                        }}
                        placeholder="mins"
                        className="text-xs py-1 bg-transparent border-none text-slate-200 focus:outline-none w-full"
                      />
                    </div>
                    <button
                      onClick={() => setAlterEgos(alterEgos.filter((_, j) => j !== i))}
                      className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer transition-colors"
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              setAlterEgos([
                ...alterEgos,
                { id: crypto.randomUUID(), name: `Preset ${alterEgos.length + 1}`, durationMinutes: duration },
              ])
            }
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-900 text-cyan-400 border border-slate-850 transition-all cursor-pointer"
          >
            <PlusIcon /> Add Alter-Ego Preset
          </button>
        </div>
      )}

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Task
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

export default TaskPanel
