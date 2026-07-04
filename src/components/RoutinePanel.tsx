import { useState } from 'react'
import { useRoutineStore } from '../store/routineStore'
import { useBlockStore } from '../store/blockStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import type { Routine, RecurrenceConfig, RecurrencePattern, RoutineTaskConfig, RoutineBlockConfig } from '../types/routine'
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

function RoutinePanel() {
  const { routines, addRoutine, updateRoutine, deleteRoutine, toggleEnabled } = useRoutineStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6 text-slate-100">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-101 font-sans">Recurring Routines</h3>
          <p className="text-xs text-slate-400">Regular habits or repeating blocks scheduled dynamically.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> New Routine
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <RoutineEditor
            onSave={(r) => {
              addRoutine(r)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="space-y-2.5">
        {routines.map((routine) => {
          if (editing === routine.id) {
            return (
              <div key={routine.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <RoutineEditor
                  initial={routine}
                  onSave={(updated) => {
                    updateRoutine(routine.id, updated)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    deleteRoutine(routine.id)
                    setEditing(null)
                  }}
                />
              </div>
            )
          }

          return (
            <div
              key={routine.id}
              className={`flex justify-between items-center py-3.5 px-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm transition-all ${!routine.enabled ? 'opacity-40' : ''
                }`}
            >
              <div
                onClick={() => setEditing(routine.id)}
                className="cursor-pointer flex-1 space-y-1 pr-4"
              >
                <span className="font-bold text-slate-205 text-[15px]">
                  {routine.name}
                </span>

                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  <span className="bg-slate-950/65 border border-slate-850 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono">
                    {routine.recurrence.pattern}
                  </span>
                  <span>• spawn @ {formatTime(routine.idealSpawnTime)}</span>
                  <span>• {routine.blockConfigs.length} block(s)</span>
                  <span>• {routine.taskConfigs?.length ?? 0} task config(s)</span>
                </div>
              </div>

              {/* Duplicate + Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addRoutine({
                    ...routine,
                    id: crypto.randomUUID(),
                    name: `${routine.name} (copy)`,
                    blockConfigs: routine.blockConfigs.map((bc) => ({ ...bc })),
                    taskConfigs: routine.taskConfigs?.map((tc) => ({ ...tc })),
                  })}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-cyan-400 transition-all cursor-pointer"
                  title="Duplicate routine"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => toggleEnabled(routine.id)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 focus:outline-none ${routine.enabled ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${routine.enabled ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
                      }`}
                  />
                </button>
              </div>
            </div>
          )
        })}

        {routines.length === 0 && !creating && (
          <p className="text-sm italic text-slate-500 py-4 font-sans">
            No routines configured yet. Track repeating blocks on specific days.
          </p>
        )}
      </div>
    </div>
  )
}

function RoutineEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Routine
  onSave: (routine: Routine) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { blocks } = useBlockStore()
  const { tasks } = useTaskStore()
  const { slots, anchors } = useAnchorStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [blockConfigs, setBlockConfigs] = useState<RoutineBlockConfig[]>(initial?.blockConfigs ?? [])
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>(
    initial?.recurrence ?? { pattern: 'daily' }
  )
  const [idealSpawnTime, setIdealSpawnTime] = useState(initial?.idealSpawnTime ?? 360)
  const [taskConfigs, setTaskConfigs] = useState<RoutineTaskConfig[]>(initial?.taskConfigs ?? [])
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)

  // Get all tasks from selected blocks
  const blockTasks = blocks
    .filter((b) => blockConfigs.some((bc) => bc.blockId === b.id))
    .flatMap((b) => b.entries.map((e) => e.taskId))
  const uniqueTaskIds = [...new Set(blockTasks)]

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      blockConfigs,
      recurrence,
      idealSpawnTime,
      taskConfigs: taskConfigs.length > 0 ? taskConfigs : undefined,
      enabled,
    })
  }

  const toTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const fromTimeStr = (str: string) => {
    const [h, m] = str.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const removeTaskConfig = (taskId: string) =>
    setTaskConfigs(taskConfigs.filter((tc) => tc.taskId !== taskId))

  const setTaskConfig = (taskId: string, updates: Partial<RoutineTaskConfig>) => {
    const existing = taskConfigs.find((tc) => tc.taskId === taskId)
    if (existing) {
      setTaskConfigs(taskConfigs.map((tc) => tc.taskId === taskId ? { ...tc, ...updates } : tc))
    } else {
      setTaskConfigs([...taskConfigs, { taskId, ...updates }])
    }
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Routine Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Morning Wake Routine, Evening Wrapup"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Enabled switch */}
      <div className="flex items-center gap-1.5 p-2 bg-slate-900/30 border border-slate-800 rounded-xl max-w-xs">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-700 bg-slate-955 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
          />
          Enabled Routine Status
        </label>
      </div>

      {/* Block configs */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Blocks → Anchor Mapping
        </span>

        {/* Add block dropdown */}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !blockConfigs.some((bc) => bc.blockId === e.target.value)) {
              setBlockConfigs([...blockConfigs, {
                blockId: e.target.value,
                anchorId: '',
              }])
            }
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-350 focus:outline-none cursor-pointer w-full"
        >
          <option value="" className="bg-slate-950 text-slate-500">＋ Add block…</option>
          {blocks.filter((b) => !blockConfigs.some((bc) => bc.blockId === b.id)).map((b) => (
            <option key={b.id} value={b.id} className="bg-slate-950 text-slate-200">{b.name}</option>
          ))}
        </select>

        {/* Per-block config cards */}
        {blockConfigs.map((bc, idx) => {
          const b = blocks.find((bl) => bl.id === bc.blockId)
          const blockDuration = b
            ? b.entries.reduce((sum, e) => {
              const t = tasks.find((tt) => tt.id === e.taskId)
              return sum + (t?.durationMinutes ?? 0)
            }, 0)
            : 0
          const mandatoryDuration = b
            ? b.entries.filter((e) => e.mandatory).reduce((sum, e) => {
              const t = tasks.find((tt) => tt.id === e.taskId)
              return sum + (t?.durationMinutes ?? 0)
            }, 0)
            : 0

          return (
            <div key={bc.blockId} className="bg-slate-955 border border-slate-850 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-400">{b?.name ?? bc.blockId}</span>
                  <span className="text-[9px] font-mono text-slate-500">
                    {blockDuration}m total · {mandatoryDuration}m mandatory
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockConfigs(blockConfigs.filter((_, i) => i !== idx))}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                >
                  <XIcon />
                </button>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">At Anchor</label>
                <select
                  value={bc.anchorId}
                  onChange={(e) => {
                    const updated = [...blockConfigs]
                    updated[idx] = { ...updated[idx], anchorId: e.target.value }
                    setBlockConfigs(updated)
                  }}
                  className="text-[10px] px-2 py-1 w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="">-- anchor --</option>
                  {anchors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}

        {/* Live duration summary */}
        {blockConfigs.length > 0 && (() => {
          let totalDuration = 0
          let mandatoryTotal = 0
          let optionalTotal = 0
          for (const bc of blockConfigs) {
            const b = blocks.find((bl) => bl.id === bc.blockId)
            if (!b) continue
            for (const entry of b.entries) {
              const t = tasks.find((tt) => tt.id === entry.taskId)
              const dur = t?.durationMinutes ?? 0
              totalDuration += dur
              if (entry.mandatory) mandatoryTotal += dur
              else optionalTotal += dur
            }
          }
          const hrs = Math.floor(totalDuration / 60)
          const mins = totalDuration % 60
          return (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Routine Total</span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-slate-200 font-bold">{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</span>
                <span className="text-cyan-500">{mandatoryTotal}m must</span>
                <span className="text-slate-500">{optionalTotal}m optional</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Spawn time */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Ideal Spawn Time
        </label>
        <input
          type="time"
          value={toTimeStr(idealSpawnTime)}
          onChange={(e) => setIdealSpawnTime(fromTimeStr(e.target.value))}
          className="text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
        />
      </div>

      {/* Recurrence config */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Recurrence Rules
        </span>

        <div className="flex flex-wrap items-center gap-3 bg-slate-950/60 p-3 border border-slate-850 rounded-xl">
          <select
            value={recurrence.pattern}
            onChange={(e) => setRecurrence({ ...recurrence, pattern: e.target.value as RecurrencePattern })}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-350 focus:outline-none cursor-pointer"
          >
            <option className="bg-slate-950 text-slate-200" value="daily">daily</option>
            <option className="bg-slate-950 text-slate-200" value="weekly">weekly</option>
            <option className="bg-slate-950 text-slate-200" value="monthly">monthly</option>
            <option className="bg-slate-950 text-slate-200" value="one-time">one-time</option>
            <option className="bg-slate-950 text-slate-200" value="repeat-until">repeat-until</option>
          </select>

          {recurrence.pattern !== 'daily' && recurrence.pattern !== 'one-time' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>every</span>
              <input
                type="number"
                value={recurrence.interval ?? 1}
                onChange={(e) => setRecurrence({ ...recurrence, interval: Number(e.target.value) || 1 })}
                className="w-12 px-1.5 py-1 text-center bg-slate-900 border border-slate-800 rounded text-slate-205 font-semibold focus:outline-none"
              />
            </div>
          )}
        </div>

        {recurrence.pattern === 'weekly' && (
          <div className="flex flex-wrap gap-2 bg-slate-950/40 p-3 border border-slate-850 rounded-xl">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
              const isActive = recurrence.daysOfWeek?.includes(i) ?? false
              return (
                <label
                  key={i}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${isActive
                      ? 'bg-cyan-955/35 text-cyan-400 border-cyan-905/30'
                      : 'bg-slate-950 border-slate-900 text-slate-500 hover:bg-slate-900'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => {
                      const days = recurrence.daysOfWeek ?? []
                      setRecurrence({
                        ...recurrence,
                        daysOfWeek: e.target.checked ? [...days, i] : days.filter((d) => d !== i),
                      })
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-3 w-3 cursor-pointer"
                  />
                  {day}
                </label>
              )
            })}
          </div>
        )}

        {recurrence.pattern === 'monthly' && (
          <div className="flex items-center gap-2 bg-slate-950/40 p-3 border border-slate-850 rounded-xl text-xs text-slate-350">
            <span>Day of month:</span>
            <input
              type="number"
              value={recurrence.dayOfMonth ?? 1}
              onChange={(e) => setRecurrence({ ...recurrence, dayOfMonth: Number(e.target.value) || 1 })}
              min={1}
              max={31}
              className="w-14 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-center text-slate-205 font-bold focus:outline-none"
            />
          </div>
        )}

        {recurrence.pattern === 'repeat-until' && (
          <div className="flex items-center gap-2 bg-slate-950/40 p-3 border border-slate-850 rounded-xl text-xs text-slate-350">
            <span>Until:</span>
            <input
              type="date"
              value={recurrence.repeatUntil ?? ''}
              onChange={(e) => setRecurrence({ ...recurrence, repeatUntil: e.target.value })}
              className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-205 focus:outline-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Per-task configs */}
      {uniqueTaskIds.length > 0 && (
        <div className="space-y-3 pl-4 border-l-2 border-cyan-555 bg-slate-900/10 p-3 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Task Weight & Constraint Overrides
          </span>

          {/* Dropdown to add a task config */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setTaskConfig(e.target.value, {})
              }
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-350 focus:outline-none cursor-pointer w-full"
          >
            <option value="" className="bg-slate-950 text-slate-500">＋ Configure a task…</option>
            {uniqueTaskIds
              .filter((tid) => !taskConfigs.find((tc) => tc.taskId === tid))
              .map((tid) => {
                const t = tasks.find((tt) => tt.id === tid)
                return <option key={tid} value={tid} className="bg-slate-950 text-slate-200">{t?.title ?? tid}</option>
              })}
          </select>

          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {taskConfigs.map((cfg) => {
              const taskId = cfg.taskId
              const task = tasks.find((t) => t.id === taskId)
              if (!task) return null
              const config = cfg

              return (
                <div
                  key={taskId}
                  className="bg-slate-955 border border-slate-850 p-3.5 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                    <div>
                      <span className="text-xs font-bold text-slate-202 tracking-wide">{task.title}</span>
                      <span className="ml-2 text-[9px] font-medium text-slate-500">
                        {config.slotWeights && Object.keys(config.slotWeights).length > 0 ? '⟡ slot-relative' : '◆ absolute'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTaskConfig(taskId)}
                      className="p-1 rounded text-slate-500 hover:bg-rose-955/20 hover:text-rose-400 transition-all cursor-pointer"
                    >
                      <XIcon />
                    </button>
                  </div>

                  {/* Ideal time & expiry offset */}
                  <div className="grid grid-cols-2 gap-3 flex-wrap">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Ideal Time
                      </label>
                      <input
                        type="time"
                        value={config?.idealTime !== undefined ? toTimeStr(config.idealTime) : ''}
                        onChange={(e) => setTaskConfig(taskId, { idealTime: e.target.value ? fromTimeStr(e.target.value) : undefined })}
                        className="text-xs px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none cursor-pointer w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Expires Offset (min)
                      </label>
                      <input
                        type="number"
                        value={config?.expiresAfterMinutes ?? ''}
                        onChange={(e) => setTaskConfig(taskId, { expiresAfterMinutes: Number(e.target.value) || undefined })}
                        placeholder="expires"
                        className="text-xs px-2 py-1 bg-slate-950 border border-slate-850 rounded-lg text-slate-300 text-center w-full focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Slot weights */}
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Active Slots
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span>Other slots →</span>
                        <input
                          type="number"
                          value={config?.fallbackWeight ?? 0}
                          onChange={(e) => setTaskConfig(taskId, { fallbackWeight: Number(e.target.value) || 0 })}
                          className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-amber-400 font-bold text-[10px]"
                        />
                      </div>
                    </div>

                    {/* Dropdown to add a slot */}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const current = config?.slotWeights ?? {}
                          // Default: flat weight = task's absolute weight
                          setTaskConfig(taskId, { slotWeights: { ...current, [e.target.value]: [{ offsetMinutes: 0, value: task.weight }] } })
                        }
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg border border-slate-800 bg-slate-950 text-slate-350 focus:outline-none cursor-pointer w-full"
                    >
                      <option value="" className="bg-slate-950 text-slate-500">＋ Enable in slot…</option>
                      {slots
                        .filter((s) => !config?.slotWeights?.[s.id])
                        .map((s) => (
                          <option key={s.id} value={s.id} className="bg-slate-950 text-slate-200">{s.name}</option>
                        ))}
                    </select>

                    {/* Active slots */}
                    {Object.entries(config?.slotWeights ?? {}).map(([slotId, points]) => {
                      const slot = slots.find((s) => s.id === slotId)
                      const isFlat = points.length <= 1
                      const flatWeight = points[0]?.value ?? 0

                      return (
                        <div
                          key={slotId}
                          className="pl-3 border-l-2 border-cyan-800/40 py-1.5 space-y-2 bg-slate-955/30 p-2.5 rounded-lg border border-slate-850/60"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-cyan-400">{slot?.name ?? slotId}</span>
                              {isFlat && (
                                <span className="text-[9px] text-slate-600">flat</span>
                              )}
                              {!isFlat && (
                                <span className="text-[9px] text-purple-400">{points.length} pts</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const current = { ...config?.slotWeights }
                                delete current[slotId]
                                setTaskConfig(taskId, { slotWeights: Object.keys(current).length > 0 ? current : undefined })
                              }}
                              className="p-0.5 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                            >
                              <XIcon />
                            </button>
                          </div>

                          {/* Flat mode: single weight input */}
                          {isFlat && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500">Weight:</span>
                              <input
                                type="number"
                                value={flatWeight}
                                onChange={(e) => {
                                  const current = config?.slotWeights ?? {}
                                  setTaskConfig(taskId, { slotWeights: { ...current, [slotId]: [{ offsetMinutes: 0, value: Number(e.target.value) || 0 }] } })
                                }}
                                className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-202 font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  // Expand to piecewise: add a second point
                                  const current = config?.slotWeights ?? {}
                                  setTaskConfig(taskId, { slotWeights: { ...current, [slotId]: [...points, { offsetMinutes: 60, value: 0 }] } })
                                }}
                                className="text-[9px] font-bold text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-auto"
                              >
                                <PlusIcon /> Piecewise
                              </button>
                            </div>
                          )}

                          {/* Piecewise mode: multiple offset→value points */}
                          {!isFlat && (
                            <>
                              <div className="space-y-1.5">
                                {points.map((pt, pi) => (
                                  <div key={pi} className="flex items-center gap-1.5 text-xs flex-wrap">
                                    <span className="text-slate-500">+</span>
                                    <input
                                      type="number"
                                      value={pt.offsetMinutes}
                                      onChange={(e) => {
                                        const updated = [...points]
                                        updated[pi] = { ...updated[pi], offsetMinutes: Number(e.target.value) || 0 }
                                        const current = config?.slotWeights ?? {}
                                        setTaskConfig(taskId, { slotWeights: { ...current, [slotId]: updated } })
                                      }}
                                      className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-300"
                                    />
                                    <span className="text-slate-500">min →</span>
                                    <input
                                      type="number"
                                      value={pt.value}
                                      onChange={(e) => {
                                        const updated = [...points]
                                        updated[pi] = { ...updated[pi], value: Number(e.target.value) || 0 }
                                        const current = config?.slotWeights ?? {}
                                        setTaskConfig(taskId, { slotWeights: { ...current, [slotId]: updated } })
                                      }}
                                      className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-202 font-semibold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = points.filter((_, j) => j !== pi)
                                        const current = config?.slotWeights ?? {}
                                        if (updated.length === 0) {
                                          const { [slotId]: _, ...rest } = current
                                          setTaskConfig(taskId, { slotWeights: Object.keys(rest).length > 0 ? rest : undefined })
                                        } else {
                                          setTaskConfig(taskId, { slotWeights: { ...current, [slotId]: updated } })
                                        }
                                      }}
                                      className="p-1 rounded text-slate-400 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer"
                                    >
                                      <XIcon />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const last = points[points.length - 1]
                                  const newPt = { offsetMinutes: (last?.offsetMinutes ?? 0) + 60, value: 0 }
                                  const current = config?.slotWeights ?? {}
                                  setTaskConfig(taskId, { slotWeights: { ...current, [slotId]: [...points, newPt] } })
                                }}
                                className="text-[9px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <PlusIcon /> Add point
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Changes
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
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-955/35 hover:bg-rose-900/30 text-rose-400 border border-rose-800/30 transition-all cursor-pointer"
          >
            <TrashIcon /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default RoutinePanel
