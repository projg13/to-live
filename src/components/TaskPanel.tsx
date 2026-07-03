import { useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import type { Task, TaskLink, LinkType, ContinuityRule } from '../types/task'

function TaskPanel() {
  const { tasks, addTask, updateTask, deleteTask } = useTaskStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Tasks</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Task
        </button>
      )}

      {creating && (
        <TaskEditor
          allTasks={tasks}
          onSave={(task) => { addTask(task); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {tasks.map((task) => {
          if (editing === task.id) {
            return (
              <TaskEditor
                key={task.id}
                initial={task}
                allTasks={tasks}
                onSave={(updated) => { updateTask(task.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteTask(task.id); setEditing(null) }}
              />
            )
          }

          return (
            <div
              key={task.id}
              onClick={() => setEditing(task.id)}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{task.title}</strong>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  w:{task.weight} | {task.durationMinutes}min
                </span>
              </div>
              <div style={{ fontSize: 11 }}>
                {task.knobs.scheduled && task.start && <span>Scheduled </span>}
                {task.knobs.isMother && task.links && (
                  <span>
                    | Links: {task.links.map((l) => `${l.linkType}→${tasks.find(t => t.id === l.linkedTaskId)?.title ?? '?'}`).join(', ')}
                  </span>
                )}
                {task.parentId && <span>| Child </span>}
              </div>
            </div>
          )
        })}
        {tasks.length === 0 && !creating && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No tasks yet.</p>
        )}
      </div>
    </div>
  )
}

// --- Editor ---

function TaskEditor({
  initial,
  allTasks,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Task
  allTasks: Task[]
  onSave: (task: Task) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [weight, setWeight] = useState(initial?.weight ?? 100)
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30)

  // Knobs
  const [scheduled, setScheduled] = useState(initial?.knobs.scheduled ?? false)
  const [isMother, setIsMother] = useState(initial?.knobs.isMother ?? false)
  const [hasWeightCurve, setHasWeightCurve] = useState(initial?.knobs.hasWeightCurve ?? false)
  const [hasExpiry, setHasExpiry] = useState(initial?.knobs.hasExpiry ?? false)
  const [hasStickiness, setHasStickiness] = useState(initial?.knobs.hasStickiness ?? false)

  // Scheduled fields
  const [start, setStart] = useState(initial?.start ?? '')
  const [end, setEnd] = useState(initial?.end ?? '')

  // Links
  const [links, setLinks] = useState<TaskLink[]>(initial?.links ?? [])

  // Weight curve
  const [weightCurve, setWeightCurve] = useState<{ datetime: string; value: number }[]>(
    initial?.weightCurve ?? []
  )

  // Expiry
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? '')

  // Stickiness
  const [stickiness, setStickiness] = useState(initial?.stickiness ?? 0)

  const handleSave = () => {
    if (!title.trim() || duration <= 0) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      weight,
      durationMinutes: duration,
      start: scheduled ? start : undefined,
      end: scheduled ? end : undefined,
      links: isMother ? links : undefined,
      weightCurve: hasWeightCurve ? weightCurve : undefined,
      expiresAt: hasExpiry ? expiresAt : undefined,
      stickiness: hasStickiness ? stickiness : undefined,
      spawnedIds: initial?.spawnedIds,
      parentId: initial?.parentId,
      knobs: { scheduled, isMother, hasWeightCurve, hasExpiry, hasStickiness },
    })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      {/* Title */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Title</label><br />
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Weight + Duration */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 12 }}>Weight</label><br />
          <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} style={{ width: 60 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Duration (min)</label><br />
          <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} style={{ width: 80 }} />
        </div>
      </div>

      {/* Knobs */}
      <div style={{ marginBottom: 12, borderTop: '1px solid #999', paddingTop: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 'bold' }}>Knobs:</span>
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />
          {' '}Scheduled
        </label>
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          <input type="checkbox" checked={isMother} onChange={(e) => setIsMother(e.target.checked)} />
          {' '}Mother
        </label>
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          <input type="checkbox" checked={hasWeightCurve} onChange={(e) => setHasWeightCurve(e.target.checked)} />
          {' '}Weight Curve
        </label>
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
          {' '}Expiry
        </label>
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          <input type="checkbox" checked={hasStickiness} onChange={(e) => setHasStickiness(e.target.checked)} />
          {' '}Stickiness
        </label>
      </div>

      {/* Scheduled fields */}
      {scheduled && (
        <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
          <div style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12 }}>Start</label><br />
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12 }}>End</label><br />
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      )}

      {/* Links (Mother) */}
      {isMother && (
        <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
          <span style={{ fontSize: 12, fontWeight: 'bold' }}>Links</span>
          {links.map((link, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <select
                value={link.linkType}
                onChange={(e) => {
                  const updated = [...links]
                  updated[i] = { ...updated[i], linkType: e.target.value as LinkType }
                  setLinks(updated)
                }}
                style={{ fontSize: 11 }}
              >
                <option value="active">active</option>
                <option value="passive">passive</option>
              </select>
              <span style={{ fontSize: 11 }}>→</span>
              <select
                value={link.linkedTaskId}
                onChange={(e) => {
                  const updated = [...links]
                  updated[i] = { ...updated[i], linkedTaskId: e.target.value }
                  setLinks(updated)
                }}
                style={{ fontSize: 11 }}
              >
                <option value="">-- task --</option>
                {allTasks
                  .filter((t) => t.id !== initial?.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))
                }
              </select>
              {link.linkType === 'passive' && (
                <select
                  value={link.continuity ?? ''}
                  onChange={(e) => {
                    const updated = [...links]
                    updated[i] = { ...updated[i], continuity: (e.target.value || undefined) as ContinuityRule | undefined }
                    setLinks(updated)
                  }}
                  style={{ fontSize: 11 }}
                >
                  <option value="">(default)</option>
                  <option value="continuous">continuous</option>
                  <option value="discontinuable">discontinuable</option>
                  <option value="resumable">resumable</option>
                </select>
              )}
              <button onClick={() => setLinks(links.filter((_, j) => j !== i))} style={{ fontSize: 11 }}>x</button>
            </div>
          ))}
          <button
            onClick={() => setLinks([...links, { linkedTaskId: '', linkType: 'active' }])}
            style={{ fontSize: 11 }}
          >
            + Add link
          </button>
        </div>
      )}


      {/* Weight Curve */}
      {hasWeightCurve && (
        <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
          <span style={{ fontSize: 12, fontWeight: 'bold' }}>Weight Curve</span>
          {weightCurve.map((wp, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <input
                type="datetime-local"
                value={wp.datetime}
                onChange={(e) => {
                  const updated = [...weightCurve]
                  updated[i] = { ...updated[i], datetime: e.target.value }
                  setWeightCurve(updated)
                }}
                style={{ fontSize: 11 }}
              />
              <input
                type="number"
                value={wp.value}
                onChange={(e) => {
                  const updated = [...weightCurve]
                  updated[i] = { ...updated[i], value: Number(e.target.value) || 0 }
                  setWeightCurve(updated)
                }}
                style={{ width: 60, fontSize: 11 }}
                placeholder="weight"
              />
              <button onClick={() => setWeightCurve(weightCurve.filter((_, j) => j !== i))} style={{ fontSize: 11 }}>x</button>
            </div>
          ))}
          <button
            onClick={() => setWeightCurve([...weightCurve, { datetime: '', value: weight }])}
            style={{ fontSize: 11 }}
          >
            + Add point
          </button>
        </div>
      )}

      {/* Expiry */}
      {hasExpiry && (
        <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
          <label style={{ fontSize: 12 }}>Expires at</label><br />
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      )}

      {/* Stickiness */}
      {hasStickiness && (
        <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
          <label style={{ fontSize: 12 }}>Stickiness</label><br />
          <input
            type="number"
            value={stickiness}
            onChange={(e) => setStickiness(Number(e.target.value) || 0)}
            style={{ width: 80 }}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ borderTop: '1px solid #999', paddingTop: 8 }}>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save Changes</button>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Discard</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

export default TaskPanel
