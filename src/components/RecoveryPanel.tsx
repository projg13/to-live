import { useState } from 'react'
import { useRecoveryStore } from '../store/recoveryStore'
import { useTaskStore } from '../store/taskStore'
import { useBlockStore } from '../store/blockStore'
import type { RecoveryPlan, TriggerType, AutoTriggerCondition, TimeWeight } from '../types/recovery'

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

const FlameIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
  </svg>
)

function RecoveryPanel() {
  const { plans, addPlan, updatePlan, deletePlan, trigger, resolve } = useRecoveryStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Recovery Plans</h3>
          <p className="text-xs text-slate-400">Inject high weight blockers dynamically to recover daily momentum.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> New Plan
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <RecoveryEditor
            onSave={(p) => {
              addPlan(p)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="space-y-2.5">
        {plans.map((plan) => {
          if (editing === plan.id) {
            return (
              <div key={plan.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <RecoveryEditor
                  initial={plan}
                  onSave={(updated) => {
                    updatePlan(plan.id, updated)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    deletePlan(plan.id)
                    setEditing(null)
                  }}
                />
              </div>
            )
          }

          const daysPending = plan.triggeredAt
            ? Math.floor((new Date(today).getTime() - new Date(plan.triggeredAt).getTime()) / 86400000)
            : 0

          return (
            <div
              key={plan.id}
              className={`flex justify-between items-center py-3.5 px-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm transition-all ${
                plan.triggered ? 'border-rose-900/50 bg-rose-955/5' : ''
              }`}
            >
              <div
                onClick={() => setEditing(plan.id)}
                className="cursor-pointer flex-1 space-y-1.5 pr-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-205 text-[15px]">
                    {plan.name}
                  </span>
                  {plan.triggered && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-955/35 text-rose-450 border border-rose-900/30 animate-pulse">
                      <FlameIcon /> Active {daysPending}d
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  <span className="bg-slate-950/60 border border-slate-850 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono">
                    Trigger: {plan.triggerType}
                  </span>
                  {plan.autoCondition && (
                    <span>• Auto: {plan.autoCondition.consecutiveMisses} misses</span>
                  )}
                  <span>• growth: +{plan.growthRate}/day</span>
                  <span>• cap: {plan.saturationLimit}w</span>
                </div>
              </div>

              <div className="flex gap-2">
                {!plan.triggered ? (
                  <button
                    onClick={() => trigger(plan.id)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-955/30 hover:bg-rose-900/40 text-rose-400 border border-rose-800/30 transition-all active:scale-95 cursor-pointer"
                  >
                    Trigger
                  </button>
                ) : (
                  <button
                    onClick={() => resolve(plan.id)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-955/30 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-800/30 transition-all active:scale-95 cursor-pointer"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {plans.length === 0 && !creating && (
          <p className="text-sm italic text-slate-500 py-4">
            No recovery plans configured yet.
          </p>
        )}
      </div>
    </div>
  )
}

function RecoveryEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: RecoveryPlan
  onSave: (plan: RecoveryPlan) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { tasks } = useTaskStore()
  const { blocks } = useBlockStore()

  const [name, setName] = useState(initial?.name ?? '')
  // Unified ordered task list — the single source of truth
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>(() => {
    // Initialize from existing taskIds + blockIds (flatten blocks into tasks)
    const ids: string[] = [...(initial?.taskIds ?? [])]
    for (const blockId of initial?.blockIds ?? []) {
      const block = blocks.find((b) => b.id === blockId)
      if (!block) continue
      for (const entry of [...block.entries].sort((a, b) => a.order - b.order)) {
        if (!ids.includes(entry.taskId)) ids.push(entry.taskId)
      }
    }
    return ids
  })
  const [triggerType, setTriggerType] = useState<TriggerType>(initial?.triggerType ?? 'manual')
  const [autoCondition, setAutoCondition] = useState<AutoTriggerCondition>(
    initial?.autoCondition ?? { taskId: '', consecutiveMisses: 3 }
  )
  const [baseTimeCurve, setBaseTimeCurve] = useState<TimeWeight[]>(initial?.baseTimeCurve ?? [])
  const [growthRate, setGrowthRate] = useState(initial?.growthRate ?? 0.5)
  const [saturationLimit, setSaturationLimit] = useState(initial?.saturationLimit ?? 300)

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      taskIds: orderedTaskIds.filter(Boolean),
      blockIds: [], // blocks are flattened into taskIds now
      triggerType,
      autoCondition: triggerType === 'auto' ? autoCondition : undefined,
      baseTimeCurve,
      growthRate,
      saturationLimit,
      triggered: initial?.triggered ?? false,
      triggeredAt: initial?.triggeredAt,
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

  const addTask = () => setOrderedTaskIds([...orderedTaskIds, ''])

  const importBlock = (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId)
    if (!block) return
    const newIds = [...block.entries]
      .sort((a, b) => a.order - b.order)
      .map((e) => e.taskId)
      .filter((tid) => !orderedTaskIds.includes(tid))
    setOrderedTaskIds([...orderedTaskIds, ...newIds])
  }

  const removeTask = (index: number) => {
    setOrderedTaskIds(orderedTaskIds.filter((_, i) => i !== index))
  }

  const updateTaskAt = (index: number, taskId: string) => {
    const updated = [...orderedTaskIds]
    updated[index] = taskId
    setOrderedTaskIds(updated)
  }

  // Drag handlers
  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null)
      setDragOverIdx(null)
      return
    }
    const reordered = [...orderedTaskIds]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setOrderedTaskIds(reordered)
    setDragIdx(null)
    setDragOverIdx(null)
  }
  const handleDragEnd = () => {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Plan Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Routine Recovery, Urgency Push"
          className="text-sm px-3.5 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Trigger rule configurations */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/30 p-3.5 border border-slate-800 rounded-xl">
        <div className="min-w-[120px]">
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Trigger Method
          </label>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="manual">manual</option>
            <option value="auto">auto</option>
          </select>
        </div>

        {triggerType === 'auto' && (
          <div className="flex flex-1 flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
                Monitored Task
              </label>
              <select
                value={autoCondition.taskId}
                onChange={(e) => setAutoCondition({ ...autoCondition, taskId: e.target.value })}
                className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="">-- select task --</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
                Miss Threshold
              </label>
              <input
                type="number"
                value={autoCondition.consecutiveMisses || ''}
                onChange={(e) =>
                  setAutoCondition({
                    ...autoCondition,
                    consecutiveMisses: Number(e.target.value) || 1,
                  })
                }
                className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-center"
              />
            </div>
          </div>
        )}
      </div>

      {/* Weight Dynamics Params */}
      <div className="grid grid-cols-2 gap-3 bg-slate-900/30 p-3 rounded-xl border border-slate-800">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Growth Rate (/day)
          </label>
          <input
            type="number"
            value={growthRate}
            onChange={(e) => setGrowthRate(Number(e.target.value) || 0)}
            step="0.1"
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            Saturation Limit (max weight)
          </label>
          <input
            type="number"
            value={saturationLimit}
            onChange={(e) => setSaturationLimit(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
      </div>

      {/* Unified ordered task list */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Recovery Tasks (drag to reorder)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {orderedTaskIds.filter(Boolean).length} tasks
          </span>
        </div>
        
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {orderedTaskIds.map((tid, i) => {
            const t = tasks.find((task) => task.id === tid)
            return (
              <div
                key={`${tid}-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 bg-slate-950/60 border p-2.5 rounded-xl transition-all cursor-grab active:cursor-grabbing ${
                  dragOverIdx === i ? 'border-cyan-500/50 bg-cyan-950/10' : 'border-slate-850'
                } ${dragIdx === i ? 'opacity-40' : ''}`}
              >
                {/* Drag handle + order number */}
                <span className="font-mono text-[10px] font-bold text-slate-500 w-6 text-center select-none">
                  {i + 1}
                </span>

                {/* Grip icon */}
                <svg className="w-3 h-3 text-slate-600 flex-none" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                </svg>

                <select
                  value={tid}
                  onChange={(e) => updateTaskAt(i, e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer flex-1 min-w-0"
                >
                  <option value="">-- select task --</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>

                {/* Duration badge */}
                {t && (
                  <span className="text-[10px] font-mono text-slate-500 flex-none">
                    {t.durationMinutes}m
                  </span>
                )}

                <button
                  onClick={() => removeTask(i)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer flex-none"
                >
                  <XIcon />
                </button>
              </div>
            )
          })}
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={addTask}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-850 transition-all cursor-pointer"
          >
            <PlusIcon /> Add Task
          </button>

          {/* Import from block dropdown */}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) importBlock(e.target.value)
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-350 focus:outline-none cursor-pointer"
          >
            <option value="">⬇ Import from block...</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.entries.length} tasks)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Base time weights */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Base Time-Of-Day Weight Curve
        </span>
        
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {baseTimeCurve.map((pt, i) => (
            <div key={i} className="flex items-center gap-2 text-xs flex-wrap bg-slate-950/60 border border-slate-850 p-2 rounded-xl">
              <input
                type="time"
                value={toTimeStr(pt.time)}
                onChange={(e) => {
                  const updated = [...baseTimeCurve]
                  updated[i] = { ...updated[i], time: fromTimeStr(e.target.value) }
                  setBaseTimeCurve(updated)
                }}
                className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 cursor-pointer focus:outline-none"
              />
              <span className="text-slate-500 font-bold">=</span>
              <input
                type="number"
                value={pt.value}
                onChange={(e) => {
                  const updated = [...baseTimeCurve]
                  updated[i] = { ...updated[i], value: Number(e.target.value) || 0 }
                  setBaseTimeCurve(updated)
                }}
                className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-center text-slate-202 font-semibold focus:outline-none"
              />
              <button
                onClick={() => setBaseTimeCurve(baseTimeCurve.filter((_, j) => j !== i))}
                className="p-1 rounded text-slate-400 hover:bg-rose-955/25 hover:text-rose-455 transition-all cursor-pointer"
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setBaseTimeCurve([...baseTimeCurve, { time: 600, value: 50 }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-855 transition-all cursor-pointer"
        >
          <PlusIcon /> Add Point
        </button>
      </div>

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Recovery Plan
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

export default RecoveryPanel
