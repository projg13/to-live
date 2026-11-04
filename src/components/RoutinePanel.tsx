import { useState } from 'react'
import { useRoutineStore } from '../store/routineStore'
import { useBlockStore } from '../store/blockStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import type { Routine, RoutineTaskConfig, RoutineBlockConfig } from '../types/routine'

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
  const { blocks } = useBlockStore()
  const { anchors } = useAnchorStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6 text-slate-100">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100 font-sans">
            Routines & Slot Task Customizations
          </h3>
          <p className="text-xs text-slate-400">
            Customize Task Templates per slot with hierarchical/relative weights, custom durations, start/end boundaries, and expiry.
          </p>
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
              className={`flex justify-between items-center py-3.5 px-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm transition-all ${
                !routine.enabled ? 'opacity-40' : ''
              }`}
            >
              <div
                onClick={() => setEditing(routine.id)}
                className="cursor-pointer flex-1 space-y-1.5 pr-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-200 text-[15px]">{routine.name}</span>
                  {routine.baseWeight !== undefined && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-900/40 text-cyan-300">
                      ⚡ Routine Base W: {routine.baseWeight}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  {routine.blockConfigs.map((bc) => {
                    const b = blocks.find((bl) => bl.id === bc.blockId)
                    const a = anchors.find((an) => an.id === bc.anchorId)
                    return (
                      <span
                        key={bc.blockId}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300"
                      >
                        📦 {b?.name ?? bc.blockId} → ⚓ {a?.name ?? 'Unassigned'}
                      </span>
                    )
                  })}
                  <span>• {routine.taskConfigs?.length ?? 0} customized task(s)</span>
                  {routine.sequencerId && (
                    <span className="text-pink-400 font-mono">• 🧬 Sequencer: {routine.sequencerId}</span>
                  )}
                </div>
              </div>

              {/* Duplicate + Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    addRoutine({
                      ...routine,
                      id: crypto.randomUUID(),
                      name: `${routine.name} (copy)`,
                      blockConfigs: routine.blockConfigs.map((bc) => ({ ...bc })),
                      taskConfigs: routine.taskConfigs?.map((tc) => ({ ...tc })),
                    })
                  }
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-cyan-400 transition-all cursor-pointer"
                  title="Duplicate routine"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => toggleEnabled(routine.id)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 focus:outline-none ${
                    routine.enabled ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                      routine.enabled ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
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
  const { slots, anchors, templates } = useAnchorStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [baseWeight, setBaseWeight] = useState<number | ''>(initial?.baseWeight ?? '')
  const [blockConfigs, setBlockConfigs] = useState<RoutineBlockConfig[]>(initial?.blockConfigs ?? [])
  const [taskConfigs, setTaskConfigs] = useState<RoutineTaskConfig[]>(initial?.taskConfigs ?? [])
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [sequencerId, setSequencerId] = useState(initial?.sequencerId ?? '')

  // Ordered task list from selected blocks (preserving block & entry structural order)
  const orderedRoutineTasks: {
    taskId: string
    blockId: string
    blockName: string
    anchorId: string
    anchorName: string
    isBackground: boolean
    requires?: string[]
  }[] = []
  const seenTaskIds = new Set<string>()
  for (const bc of blockConfigs) {
    const b = blocks.find((bl) => bl.id === bc.blockId)
    if (!b) continue
    const a = anchors.find((an) => an.id === bc.anchorId)
    const sortedEntries = [...b.entries].sort((x, y) => x.order - y.order)
    for (const entry of sortedEntries) {
      if (seenTaskIds.has(entry.taskId)) continue
      seenTaskIds.add(entry.taskId)
      orderedRoutineTasks.push({
        taskId: entry.taskId,
        blockId: b.id,
        blockName: b.name,
        anchorId: bc.anchorId,
        anchorName: a?.name ?? 'Unassigned',
        isBackground: entry.isBackground,
        requires: entry.requires,
      })
    }
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      baseWeight: typeof baseWeight === 'number' && baseWeight >= 0 ? baseWeight : undefined,
      blockConfigs,
      taskConfigs: taskConfigs.length > 0 ? taskConfigs : undefined,
      sequencerId: sequencerId.trim() ? sequencerId.trim() : undefined,
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
      setTaskConfigs(taskConfigs.map((tc) => (tc.taskId === taskId ? { ...tc, ...updates } : tc)))
    } else {
      setTaskConfigs([...taskConfigs, { taskId, ...updates }])
    }
  }

  // Auto-assign descending relative weights (+25, +20, +15, ...) in block/DAG order so structural hierarchy is preserved
  const autoStructureRelativeWeights = () => {
    const total = orderedRoutineTasks.length
    if (total === 0) return
    const nextConfigs = [...taskConfigs]
    orderedRoutineTasks.forEach((item, index) => {
      const stepOffset = (total - 1 - index) * 5
      const existing = nextConfigs.find((tc) => tc.taskId === item.taskId)
      if (existing) {
        existing.relativeWeight = stepOffset
      } else {
        nextConfigs.push({ taskId: item.taskId, relativeWeight: stepOffset })
      }
    })
    setTaskConfigs(nextConfigs)
  }

  const effectiveRoutineBase = typeof baseWeight === 'number' ? baseWeight : 100

  return (
    <div className="space-y-4">
      {/* Top Row: Routine Name + Routine Base Weight + Enabled */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Routine Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Routine, Afternoon Routine, Evening Wrapup"
            className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">
            Routine Origin Weight
          </label>
          <input
            type="number"
            value={baseWeight}
            placeholder="100 (Slot Baseline)"
            onChange={(e) => setBaseWeight(e.target.value ? Number(e.target.value) : '')}
            className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-cyan-900/40 rounded-xl text-cyan-300 font-mono focus:outline-none"
          />
        </div>
      </div>

      {/* Enabled + RoutineSequencer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        <div className="flex items-center gap-1.5 p-2.5 bg-slate-900/30 border border-slate-800 rounded-xl">
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

        <div>
          <select
            value={sequencerId}
            onChange={(e) => setSequencerId(e.target.value)}
            className="text-xs px-3 py-2.5 w-full bg-slate-950 border border-pink-900/40 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="">🧬 Sequencer: None (Standard Slot Routine)</option>
            <option value="cooking-sequencer">
              🧬 cooking-sequencer (Groceries → 3-Day Prep TTL → Cook vs Quick Bites)
            </option>
          </select>
        </div>
      </div>

      {/* Block configs (Slot Containers between Anchors) */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Blocks → Anchor / Slot Mapping
        </span>

        {/* Add block dropdown */}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !blockConfigs.some((bc) => bc.blockId === e.target.value)) {
              setBlockConfigs([
                ...blockConfigs,
                {
                  blockId: e.target.value,
                  anchorId: '',
                },
              ])
            }
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-350 focus:outline-none cursor-pointer w-full"
        >
          <option value="" className="bg-slate-950 text-slate-500">
            ＋ Attach Block to this Routine…
          </option>
          {blocks
            .filter((b) => !blockConfigs.some((bc) => bc.blockId === b.id))
            .map((b) => (
              <option key={b.id} value={b.id} className="bg-slate-950 text-slate-200">
                {b.name}
              </option>
            ))}
        </select>

        {/* Per-block config cards */}
        {blockConfigs.map((bc, idx) => {
          const b = blocks.find((bl) => bl.id === bc.blockId)
          const blockDuration = b
            ? b.entries.reduce((sum, e) => {
                const tc = taskConfigs.find((c) => c.taskId === e.taskId)
                const t = tasks.find((tt) => tt.id === e.taskId)
                return sum + (tc?.durationMinutes ?? t?.durationMinutes ?? 30)
              }, 0)
            : 0

          return (
            <div key={bc.blockId} className="bg-slate-955 border border-slate-850 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-cyan-400">{b?.name ?? bc.blockId}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {blockDuration}m customized · {b?.entries.length ?? 0} tasks
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
                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                  Starts At Anchor (Slot Bearer Origin)
                </label>
                <select
                  value={bc.anchorId}
                  onChange={(e) => {
                    const updated = [...blockConfigs]
                    updated[idx] = { ...updated[idx], anchorId: e.target.value }
                    setBlockConfigs(updated)
                  }}
                  className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="">-- select anchor --</option>
                  {anchors.map((a) => (
                    <option key={a.id} value={a.id}>
                      ⚓ {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}

        {/* Live duration summary */}
        {blockConfigs.length > 0 &&
          (() => {
            let totalDuration = 0
            let taskCount = 0
            for (const bc of blockConfigs) {
              const b = blocks.find((bl) => bl.id === bc.blockId)
              if (!b) continue
              for (const entry of b.entries) {
                const tc = taskConfigs.find((c) => c.taskId === entry.taskId)
                const t = tasks.find((tt) => tt.id === entry.taskId)
                totalDuration += tc?.durationMinutes ?? t?.durationMinutes ?? 30
                taskCount++
              }
            }
            const hrs = Math.floor(totalDuration / 60)
            const mins = totalDuration % 60
            return (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Routine Slot Total (Customized Durations)
                </span>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-cyan-300 font-bold">
                    {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                  </span>
                  <span className="text-slate-400">{taskCount} tasks</span>
                </div>
              </div>
            )
          })()}
      </div>

      {/* Inline Customized Tasks Over Templates */}
      {orderedRoutineTasks.length > 0 && (
        <div className="space-y-3 pl-3.5 border-l-2 border-cyan-500/70 bg-slate-900/15 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                Customized Tasks Over Template ({orderedRoutineTasks.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Each task inherits its name from the Task Template and customizes duration, relative weight, start/end window, and expiry here.
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={autoStructureRelativeWeights}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-amber-700/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 transition-all cursor-pointer font-bold"
                title="Automatically assign descending relative weights (+25, +20, +15...) in block order so structure is maintained"
              >
                ⚡ Auto-Structure Relative Weights
              </button>

              {/* Populate Ideal Times from a template */}
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  const template = templates.find((t) => t.id === e.target.value)
                  if (!template) return

                  const newConfigs = [...taskConfigs]
                  for (const bc of blockConfigs) {
                    const templateEntry = template.entries.find((te) => te.anchorId === bc.anchorId)
                    if (!templateEntry) continue
                    const block = blocks.find((b) => b.id === bc.blockId)
                    if (!block) continue

                    for (const entry of block.entries) {
                      const existing = newConfigs.find((tc) => tc.taskId === entry.taskId)
                      if (existing) {
                        existing.idealTime = templateEntry.spikeTime
                      } else {
                        newConfigs.push({ taskId: entry.taskId, idealTime: templateEntry.spikeTime })
                      }
                    }
                  }
                  setTaskConfigs(newConfigs)
                }}
                className="text-[10px] px-2 py-1 rounded-lg border border-cyan-800/30 bg-cyan-950/20 text-cyan-400 focus:outline-none cursor-pointer font-bold"
              >
                <option value="">⏰ Populate start times…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setTaskConfigs(
                    taskConfigs.map((tc) => {
                      const copy = { ...tc }
                      delete copy.idealTime
                      return copy
                    })
                  )
                }}
                className="text-[10px] px-2 py-1 rounded-lg border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-rose-400 hover:border-rose-800/30 transition-all cursor-pointer font-bold"
              >
                ✕ Clear starts
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            {orderedRoutineTasks.map((item, idx) => {
              const { taskId, blockName, anchorName, isBackground, requires } = item
              const task = tasks.find((t) => t.id === taskId)
              if (!task) return null
              const config = taskConfigs.find((tc) => tc.taskId === taskId)

              const templateDur = task.durationMinutes || 30
              const templateMin = task.minDurationMinutes ?? templateDur
              const baseW = typeof baseWeight === 'number' ? baseWeight : (task.weight || 100)
              const relW = config?.relativeWeight ?? 0
              const effectiveFlatW = Math.max(0, baseW + relW)
              const hasSlotCurves = Boolean(
                config?.slotWeights && Object.keys(config.slotWeights).length > 0
              )

              return (
                <div
                  key={taskId}
                  className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-xl space-y-3"
                >
                  {/* Header: Order + Template Name + Effective Hierarchical Weight */}
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-100 tracking-wide">
                        {config?.titleOverride || task.title}
                      </span>
                      {config?.titleOverride && (
                        <span className="text-[10px] text-slate-500">
                          (tpl: {task.title})
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                        📦 {blockName} · ⚓ {anchorName}
                      </span>
                      {isBackground && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300">
                          bg
                        </span>
                      )}
                      {requires && requires.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-amber-300">
                          after {requires.length} parent(s)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-900/40 text-cyan-300">
                        ⚡ Eff W: {effectiveFlatW} ({effectiveRoutineBase} {relW >= 0 ? `+ ${relW}` : `- ${Math.abs(relW)}`})
                      </span>
                      {config && (
                        <button
                          type="button"
                          onClick={() => removeTaskConfig(taskId)}
                          className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:bg-rose-950/30 hover:text-rose-400 transition-all cursor-pointer"
                          title="Reset task to template defaults"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 1: Duration Override, Min Floor Override, Relative Weight, Custom Label */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider block mb-0.5">
                        Slot Duration (min)
                      </label>
                      <input
                        type="number"
                        value={config?.durationMinutes ?? ''}
                        placeholder={`Tpl: ${templateDur}m`}
                        onChange={(e) =>
                          setTaskConfig(taskId, {
                            durationMinutes: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none w-full font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                        Min Shrink Floor (min)
                      </label>
                      <input
                        type="number"
                        value={config?.minDurationMinutes ?? ''}
                        placeholder={`Tpl: ${templateMin}m`}
                        onChange={(e) =>
                          setTaskConfig(taskId, {
                            minDurationMinutes: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="text-xs px-2.5 py-1 bg-slate-900 border border-amber-900/40 rounded-lg text-amber-300 focus:outline-none w-full font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block mb-0.5">
                        Relative Weight (±W)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={config?.relativeWeight ?? ''}
                          placeholder="0 (flat base)"
                          onChange={(e) =>
                            setTaskConfig(taskId, {
                              relativeWeight:
                                e.target.value !== '' ? Number(e.target.value) : undefined,
                            })
                          }
                          className="text-xs px-2 py-1 bg-slate-900 border border-emerald-900/40 rounded-lg text-emerald-300 focus:outline-none w-full font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                        Custom Slot Label
                      </label>
                      <input
                        type="text"
                        value={config?.titleOverride ?? ''}
                        placeholder={task.title}
                        onChange={(e) =>
                          setTaskConfig(taskId, {
                            titleOverride: e.target.value || undefined,
                          })
                        }
                        className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 focus:outline-none w-full"
                      />
                    </div>
                  </div>

                  {/* Row 2: Start Time (idealTime), End Boundary (idealEndTime), Expiry Offset (min) */}
                  <div className="grid grid-cols-3 gap-2.5 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Start Time (Window)
                      </label>
                      <input
                        type="time"
                        value={config?.idealTime !== undefined ? toTimeStr(config.idealTime) : ''}
                        onChange={(e) =>
                          setTaskConfig(taskId, {
                            idealTime: e.target.value ? fromTimeStr(e.target.value) : undefined,
                          })
                        }
                        className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none cursor-pointer w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Hard End Boundary
                      </label>
                      <input
                        type="time"
                        value={
                          config?.idealEndTime !== undefined ? toTimeStr(config.idealEndTime) : ''
                        }
                        onChange={(e) =>
                          setTaskConfig(taskId, {
                            idealEndTime: e.target.value ? fromTimeStr(e.target.value) : undefined,
                          })
                        }
                        className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none cursor-pointer w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block mb-0.5">
                        Expiry Offset (min)
                      </label>
                      <input
                        type="number"
                        value={config?.expiresAfterMinutes ?? ''}
                        onChange={(e) =>
                          setTaskConfig(taskId, {
                            expiresAfterMinutes: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="No expiry"
                        className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none w-full font-mono"
                      />
                    </div>
                  </div>

                  {/* Alter-Ego preset selector */}
                  {task.knobs?.hasAlterEgos && task.alterEgos && task.alterEgos.length > 0 && (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                        🎭 Selected Alter-Ego Mode:
                      </label>
                      <select
                        value={config?.selectedAlterEgoId ?? ''}
                        onChange={(e) =>
                          setTaskConfig(taskId, { selectedAlterEgoId: e.target.value || undefined })
                        }
                        className="text-xs px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="">(Auto-detect by start delay)</option>
                        {task.alterEgos.map((ae) => (
                          <option key={ae.id} value={ae.id}>
                            {ae.name} ({ae.durationMinutes}m)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Row 3: Slot Weight Curves (Optional Slab / Piecewise Overrides) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Slot Weight Curve{' '}
                        <span className="text-slate-500 font-normal">
                          ({hasSlotCurves ? 'slot-scoped curve + relative offset' : 'using Routine Origin + Relative Weight'})
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        {hasSlotCurves && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>Other slots →</span>
                            <input
                              type="number"
                              value={config?.fallbackWeight ?? 0}
                              onChange={(e) =>
                                setTaskConfig(taskId, {
                                  fallbackWeight: Number(e.target.value) || 0,
                                })
                              }
                              className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-amber-400 font-bold text-[10px]"
                            />
                          </div>
                        )}
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const current = config?.slotWeights ?? {}
                              setTaskConfig(taskId, {
                                slotWeights: {
                                  ...current,
                                  [e.target.value]: [{ offsetMinutes: 0, value: baseW }],
                                },
                              })
                            }
                          }}
                          className="text-[10px] px-2 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="">＋ Add Slot Curve…</option>
                          {slots
                            .filter((s) => !config?.slotWeights?.[s.id])
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Active slots */}
                    {Object.entries(config?.slotWeights ?? {}).map(([slotId, points]) => {
                      const slot = slots.find((s) => s.id === slotId)
                      const isFlat = points.length <= 1
                      const flatWeight = points[0]?.value ?? 0

                      return (
                        <div
                          key={slotId}
                          className="pl-3 border-l-2 border-cyan-800/40 py-1.5 space-y-2 bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/60"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-cyan-400">
                                {slot?.name ?? slotId}
                              </span>
                              {isFlat ? (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  flat slab (eff: {Math.max(0, flatWeight + relW)})
                                </span>
                              ) : (
                                <span className="text-[9px] text-purple-400 font-mono">
                                  {points.length} piecewise pts (rel {relW >= 0 ? `+${relW}` : relW})
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const current = { ...config?.slotWeights }
                                delete current[slotId]
                                setTaskConfig(taskId, {
                                  slotWeights:
                                    Object.keys(current).length > 0 ? current : undefined,
                                })
                              }}
                              className="p-0.5 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                            >
                              <XIcon />
                            </button>
                          </div>

                          {/* Flat mode: single weight input */}
                          {isFlat && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400">Slot Base Weight:</span>
                              <input
                                type="number"
                                value={flatWeight}
                                onChange={(e) => {
                                  const current = config?.slotWeights ?? {}
                                  setTaskConfig(taskId, {
                                    slotWeights: {
                                      ...current,
                                      [slotId]: [
                                        { offsetMinutes: 0, value: Number(e.target.value) || 0 },
                                      ],
                                    },
                                  })
                                }}
                                className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-200 font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const current = config?.slotWeights ?? {}
                                  setTaskConfig(taskId, {
                                    slotWeights: {
                                      ...current,
                                      [slotId]: [...points, { offsetMinutes: 60, value: 0 }],
                                    },
                                  })
                                }}
                                className="text-[9px] font-bold text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-auto"
                              >
                                <PlusIcon /> Piecewise Window
                              </button>
                            </div>
                          )}

                          {/* Piecewise mode: multiple offset→value points */}
                          {!isFlat && (
                            <>
                              <div className="space-y-1.5">
                                {points.map((pt, pi) => (
                                  <div
                                    key={pi}
                                    className="flex items-center gap-1.5 text-xs flex-wrap"
                                  >
                                    <span className="text-slate-500">+</span>
                                    <input
                                      type="number"
                                      value={pt.offsetMinutes}
                                      onChange={(e) => {
                                        const updated = [...points]
                                        updated[pi] = {
                                          ...updated[pi],
                                          offsetMinutes: Number(e.target.value) || 0,
                                        }
                                        const current = config?.slotWeights ?? {}
                                        setTaskConfig(taskId, {
                                          slotWeights: { ...current, [slotId]: updated },
                                        })
                                      }}
                                      className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-300"
                                    />
                                    <span className="text-slate-500">min →</span>
                                    <input
                                      type="number"
                                      value={pt.value}
                                      onChange={(e) => {
                                        const updated = [...points]
                                        updated[pi] = {
                                          ...updated[pi],
                                          value: Number(e.target.value) || 0,
                                        }
                                        const current = config?.slotWeights ?? {}
                                        setTaskConfig(taskId, {
                                          slotWeights: { ...current, [slotId]: updated },
                                        })
                                      }}
                                      className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-slate-200 font-semibold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = points.filter((_, j) => j !== pi)
                                        const current = config?.slotWeights ?? {}
                                        if (updated.length === 0) {
                                          const { [slotId]: _, ...rest } = current
                                          setTaskConfig(taskId, {
                                            slotWeights:
                                              Object.keys(rest).length > 0 ? rest : undefined,
                                          })
                                        } else {
                                          setTaskConfig(taskId, {
                                            slotWeights: { ...current, [slotId]: updated },
                                          })
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
                                  const newPt = {
                                    offsetMinutes: (last?.offsetMinutes ?? 0) + 60,
                                    value: 0,
                                  }
                                  const current = config?.slotWeights ?? {}
                                  setTaskConfig(taskId, {
                                    slotWeights: { ...current, [slotId]: [...points, newPt] },
                                  })
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
