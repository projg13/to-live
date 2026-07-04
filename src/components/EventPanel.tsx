import { useState } from 'react'
import { usePlannerStore } from '../store/plannerStore'
import { useTaskStore } from '../store/taskStore'
import type { CalendarEvent, EventTemplate } from '../types/planner'

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
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

// --- Helpers ---
function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (d <= last) {
    dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ======================= MAIN PANEL =======================
function EventPanel() {
  const { calendarEvents, dayPlans, eventTemplates, addEvent, updateEvent, deleteEvent, addEventTemplate, deleteEventTemplate } = usePlannerStore()
  const { tasks } = useTaskStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Calendar Events</h3>
          <p className="text-xs text-slate-400">Create events, use templates, and override day plans per date.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
              showTemplates ? 'bg-indigo-500/20 text-indigo-400 border-indigo-700/40' : 'bg-slate-950/65 text-slate-400 border-slate-850 hover:text-slate-300'
            }`}
          >
            <CopyIcon /> Templates
          </button>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
            >
              <PlusIcon /> New Event
            </button>
          )}
        </div>
      </div>

      {/* Templates section */}
      {showTemplates && (
        <TemplateSection
          templates={eventTemplates}
          dayPlans={dayPlans}
          tasks={tasks}
          onAddTemplate={addEventTemplate}
          onDeleteTemplate={(id) => deleteEventTemplate(id)}
          onUseTemplate={(tpl) => {
            // Pre-fill an event from a template
            setCreating(true)
            // We pass the template down via a special initial value
            setEditing(`tpl:${tpl.id}`)
          }}
        />
      )}

      {/* Event editor for new event */}
      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <EventEditor
            dayPlans={dayPlans}
            tasks={tasks}
            templates={eventTemplates}
            initialTemplateId={editing?.startsWith('tpl:') ? editing.slice(4) : undefined}
            onSave={(e) => {
              addEvent(e)
              setCreating(false)
              setEditing(null)
            }}
            onCancel={() => { setCreating(false); setEditing(null) }}
          />
        </div>
      )}

      {/* Existing events */}
      <div className="space-y-2">
        {calendarEvents.map((ev) => {
          if (editing === ev.id) {
            return (
              <div key={ev.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <EventEditor
                  initial={ev}
                  dayPlans={dayPlans}
                  tasks={tasks}
                  templates={eventTemplates}
                  onSave={(updated) => {
                    updateEvent(ev.id, updated)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    deleteEvent(ev.id)
                    setEditing(null)
                  }}
                />
              </div>
            )
          }
          return (
            <div
              key={ev.id}
              onClick={() => setEditing(ev.id)}
              className="flex items-center justify-between gap-3 bg-slate-955/80 border border-slate-850 rounded-2xl px-4 py-3 hover:bg-slate-900 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-950/50 text-indigo-400 flex items-center justify-center border border-indigo-800/30">
                  <CalendarIcon />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-200 truncate">{ev.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {ev.date}{ev.endDate ? ` → ${ev.endDate}` : ''}
                    {ev.suspendRegular && <span className="ml-2 text-amber-500/70">⚡ suspended</span>}
                    {ev.weightOffset && ev.weightOffset > 0 && <span className="ml-1 text-amber-500/70">(offset {ev.weightOffset})</span>}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">Edit →</span>
            </div>
          )
        })}

        {calendarEvents.length === 0 && !creating && (
          <p className="text-sm italic text-slate-500 py-4">
            No events scheduled yet. Create an event to override templates on specific days.
          </p>
        )}
      </div>
    </div>
  )
}

// ======================= TEMPLATES =======================
function TemplateSection({
  templates,
  dayPlans,
  tasks,
  onAddTemplate,
  onDeleteTemplate,
  onUseTemplate,
}: {
  templates: EventTemplate[]
  dayPlans: { id: string; name: string }[]
  tasks: { id: string; title: string }[]
  onAddTemplate: (tpl: EventTemplate) => void
  onDeleteTemplate: (id: string) => void
  onUseTemplate: (tpl: EventTemplate) => void
}) {
  const [creatingTpl, setCreatingTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplSuspend, setTplSuspend] = useState(false)
  const [tplOffset, setTplOffset] = useState(0)
  const [tplDayPlan, setTplDayPlan] = useState('')
  const [tplTaskIds, setTplTaskIds] = useState<string[]>([])

  const handleSaveTpl = () => {
    if (!tplName.trim()) return
    onAddTemplate({
      id: crypto.randomUUID(),
      name: tplName.trim(),
      suspendRegular: tplSuspend,
      weightOffset: tplOffset > 0 ? tplOffset : undefined,
      taskIds: tplTaskIds,
      dayPlanOverride: tplDayPlan || undefined,
    })
    setCreatingTpl(false)
    setTplName('')
    setTplSuspend(false)
    setTplOffset(0)
    setTplDayPlan('')
    setTplTaskIds([])
  }

  return (
    <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Event Templates</span>
        {!creatingTpl && (
          <button
            onClick={() => setCreatingTpl(true)}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            + New Template
          </button>
        )}
      </div>

      {creatingTpl && (
        <div className="space-y-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
          <input
            type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
            placeholder="Template name (e.g. Weekend Getaway)"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={tplSuspend} onChange={(e) => setTplSuspend(e.target.checked)} className="rounded border-slate-700 bg-slate-955 text-cyan-500 h-3.5 w-3.5 cursor-pointer" />
              Suspend regular tasks
            </label>
            {tplSuspend && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Offset:</span>
                <input type="number" min={0} value={tplOffset} onChange={(e) => setTplOffset(Number(e.target.value) || 0)}
                  className="text-xs px-2 py-1 w-20 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Day plan:</span>
              <select value={tplDayPlan} onChange={(e) => setTplDayPlan(e.target.value)}
                className="text-xs px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 cursor-pointer">
                <option value="">-- default --</option>
                {dayPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveTpl} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-all cursor-pointer"><CheckIcon /> Save</button>
            <button onClick={() => setCreatingTpl(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-300 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {templates.length === 0 && !creatingTpl && (
        <p className="text-[11px] italic text-slate-500">No templates yet. Create one to quickly spin up events.</p>
      )}

      <div className="space-y-1.5">
        {templates.map((tpl) => (
          <div key={tpl.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-850 rounded-xl px-3 py-2">
            <div>
              <span className="text-xs font-bold text-slate-200">{tpl.name}</span>
              <span className="text-[10px] text-slate-500 ml-2">
                {tpl.suspendRegular ? '⚡ suspend' : ''}
                {tpl.weightOffset ? ` (offset ${tpl.weightOffset})` : ''}
                {tpl.dayPlanOverride ? ` • ${dayPlans.find((p) => p.id === tpl.dayPlanOverride)?.name ?? 'plan'}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => onUseTemplate(tpl)} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer">Use</button>
              <button onClick={() => onDeleteTemplate(tpl.id)} className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer"><XIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ======================= EVENT EDITOR =======================
