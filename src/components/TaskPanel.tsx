import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import type { Task, TaskLink, LinkType, ContinuityRule } from '../types/task'

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
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          <h3 className="text-lg font-black tracking-wide text-slate-100">Tasks Directory</h3>
          <p className="text-xs text-slate-400">Manage all registered tasks, priorities, and dependency rules.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> New Task
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <TaskEditor
            allTasks={tasks}
            onSave={(task) => {
              addTask(task)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tasks.map((task) => {
          if (editing === task.id) {
            return (
              <div key={task.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4 md:col-span-2">
                <TaskEditor
                  initial={task}
                  allTasks={tasks}
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
              </div>
            )
          }

          return (
            <div
              key={task.id}
              onClick={() => setEditing(task.id)}
              className="group p-4 bg-slate-955/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm cursor-pointer hover:border-cyan-500/25 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-200 text-[15px] tracking-wide">
                    {task.title}
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded">
                    w:{task.weight} | {task.durationMinutes}m
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {task.knobs.scheduled && task.start && (
                    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-955/35 text-cyan-400 border border-cyan-900/30">
                      Scheduled
                    </span>
                  )}
                  {task.knobs.isMother && task.links && task.links.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-955/35 text-teal-400 border border-teal-905/30">
                      <LinkIcon /> Links: {task.links.length}
                    </span>
                  )}
                  {task.parentId && (
                    <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-850">
                      Child
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-3 mt-3 border-t border-slate-850 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-bold text-cyan-400">
                  Edit Task Details
                </span>
              </div>
            </div>
          )
        })}

        {tasks.length === 0 && !creating && (
          <p className="text-sm italic text-slate-500 py-4 col-span-2">
            No tasks registered yet. Add a task to get started.
          </p>
        )}
      </div>
    </div>
  )
}

function TaskEditor({
  initial,
  allTasks,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Task
  allTasks: Task[]
  onSave: (task: Task) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [weight, setWeight] = useState(initial?.weight ?? 100)
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30)

  // Knobs
  const [scheduled, setScheduled] = useState(initial?.knobs.scheduled ?? false)
  const [isMother, setIsMother] = useState(initial?.knobs.isMother ?? false)
  const [hasWeightCurve, setHasWeightCurve] = useState(initial?.knobs.hasWeightCurve ?? false)
  const [hasExpiry, setHasExpiry] = useState(initial?.knobs.hasExpiry ?? false)
  const [hasStickiness, setHasStickiness] = useState(initial?.knobs.hasStickiness ?? false)

  // Scheduled fields
  const [start, setStart] = useState(initial?.start ?? '')
  const [end, setEnd] = useState(initial?.end ?? '')

  // Links
  const [links, setLinks] = useState<TaskLink[]>(initial?.links ?? [])

  // Weight curve
  const [weightCurve, setWeightCurve] = useState<{ datetime: string; value: number }[]>(
    initial?.weightCurve ?? []
  )

  // Expiry
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? '')

  // Stickiness
  const [stickiness, setStickiness] = useState(initial?.stickiness ?? 0)

  const handleSave = () => {
    if (!title.trim() || duration <= 0) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      weight,
      durationMinutes: duration,
      start: scheduled ? start : undefined,
      end: scheduled ? end : undefined,
      links: isMother ? links : undefined,
      weightCurve: hasWeightCurve ? weightCurve : undefined,
      expiresAt: hasExpiry ? expiresAt : undefined,
      stickiness: hasStickiness ? stickiness : undefined,
      spawnedIds: initial?.spawnedIds,
      parentId: initial?.parentId,
      knobs: { scheduled, isMother, hasWeightCurve, hasExpiry, hasStickiness },
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
            { id: 'scheduled', label: 'Scheduled', checked: scheduled, set: setScheduled },
            { id: 'isMother', label: 'Mother Task', checked: isMother, set: setIsMother },
            { id: 'hasWeightCurve', label: 'Weight Curve', checked: hasWeightCurve, set: setHasWeightCurve },
            { id: 'hasExpiry', label: 'Expiry Date', checked: hasExpiry, set: setHasExpiry },
            { id: 'hasStickiness', label: 'Stickiness', checked: hasStickiness, set: setHasStickiness },
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

      {/* Scheduled Configuration */}
      {scheduled && (
        <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Target Timebounds
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
                Start DateTime
              </label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
                End DateTime
              </label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Link chains */}
      {isMother && (
        <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Chain Links
          </span>
          
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {links.map((link, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 bg-slate-950/60 border border-slate-850 p-2 rounded-xl"
              >
                <select
                  value={link.linkType}
                  onChange={(e) => {
                    const updated = [...links]
                    updated[i] = { ...updated[i], linkType: e.target.value as LinkType }
                    setLinks(updated)
                  }}
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer"
                >
                  <option value="active">active</option>
                  <option value="passive">passive</option>
                </select>

                <span className="text-slate-500 text-xs">→</span>

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

                {link.linkType === 'passive' && (
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
                )}

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
            onClick={() => setLinks([...links, { linkedTaskId: '', linkType: 'active' }])}
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
                  type="datetime-local"
                  value={wp.datetime}
                  onChange={(e) => {
                    const updated = [...weightCurve]
                    updated[i] = { ...updated[i], datetime: e.target.value }
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
            onClick={() => setWeightCurve([...weightCurve, { datetime: '', value: weight }])}
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

      {/* Stickiness parameter */}
      {hasStickiness && (
        <div className="space-y-2 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Stickiness Weight Boost
          </label>
          <input
            type="number"
            value={stickiness}
            onChange={(e) => setStickiness(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-32 bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
          />
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
