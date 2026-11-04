import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useRoutineStore } from '../store/routineStore'
import { useBlockStore } from '../store/blockStore'
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
  const { blocks } = useBlockStore()
  const { routines } = useRoutineStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [quickName, setQuickName] = useState('')

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickName.trim()) return
    addTask({
      id: crypto.randomUUID(),
      title: quickName.trim(),
      weight: 100,
      durationMinutes: 30,
      knobs: {
        isMother: false,
        hasWeightCurve: false,
        hasExpiry: false,
      },
    })
    setQuickName('')
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Task Templates</h3>
          <p className="text-xs text-slate-400">
            Lightweight name templates. Start time, expiry, duration overrides, and relative slot weights are customized per Routine.
          </p>
        </div>
        {!creating && !editing && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all cursor-pointer"
          >
            <PlusIcon /> New Template with Defaults
          </button>
        )}
      </div>

      {/* Instant Name-Only Template Creator */}
      {!creating && !editing && (
        <form onSubmit={handleQuickAdd} className="flex gap-2 items-center bg-slate-900/50 border border-slate-800/80 p-2.5 rounded-2xl">
          <input
            type="text"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Quick-create task template by name (e.g. Brush, Deep Work, Cook, Stretch)…"
            className="text-xs px-3 py-2 flex-1 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!quickName.trim()}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500/90 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 transition-all cursor-pointer"
          >
            <PlusIcon /> Add Template
          </button>
        </form>
      )}

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
        {tasks.map((task) => {
          const usedInBlocks = blocks.filter((b) => b.entries.some((e) => e.taskId === task.id))
          const customizedInRoutines = routines.filter((r) =>
            r.taskConfigs?.some((tc) => tc.taskId === task.id)
          )

          return (
            <div
              key={task.id}
              className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-2.5 hover:border-slate-800 transition-colors"
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
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-200 text-sm">{task.title}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                          Template
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400 mt-1">
                        <span>⏱️ Default: {task.durationMinutes || 30}m</span>
                        {task.minDurationMinutes && task.minDurationMinutes < task.durationMinutes && (
                          <span className="text-amber-400">• 📉 Floor: {task.minDurationMinutes}m</span>
                        )}
                        <span>• ⚡ Base W: {task.weight || 100}</span>
                        {task.knobs?.isMother && <span>• 🔗 Mother Chain</span>}
                        {task.knobs?.hasAlterEgos && task.alterEgos && task.alterEgos.length > 0 && (
                          <span>• 🎭 {task.alterEgos.length} Mode(s)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditing(task.id)}
                        className="text-xs font-semibold text-slate-400 hover:text-cyan-400 px-2 py-1 rounded bg-slate-950 border border-slate-850 transition-colors cursor-pointer"
                      >
                        Customize
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                        title="Delete Task Template"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {/* Usage & Routine Instance summary badges */}
                  {(usedInBlocks.length > 0 || customizedInRoutines.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {usedInBlocks.map((b) => (
                        <span
                          key={b.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400"
                        >
                          📦 {b.name}
                        </span>
                      ))}
                      {customizedInRoutines.map((r) => (
                        <span
                          key={r.id}
                          className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-900/30 text-cyan-300"
                        >
                          🎛️ Customized in {r.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Alter Egos summary badges */}
                  {task.knobs?.hasAlterEgos && task.alterEgos && task.alterEgos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {task.alterEgos.map((ae) => (
                        <span
                          key={ae.id}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-955/40 border border-cyan-900/30 text-cyan-300"
                        >
                          🎭 {ae.name}: {ae.durationMinutes}m{' '}
                          {ae.triggerDelayMinutes !== undefined ? `(≥${ae.triggerDelayMinutes}m delay)` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {tasks.length === 0 && !creating && (
        <div className="text-center py-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm font-semibold text-slate-500">No task templates in catalog yet.</p>
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
  const [duration, setDuration] = useState<number | ''>(initial?.durationMinutes ?? '')
  const [minDuration, setMinDuration] = useState<number | ''>(initial?.minDurationMinutes ?? '')
  const [weight, setWeight] = useState<number | ''>(initial?.weight ?? '')

  // Optional template capabilities (Mother Chain Links & Alter-Ego Variants)
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      initial?.knobs?.isMother ||
      initial?.knobs?.hasAlterEgos ||
      (initial?.minDurationMinutes && initial.minDurationMinutes < (initial.durationMinutes || 30))
    )
  )
  const [isMother, setIsMother] = useState(initial?.knobs?.isMother ?? false)
  const [hasAlterEgos, setHasAlterEgos] = useState(initial?.knobs?.hasAlterEgos ?? false)
  const [links, setLinks] = useState<TaskLink[]>(initial?.links ?? [])
  const [alterEgos, setAlterEgos] = useState<TaskAlterEgo[]>(initial?.alterEgos ?? [])

  const handleSave = () => {
    if (!title.trim()) return
    const resolvedDuration = typeof duration === 'number' && duration > 0 ? duration : 30
    const resolvedWeight = typeof weight === 'number' && weight >= 0 ? weight : 100
    const resolvedMin =
      typeof minDuration === 'number' && minDuration > 0 && minDuration <= resolvedDuration
        ? minDuration
        : undefined

    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      weight: resolvedWeight,
      durationMinutes: resolvedDuration,
      minDurationMinutes: resolvedMin,
      durationCurve: initial?.durationCurve,
      links: isMother ? links : undefined,
      // Preserve any legacy fields if editing an older task
      weightCurve: initial?.weightCurve,
      expiresAt: initial?.expiresAt,
      fixedEndTime: initial?.fixedEndTime,
      alterEgos: hasAlterEgos ? alterEgos : undefined,
      spawnedIds: initial?.spawnedIds,
      parentId: initial?.parentId,
      knobs: {
        isMother,
        hasWeightCurve: initial?.knobs?.hasWeightCurve ?? false,
        hasExpiry: initial?.knobs?.hasExpiry ?? false,
        hasFixedEndTime: initial?.knobs?.hasFixedEndTime ?? false,
        hasAlterEgos,
        hasDurationCurve: initial?.knobs?.hasDurationCurve,
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Required: Task Template Name */}
      <div>
        <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">
          Task Template Name (Required)
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Brush, Workout, Deep Work, Dinner"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Optional Template Defaults */}
      <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Optional Template Defaults (Overridable per Routine / Slot)
          </span>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
          >
            {showAdvanced ? 'Hide Variants & Chains' : '+ Variants & Chains'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Default Dur (min)
            </label>
            <input
              type="number"
              value={duration}
              placeholder="30 (optional)"
              onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : '')}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
              Default Min Floor
            </label>
            <input
              type="number"
              value={minDuration}
              placeholder="No shrinkage"
              onChange={(e) => setMinDuration(e.target.value ? Number(e.target.value) : '')}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-amber-800/40 rounded-lg text-amber-300 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Default Weight
            </label>
            <input
              type="number"
              value={weight}
              placeholder="100 (optional)"
              onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : '')}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Advanced: Mother Task Links & Alter-Ego Presets */}
      {showAdvanced && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'isMother', label: '🔗 Mother Task Chain', checked: isMother, set: setIsMother },
              { id: 'hasAlterEgos', label: '🎭 Alter-Ego Mode Variants', checked: hasAlterEgos, set: setHasAlterEgos },
            ].map((k) => (
              <label
                key={k.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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

          {hasAlterEgos && (
            <div className="space-y-3 pl-4 border-l-2 border-cyan-500 bg-slate-900/10 p-3 rounded-2xl">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                🎭 Alter-Ego Presets & Modes
              </span>

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
                        placeholder="Preset Name (e.g. Express, Full)"
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
                              updated[i] = {
                                ...updated[i],
                                triggerDelayMinutes: e.target.value ? Number(e.target.value) : undefined,
                              }
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
                    {
                      id: crypto.randomUUID(),
                      name: `Preset ${alterEgos.length + 1}`,
                      durationMinutes: typeof duration === 'number' && duration > 0 ? duration : 30,
                    },
                  ])
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-900 text-cyan-400 border border-slate-850 transition-all cursor-pointer"
              >
                <PlusIcon /> Add Alter-Ego Preset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Template
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