function EventEditor({
  initial,
  dayPlans,
  tasks,
  templates,
  initialTemplateId,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: CalendarEvent
  dayPlans: { id: string; name: string }[]
  tasks: { id: string; title: string }[]
  templates?: EventTemplate[]
  initialTemplateId?: string
  onSave: (event: CalendarEvent) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  // Pre-fill from template if provided
  const tpl = initialTemplateId ? templates?.find((t) => t.id === initialTemplateId) : undefined

  const [name, setName] = useState(initial?.name ?? tpl?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [taskIds, setTaskIds] = useState<string[]>(initial?.taskIds ?? tpl?.taskIds ?? [])
  const [suspendRegular, setSuspendRegular] = useState(initial?.suspendRegular ?? tpl?.suspendRegular ?? false)
  const [weightOffset, setWeightOffset] = useState(initial?.weightOffset ?? tpl?.weightOffset ?? 0)
  const [dayPlanOverride, setDayPlanOverride] = useState(initial?.dayPlanOverride ?? tpl?.dayPlanOverride ?? '')
  const [dayPlanOverrides, setDayPlanOverrides] = useState<Record<string, string>>(initial?.dayPlanOverrides ?? {})
  const [usePiecewise, setUsePiecewise] = useState(!!initial?.dayPlanOverrides && Object.keys(initial.dayPlanOverrides).length > 0)
  const [taskSearch, setTaskSearch] = useState('')

  const filteredTasks = tasks.filter(
    (t) => t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !taskIds.includes(t.id)
  )

  // Compute dates for piecewise picker
  const eventDates = date && endDate ? getDatesBetween(date, endDate) : date ? [date] : []

  const handleSave = () => {
    if (!name.trim() || !date) return
    const ev: CalendarEvent = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      date,
      endDate: endDate || undefined,
      taskIds,
      suspendRegular,
      weightOffset: weightOffset > 0 ? weightOffset : undefined,
      dayPlanOverride: !usePiecewise && dayPlanOverride ? dayPlanOverride : undefined,
      dayPlanOverrides: usePiecewise && Object.keys(dayPlanOverrides).length > 0 ? dayPlanOverrides : undefined,
      templateId: tpl?.id,
    }
    onSave(ev)
  }

  return (
    <div className="space-y-4">
      {/* Template selector for new events */}
      {!initial && templates && templates.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">From template:</span>
          <select
            value={tpl?.id ?? ''}
            onChange={(e) => {
              const selected = templates.find((t) => t.id === e.target.value)
              if (selected) {
                setName(selected.name)
                setSuspendRegular(selected.suspendRegular)
                setWeightOffset(selected.weightOffset ?? 0)
                setTaskIds(selected.taskIds)
                setDayPlanOverride(selected.dayPlanOverride ?? '')
              }
            }}
            className="text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
          >
            <option value="">-- blank --</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Event Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dental Appointment, Family Picnic"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/30 p-3.5 rounded-xl border border-slate-800">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Start Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">End Date (multi-day)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer" />
        </div>
      </div>

      {/* Suspend + Weight Offset */}
      <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-800 space-y-3">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
          <input type="checkbox" checked={suspendRegular} onChange={(e) => setSuspendRegular(e.target.checked)}
            className="rounded border-slate-700 bg-slate-955 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer" />
          Suspend regular tasks (all tasks get weight-gated)
        </label>
        {suspendRegular && (
          <div className="pl-6 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Weight Offset</label>
            <input type="number" min={0} value={weightOffset} onChange={(e) => setWeightOffset(Number(e.target.value) || 0)}
              className="text-xs px-2.5 py-1.5 w-full max-w-[140px] bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none" />
            <p className="text-[10px] text-slate-500">Only tasks with weight {'>'} this value will survive. 0 = block all.</p>
          </div>
        )}
      </div>

      {/* Day Plan Override */}
      <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Day Plan Override</span>
          {eventDates.length > 1 && (
            <label className="inline-flex items-center gap-2 text-[10px] font-bold text-indigo-400 cursor-pointer">
              <input type="checkbox" checked={usePiecewise} onChange={(e) => setUsePiecewise(e.target.checked)}
                className="rounded border-slate-700 bg-slate-955 text-indigo-500 h-3 w-3 cursor-pointer" />
              Per-day plans
            </label>
          )}
        </div>

        {!usePiecewise ? (
          <div>
            <select value={dayPlanOverride} onChange={(e) => setDayPlanOverride(e.target.value)}
              className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer">
              <option value="">-- none (use default week layout) --</option>
              {dayPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">Applies to all days of the event.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {eventDates.map((d) => (
              <div key={d} className="flex items-center gap-3 bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-850">
                <span className="text-[11px] font-bold text-slate-400 w-32 shrink-0 font-mono">{formatDateShort(d)}</span>
                <select
                  value={dayPlanOverrides[d] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDayPlanOverrides((prev) => {
                      const next = { ...prev }
                      if (v) next[d] = v; else delete next[d]
                      return next
                    })
                  }}
                  className="text-xs px-2 py-1 flex-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
                >
                  <option value="">-- default --</option>
                  {dayPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ))}
            {eventDates.length === 0 && (
              <p className="text-[10px] italic text-slate-500">Set start and end dates to see per-day options.</p>
            )}
          </div>
        )}
      </div>

      {/* Tasks attached */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Event Tasks</span>
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {taskIds.map((tid, i) => {
            const task = tasks.find((t) => t.id === tid)
            return (
              <div key={tid} className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-semibold text-slate-300">{i + 1}. {task?.title ?? tid}</span>
                <button onClick={() => setTaskIds(taskIds.filter((id) => id !== tid))} className="p-1 rounded text-slate-400 hover:bg-rose-955/25 hover:text-rose-455 transition-all cursor-pointer"><XIcon /></button>
              </div>
            )
          })}
        </div>
        <div className="relative mt-2">
          <input type="text" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Search tasks to assign..."
            className="w-full text-xs px-3 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none placeholder-slate-500" />
          {taskSearch && filteredTasks.length > 0 && (
            <div className="absolute z-20 w-full mt-1.5 max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-1.5 divide-y divide-slate-850">
              {filteredTasks.slice(0, 8).map((t) => (
                <div key={t.id} onClick={() => { setTaskIds([...taskIds, t.id]); setTaskSearch('') }}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:bg-slate-850/50 cursor-pointer rounded-lg transition-all">
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save / Discard */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer">
            <CheckIcon /> Save Event
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-955 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all cursor-pointer">
            Discard
          </button>
        </div>
        {onDelete && (
          <button onClick={onDelete}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-955/35 hover:bg-rose-900/30 text-rose-400 border border-rose-800/30 transition-all cursor-pointer">
            <TrashIcon /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default EventPanel
