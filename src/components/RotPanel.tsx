import { useState } from 'react'
import { useRotStore } from '../store/rotStore'
import { useTaskStore } from '../store/taskStore'
import type { RotEntry } from '../types/rot'
import { formatTime } from '../types/anchor'

function RotPanel() {
  const { entries, addEntry, deleteEntry, getRotDays } = useRotStore()
  const { tasks } = useTaskStore()
  const [adding, setAdding] = useState(false)

  const rot7 = getRotDays(7)
  const rot30 = getRotDays(30)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Rot</h3>

      {/* Stats */}
      <div style={{ marginBottom: 12, fontSize: 13 }}>
        <span>Last 7 days: <strong>{rot7}</strong> rot entries</span>
        <span style={{ marginLeft: 16 }}>Last 30 days: <strong>{rot30}</strong> rot entries</span>
      </div>

      {!adding && (
        <button onClick={() => setAdding(true)} style={{ marginBottom: 12 }}>
          + Log Rot
        </button>
      )}

      {adding && (
        <RotEditor
          tasks={tasks}
          onSave={(entry) => { addEntry(entry); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* List */}
      <div>
        {entries
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((entry) => (
            <div key={entry.id} style={{ borderTop: '1px solid #ccc', padding: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{entry.date}</strong>
                {entry.startTime !== undefined && entry.endTime !== undefined && (
                  <span style={{ fontSize: 12, marginLeft: 8 }}>
                    {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                  </span>
                )}
                <div style={{ fontSize: 12 }}>
                  {entry.suspendedTaskIds.length} task(s) suspended
                  {entry.note && ` — ${entry.note}`}
                </div>
              </div>
              <button onClick={() => deleteEntry(entry.id)}>x</button>
            </div>
          ))}
        {entries.length === 0 && !adding && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No rot logged.</p>
        )}
      </div>
    </div>
  )
}

function RotEditor({
  tasks,
  onSave,
  onCancel,
}: {
  tasks: { id: string; title: string }[]
  onSave: (entry: RotEntry) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [suspendedTaskIds, setSuspendedTaskIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [taskSearch, setTaskSearch] = useState('')

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !suspendedTaskIds.includes(t.id)
  )

  const fromTimeStr = (str: string) => {
    const [h, m] = str.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const handleSave = () => {
    if (!date) return
    onSave({
      id: crypto.randomUUID(),
      date,
      startTime: startTime ? fromTimeStr(startTime) : undefined,
      endTime: endTime ? fromTimeStr(endTime) : undefined,
      suspendedTaskIds,
      note: note || undefined,
    })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 13 }}>Date</label><br />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13 }}>Start (optional)</label><br />
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13 }}>End (optional)</label><br />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Note</label><br />
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why rot?" style={{ width: '100%' }} />
      </div>

      {/* Suspended tasks */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Suspended tasks</span>
        {suspendedTaskIds.map((tid) => {
          const task = tasks.find((t) => t.id === tid)
          return (
            <div key={tid} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: 12 }}>{task?.title ?? tid}</span>
              <button onClick={() => setSuspendedTaskIds(suspendedTaskIds.filter((id) => id !== tid))}>x</button>
            </div>
          )
        })}
        <input
          type="text"
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          placeholder="Search tasks..."
          style={{ width: '100%', marginTop: 4 }}
        />
        {taskSearch && filtered.length > 0 && (
          <div style={{ maxHeight: 100, overflow: 'auto', border: '1px solid #ccc', padding: 4 }}>
            {filtered.slice(0, 8).map((t) => (
              <div
                key={t.id}
                onClick={() => { setSuspendedTaskIds([...suspendedTaskIds, t.id]); setTaskSearch('') }}
                style={{ padding: '2px 4px', cursor: 'pointer', fontSize: 12 }}
              >
                {t.title}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #999', paddingTop: 8 }}>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save</button>
        <button onClick={onCancel}>Discard</button>
      </div>
    </div>
  )
}

export default RotPanel
