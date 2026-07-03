import { useState } from 'react'
import { usePlannerStore } from '../store/plannerStore'
import { useTaskStore } from '../store/taskStore'
import type { CalendarEvent } from '../types/planner'

function EventPanel() {
  const { calendarEvents, dayPlans, addEvent, updateEvent, deleteEvent } = usePlannerStore()
  const { tasks } = useTaskStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Calendar Events</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Event
        </button>
      )}

      {creating && (
        <EventEditor
          dayPlans={dayPlans}
          tasks={tasks}
          onSave={(e) => { addEvent(e); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {calendarEvents.map((ev) => {
          if (editing === ev.id) {
            return (
              <EventEditor
                key={ev.id}
                initial={ev}
                dayPlans={dayPlans}
                tasks={tasks}
                onSave={(updated) => { updateEvent(ev.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteEvent(ev.id); setEditing(null) }}
              />
            )
          }

          return (
            <div
              key={ev.id}
              onClick={() => setEditing(ev.id)}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}
            >
              <strong>{ev.name}</strong>
              <div style={{ fontSize: 12 }}>
                {ev.date}{ev.endDate ? ` → ${ev.endDate}` : ''}
                {ev.suspendRegular && ' | Suspends regular'}
                {' | '}{ev.taskIds.length} task(s)
              </div>
            </div>
          )
        })}
        {calendarEvents.length === 0 && !creating && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No events yet.</p>
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

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !taskIds.includes(t.id)
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
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 13 }}>Date</label><br />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13 }}>End date (multi-day)</label><br />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={suspendRegular} onChange={(e) => setSuspendRegular(e.target.checked)} />
          {' '}Suspend regular tasks (obligations exempt)
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Day plan override</label><br />
        <select value={dayPlanOverride} onChange={(e) => setDayPlanOverride(e.target.value)}>
          <option value="">-- none (use week plan) --</option>
          {dayPlans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Tasks with search */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Event Tasks</span>

        {/* Selected tasks */}
        {taskIds.map((tid, i) => {
          const task = tasks.find((t) => t.id === tid)
          return (
            <div key={tid} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 12 }}>{i + 1}. {task?.title ?? tid}</span>
              <button onClick={() => setTaskIds(taskIds.filter((id) => id !== tid))}>x</button>
            </div>
          )
        })}

        {/* Search + add */}
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Search tasks..."
            style={{ width: '100%', marginBottom: 4 }}
          />
          {taskSearch && filteredTasks.length > 0 && (
            <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid #ccc', padding: 4 }}>
              {filteredTasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  onClick={() => { setTaskIds([...taskIds, t.id]); setTaskSearch('') }}
                  style={{ padding: '2px 4px', cursor: 'pointer', fontSize: 12 }}
                >
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #999', paddingTop: 8 }}>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save Changes</button>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Discard</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

export default EventPanel
