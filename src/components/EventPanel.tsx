import { useState } from 'react'
import { usePlannerStore } from '../store/plannerStore'
import { useTaskStore } from '../store/taskStore'
import type { CalendarEvent } from '../types/planner'

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

function EventPanel() {
  const { calendarEvents, dayPlans, addEvent, updateEvent, deleteEvent } = usePlannerStore()
  const { tasks } = useTaskStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Calendar Events</h3>
          <p className="text-xs text-slate-400">Inject one-off events or overrides on specific dates.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> New Event
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <EventEditor
            dayPlans={dayPlans}
            tasks={tasks}
            onSave={(e) => {
              addEvent(e)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {calendarEvents.map((ev) => {
          if (editing === ev.id) {
            return (
              <div key={ev.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <EventEditor
                  initial={ev}
                  dayPlans={dayPlans}
                  tasks={tasks}
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
              className="group p-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm cursor-pointer hover:border-cyan-500/25 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 pr-4 flex-1">
                <span className="font-bold text-slate-205 text-[15px] block">
                  {ev.name}
                </span>

                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon />
                    {ev.date}
                    {ev.endDate ? ` → ${ev.endDate}` : ''}
                  </span>
                  {ev.suspendRegular && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 bg-rose-955/30 px-1.5 py-0.5 rounded border border-rose-900/30">
                      Suspends regular tasks
                    </span>
                  )}
                  <span>• {ev.taskIds.length} task(s)</span>
                </div>
              </div>

              <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-bold text-cyan-400">
                  Edit Event
                </span>
              </div>
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

function EventEditor({
  initial,
  dayPlans,
  tasks,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: CalendarEvent
  dayPlans: { id: string; name: string }[]
  tasks: { id: string; title: string }[]
  onSave: (event: CalendarEvent) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [taskIds, setTaskIds] = useState<string[]>(initial?.taskIds ?? [])
  const [suspendRegular, setSuspendRegular] = useState(initial?.suspendRegular ?? false)
  const [dayPlanOverride, setDayPlanOverride] = useState(initial?.dayPlanOverride ?? '')
  const [taskSearch, setTaskSearch] = useState('')

  const filteredTasks = tasks.filter(
    (t) => t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !taskIds.includes(t.id)
  )

  const handleSave = () => {
    if (!name.trim() || !date) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      date,
      endDate: endDate || undefined,
      taskIds,
      suspendRegular,
      dayPlanOverride: dayPlanOverride || undefined,
    })
  }

  return (
    <div className="space-y-4">
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

      {/* Dates configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/30 p-3.5 rounded-xl border border-slate-800">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            End Date (optional multi-day)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/30 p-3 rounded-xl border border-slate-800">
        {/* Suspend Tasks Checkbox */}
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={suspendRegular}
            onChange={(e) => setSuspendRegular(e.target.checked)}
            className="rounded border-slate-700 bg-slate-955 text-cyan-500 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
          />
          Suspend regular schedule tasks (obligations exempt)
        </label>

        {/* Day Plan Override select */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            Override day plan:
          </span>
          <select
            value={dayPlanOverride}
            onChange={(e) => setDayPlanOverride(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">-- none (default week layout) --</option>
            {dayPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks attached list with autocomplete */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Event Tasks
        </span>

        {/* Selected Tasks List */}
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {taskIds.map((tid, i) => {
            const task = tasks.find((t) => t.id === tid)
            return (
              <div
                key={tid}
                className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-lg"
              >
                <span className="text-xs font-semibold text-slate-300">
                  {i + 1}. {task?.title ?? tid}
                </span>
                <button
                  onClick={() => setTaskIds(taskIds.filter((id) => id !== tid))}
                  className="p-1 rounded text-slate-400 hover:bg-rose-955/25 hover:text-rose-455 transition-all cursor-pointer"
                >
                  <XIcon />
                </button>
              </div>
            )
          })}
        </div>

        {/* Task Search Input */}
        <div className="relative mt-2">
          <input
            type="text"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Search registered tasks to assign..."
            className="w-full text-xs px-3 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none placeholder-slate-500"
          />
          {taskSearch && filteredTasks.length > 0 && (
            <div className="absolute z-20 w-full mt-1.5 max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-1.5 divide-y divide-slate-850">
              {filteredTasks.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setTaskIds([...taskIds, t.id])
                    setTaskSearch('')
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:bg-slate-850/50 cursor-pointer rounded-lg transition-all"
                >
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Event
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

export default EventPanel
