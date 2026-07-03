import { useState } from 'react'
import { useObligationStore } from '../store/obligationStore'
import { useTaskStore } from '../store/taskStore'
import type { Obligation, ObligationTask, WeightBracket, TimeWeight, ObligationRecurrence } from '../types/obligation'
import { formatTime } from '../types/anchor'

function ObligationPanel() {
  const { obligations, addObligation, updateObligation, deleteObligation, toggleEnabled } = useObligationStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Obligations</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Obligation
        </button>
      )}

      {creating && (
        <ObligationEditor
          onSave={(o) => { addObligation(o); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {obligations.map((ob) => {
          if (editing === ob.id) {
            return (
              <ObligationEditor
                key={ob.id}
                initial={ob}
                onSave={(updated) => { updateObligation(ob.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteObligation(ob.id); setEditing(null) }}
              />
            )
          }

          const daysLeft = ob.deadline
            ? Math.ceil((new Date(ob.deadline).getTime() - Date.now()) / 86400000)
            : null

          return (
            <div
              key={ob.id}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div onClick={() => setEditing(ob.id)} style={{ cursor: 'pointer', flex: 1 }}>
                <strong style={{ opacity: ob.enabled ? 1 : 0.5 }}>{ob.name}</strong>
                <div style={{ fontSize: 12 }}>
                  {ob.recurrence}
                  {daysLeft !== null && ` | ${daysLeft} days left`}
                  {' | '}{ob.tasks.length} task(s)
                  {' | '}{ob.weightBrackets.length} bracket(s)
                </div>
              </div>
              <button onClick={() => toggleEnabled(ob.id)}>
                {ob.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          )
        })}
        {obligations.length === 0 && !creating && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No obligations yet.</p>
        )}
      </div>
    </div>
  )
}

function ObligationEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Obligation
  onSave: (obligation: Obligation) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { tasks: allTasks } = useTaskStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [deadline, setDeadline] = useState(initial?.deadline ?? '')
  const [recurrence, setRecurrence] = useState<ObligationRecurrence>(initial?.recurrence ?? 'one-time')
  const [recurrenceMonth, setRecurrenceMonth] = useState(initial?.recurrenceMonth ?? 0)
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [tasks, setTasks] = useState<ObligationTask[]>(initial?.tasks ?? [])
  const [brackets, setBrackets] = useState<WeightBracket[]>(initial?.weightBrackets ?? [])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      tasks,
      deadline: deadline || undefined,
      weightBrackets: brackets,
      recurrence,
      recurrenceMonth: recurrence !== 'one-time' ? recurrenceMonth : undefined,
      enabled,
    })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      {/* Name */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Deadline + Recurrence + Enabled */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 13 }}>Deadline</label><br />
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13 }}>Recurrence</label><br />
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as ObligationRecurrence)}>
            <option value="one-time">one-time</option>
            <option value="yearly">yearly</option>
            <option value="quarterly">quarterly</option>
            <option value="custom">custom</option>
          </select>
        </div>
        {recurrence !== 'one-time' && (
          <div>
            <label style={{ fontSize: 13 }}>Start month</label><br />
            <select value={recurrenceMonth} onChange={(e) => setRecurrenceMonth(Number(e.target.value))}>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: 13 }}>Enabled</label><br />
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </div>
      </div>

      {/* Tasks */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Tasks</span>
        {tasks.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12 }}>{t.order}.</span>
            <select
              value={t.taskId}
              onChange={(e) => {
                const updated = [...tasks]
                updated[i] = { ...updated[i], taskId: e.target.value }
                setTasks(updated)
              }}
            >
              <option value="">-- task --</option>
              {allTasks.map((at) => (
                <option key={at.id} value={at.id}>{at.title}</option>
              ))}
            </select>
            <button onClick={() => setTasks(tasks.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setTasks([...tasks, { taskId: '', order: tasks.length }])} style={{ marginTop: 4 }}>
          + Add task
        </button>
      </div>

      {/* Weight Brackets */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Weight Brackets (date-range → time-of-day curve)</span>
        {brackets
          .sort((a, b) => a.maxDaysRemaining - b.maxDaysRemaining)
          .map((bracket, bi) => (
            <div key={bi} style={{ marginTop: 8, paddingLeft: 8, borderLeft: '1px solid #999' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 13 }}>When days left &le;</label>
                <input
                  type="number"
                  value={bracket.maxDaysRemaining}
                  onChange={(e) => {
                    const updated = [...brackets]
                    updated[bi] = { ...updated[bi], maxDaysRemaining: Number(e.target.value) || 0 }
                    setBrackets(updated)
                  }}
                  style={{ width: 50 }}
                />
                <button onClick={() => setBrackets(brackets.filter((_, j) => j !== bi))}>x</button>
              </div>

              {/* Time curve for this bracket */}
              <div style={{ marginLeft: 12, marginTop: 4 }}>
                {bracket.timeCurve.map((pt, pi) => (
                  <div key={pi} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 12 }}>{formatTime(pt.time)}</span>
                    <input
                      type="time"
                      value={toTimeStr(pt.time)}
                      onChange={(e) => {
                        const updated = [...brackets]
                        const curve = [...updated[bi].timeCurve]
                        curve[pi] = { ...curve[pi], time: fromTimeStr(e.target.value) }
                        updated[bi] = { ...updated[bi], timeCurve: curve }
                        setBrackets(updated)
                      }}
                    />
                    <label style={{ fontSize: 12 }}>=</label>
                    <input
                      type="number"
                      value={pt.value}
                      onChange={(e) => {
                        const updated = [...brackets]
                        const curve = [...updated[bi].timeCurve]
                        curve[pi] = { ...curve[pi], value: Number(e.target.value) || 0 }
                        updated[bi] = { ...updated[bi], timeCurve: curve }
                        setBrackets(updated)
                      }}
                      style={{ width: 60 }}
                    />
                    <button onClick={() => {
                      const updated = [...brackets]
                      updated[bi] = { ...updated[bi], timeCurve: updated[bi].timeCurve.filter((_, j) => j !== pi) }
                      setBrackets(updated)
                    }}>x</button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const updated = [...brackets]
                    const last = bracket.timeCurve[bracket.timeCurve.length - 1]
                    updated[bi] = {
                      ...updated[bi],
                      timeCurve: [...updated[bi].timeCurve, { time: (last?.time ?? 0) + 60, value: 0 }],
                    }
                    setBrackets(updated)
                  }}
                  style={{ marginTop: 2 }}
                >+ Add time point</button>
              </div>
            </div>
          ))}
        <button
          onClick={() => setBrackets([...brackets, { maxDaysRemaining: 30, timeCurve: [{ time: 600, value: 50 }] }])}
          style={{ marginTop: 8 }}
        >+ Add bracket</button>
      </div>

      {/* Actions */}
      <div style={{ borderTop: '1px solid #999', paddingTop: 8 }}>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save Changes</button>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Discard</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

function toTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function fromTimeStr(str: string): number {
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export default ObligationPanel
