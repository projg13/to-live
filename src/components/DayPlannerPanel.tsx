import { useState } from 'react'
import { usePlannerStore } from '../store/plannerStore'
import { useAnchorStore } from '../store/anchorStore'
import { useRoutineStore } from '../store/routineStore'
import type { DayPlan } from '../types/planner'
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

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

function DayPlannerPanel() {
  const { dayPlans, weekPlan, addDayPlan, updateDayPlan, deleteDayPlan, setWeekDay } = usePlannerStore()
  const { templates, slots, anchors } = useAnchorStore()
  const { routines } = useRoutineStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-8">
      {/* Day Plans section */}
      <section className="space-y-4">
        <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black tracking-wide text-slate-100">Day Templates</h3>
            <p className="text-xs text-slate-400">Pick an anchor template → see its slots → assign routines.</p>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
            >
              <PlusIcon /> New Day Plan
            </button>
          )}
        </div>

        {creating && (
          <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
            <DayPlanEditor
              templates={templates}
              slots={slots}
              anchors={anchors}
              routines={routines}
              onSave={(plan) => {
                addDayPlan(plan)
                setCreating(false)
              }}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dayPlans.map((plan) => {
            if (editing === plan.id) {
              return (
                <div key={plan.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4 md:col-span-2">
                  <DayPlanEditor
                    initial={plan}
                    templates={templates}
                    slots={slots}
                    anchors={anchors}
                    routines={routines}
                    onSave={(updated) => {
                      updateDayPlan(plan.id, updated)
                      setEditing(null)
                    }}
                    onCancel={() => setEditing(null)}
                    onDelete={() => {
                      deleteDayPlan(plan.id)
                      setEditing(null)
                    }}
                  />
                </div>
              )
            }

            const tpl = templates.find((t) => t.id === plan.templateId)

            return (
              <div
                key={plan.id}
                onClick={() => setEditing(plan.id)}
                className="group p-4 bg-slate-955/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm cursor-pointer hover:border-cyan-500/25 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <span className="font-bold text-slate-200 text-[15px] block mb-1">
                    {plan.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {tpl ? tpl.name : 'No template'}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tpl && (
                      <span className="inline-flex text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-400">
                        {tpl.entries.length} anchor(s)
                      </span>
                    )}
                    <span className="inline-flex text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-400">
                      {plan.routineIds.length} routine(s)
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-3 mt-3 border-t border-slate-850 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[11px] font-bold text-cyan-400">
                    Edit Plan
                  </span>
                </div>
              </div>
            )
          })}
          
          {dayPlans.length === 0 && !creating && (
            <p className="text-sm italic text-slate-500 py-4 col-span-2">
              No day templates configured yet. Create one to pair an anchor template with routines.
            </p>
          )}
        </div>
      </section>

      {/* Week Planner section */}
      <section className="space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="text-lg font-black tracking-wide text-slate-100 flex items-center gap-1.5">
            <CalendarIcon /> Week Planner
          </h3>
          <p className="text-xs text-slate-400">Map a Day Template to each day of the week.</p>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-850 shadow-sm">
          {weekDays.map((dayName, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:px-4"
            >
              <span className="text-sm font-bold text-slate-300 w-28">
                {dayName}
              </span>
              <select
                value={weekPlan.days[i] ?? ''}
                onChange={(e) => setWeekDay(i, e.target.value)}
                className="text-xs px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-350 focus:outline-none cursor-pointer w-full sm:max-w-xs"
              >
                <option value="">-- no day template --</option>
                {dayPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DayPlanEditor({
  initial,
  templates,
  slots,
  anchors,
  routines,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: DayPlan
  templates: { id: string; name: string; entries: { anchorId: string; spikeTime: number; slotId: string }[] }[]
  slots: { id: string; name: string }[]
  anchors: { id: string; name: string }[]
  routines: { id: string; name: string }[]
  onSave: (plan: DayPlan) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [templateId, setTemplateId] = useState(initial?.templateId ?? '')
  const [routineIds, setRoutineIds] = useState<string[]>(initial?.routineIds ?? [])

  const selectedTemplate = templates.find((t) => t.id === templateId)
  const inferredSlots = selectedTemplate
    ? selectedTemplate.entries.map((e) => {
        const anchor = anchors.find((a) => a.id === e.anchorId)
        const slot = slots.find((s) => s.id === e.slotId)
        return { anchorId: e.anchorId, anchorName: anchor?.name ?? e.anchorId, slotId: e.slotId, slotName: slot?.name ?? e.slotId, spikeTime: e.spikeTime }
      }).sort((a, b) => a.spikeTime - b.spikeTime)
    : []

  const handleSave = () => {
    if (!name.trim() || !templateId) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      templateId,
      routineIds,
    })
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
          placeholder="e.g. Standard Workday, Holiday"
          className="text-sm px-3.5 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Anchor Template selector */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Anchor Template
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="text-sm px-3.5 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none cursor-pointer"
        >
          <option value="">-- select template --</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Inferred anchors & slots (read-only) */}
      {selectedTemplate && inferredSlots.length > 0 && (
        <div className="space-y-1.5 pl-4 border-l-2 border-slate-700 bg-slate-900/20 p-3 rounded-2xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Structure (from template)
          </span>
          {inferredSlots.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-mono w-16 text-right">{formatTime(s.spikeTime)}</span>
              <span className="text-slate-400 font-bold">{s.anchorName}</span>
              <span className="text-slate-600">→</span>
              <span className="text-cyan-400 font-semibold">{s.slotName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Routines — add via dropdown */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Routines
        </span>

        {/* Dropdown to add routine */}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value && !routineIds.includes(e.target.value)) {
              setRoutineIds([...routineIds, e.target.value])
            }
          }}
          className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-350 focus:outline-none cursor-pointer w-full"
        >
          <option value="" className="text-slate-500">＋ Add routine…</option>
          {routines
            .filter((r) => !routineIds.includes(r.id))
            .map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
        </select>
        
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {routineIds.map((rid) => {
            const routine = routines.find((r) => r.id === rid)
            return (
              <div
                key={rid}
                className="flex items-center justify-between bg-slate-950/60 border border-slate-850 p-2 px-3 rounded-xl"
              >
                <span className="text-xs font-semibold text-slate-300">{routine?.name ?? rid}</span>
                <button
                  onClick={() => setRoutineIds(routineIds.filter((id) => id !== rid))}
                  className="p-1 rounded-lg text-slate-400 hover:bg-rose-955/25 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <XIcon />
                </button>
              </div>
            )
          })}
        </div>

        {routineIds.length === 0 && (
          <p className="text-[11px] italic text-slate-600">No routines assigned yet.</p>
        )}
      </div>

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!name.trim() || !templateId}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckIcon /> Save Day Plan
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

export default DayPlannerPanel
