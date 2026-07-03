import { useState } from 'react'
import { useRoutineStore } from '../store/routineStore'
import { useBlockStore } from '../store/blockStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import type { Routine, RecurrenceConfig, RecurrencePattern, RoutineTaskConfig } from '../types/routine'
import { formatTime } from '../types/anchor'

function RoutinePanel() {
  const { routines, addRoutine, updateRoutine, deleteRoutine, toggleEnabled } = useRoutineStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Routines</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Routine
        </button>
      )}

      {creating && (
        <RoutineEditor
          onSave={(r) => { addRoutine(r); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {routines.map((routine) => {
          if (editing === routine.id) {
            return (
              <RoutineEditor
                key={routine.id}
                initial={routine}
                onSave={(updated) => { updateRoutine(routine.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteRoutine(routine.id); setEditing(null) }}
              />
            )
          }

          return (
            <div
              key={routine.id}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div onClick={() => setEditing(routine.id)} style={{ cursor: 'pointer', flex: 1 }}>
                <strong style={{ opacity: routine.enabled ? 1 : 0.5 }}>{routine.name}</strong>
                <div style={{ fontSize: 11 }}>
                  {routine.recurrence.pattern} | spawn @ {formatTime(routine.idealSpawnTime)}
                  | {routine.blockIds.length} block(s)
                  | {routine.taskConfigs?.length ?? 0} task config(s)
                </div>
              </div>
              <button onClick={() => toggleEnabled(routine.id)} style={{ fontSize: 11 }}>
                {routine.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          )
        })}
        {routines.length === 0 && !creating && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No routines yet.</p>
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
  const { anchors } = useAnchorStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [blockIds, setBlockIds] = useState<string[]>(initial?.blockIds ?? [])
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>(
    initial?.recurrence ?? { pattern: 'daily' }
  )
  const [idealSpawnTime, setIdealSpawnTime] = useState(initial?.idealSpawnTime ?? 360)
  const [taskConfigs, setTaskConfigs] = useState<RoutineTaskConfig[]>(initial?.taskConfigs ?? [])
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)

  // Get all tasks from selected blocks
  const blockTasks = blocks
    .filter((b) => blockIds.includes(b.id))
    .flatMap((b) => b.entries.map((e) => e.taskId))
  const uniqueTaskIds = [...new Set(blockTasks)]

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      blockIds,
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

  const getTaskConfig = (taskId: string) =>
    taskConfigs.find((tc) => tc.taskId === taskId)

  const setTaskConfig = (taskId: string, updates: Partial<RoutineTaskConfig>) => {
    const existing = taskConfigs.find((tc) => tc.taskId === taskId)
    if (existing) {
      setTaskConfigs(taskConfigs.map((tc) => tc.taskId === taskId ? { ...tc, ...updates } : tc))
    } else {
      setTaskConfigs([...taskConfigs, { taskId, ...updates }])
    }
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      {/* Name */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Enabled */}
      <label style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {' '}Enabled
      </label>

      {/* Blocks */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Blocks</label><br />
        {blocks.map((b) => (
          <label key={b.id} style={{ fontSize: 11, marginRight: 10 }}>
            <input
              type="checkbox"
              checked={blockIds.includes(b.id)}
              onChange={(e) => {
                if (e.target.checked) setBlockIds([...blockIds, b.id])
                else setBlockIds(blockIds.filter((id) => id !== b.id))
              }}
            />
            {' '}{b.name}
          </label>
        ))}
      </div>

      {/* Spawn time */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Ideal Spawn Time</label><br />
        <input
          type="time"
          value={toTimeStr(idealSpawnTime)}
          onChange={(e) => setIdealSpawnTime(fromTimeStr(e.target.value))}
        />
      </div>

      {/* Recurrence */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 12, fontWeight: 'bold' }}>Recurrence</span>
        <div style={{ marginBottom: 4 }}>
          <select
            value={recurrence.pattern}
            onChange={(e) => setRecurrence({ ...recurrence, pattern: e.target.value as RecurrencePattern })}
            style={{ fontSize: 11 }}
          >
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="one-time">one-time</option>
            <option value="repeat-until">repeat-until</option>
          </select>
          {recurrence.pattern !== 'daily' && recurrence.pattern !== 'one-time' && (
            <span style={{ marginLeft: 8 }}>
              <label style={{ fontSize: 11 }}>every </label>
              <input
                type="number"
                value={recurrence.interval ?? 1}
                onChange={(e) => setRecurrence({ ...recurrence, interval: Number(e.target.value) || 1 })}
                style={{ width: 30, fontSize: 11 }}
              />
            </span>
          )}
        </div>
        {recurrence.pattern === 'weekly' && (
          <div style={{ fontSize: 11 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <label key={i} style={{ marginRight: 6 }}>
                <input
                  type="checkbox"
                  checked={recurrence.daysOfWeek?.includes(i) ?? false}
                  onChange={(e) => {
                    const days = recurrence.daysOfWeek ?? []
                    setRecurrence({
                      ...recurrence,
                      daysOfWeek: e.target.checked ? [...days, i] : days.filter((d) => d !== i),
                    })
                  }}
                />
                {day}
              </label>
            ))}
          </div>
        )}
        {recurrence.pattern === 'monthly' && (
          <div>
            <label style={{ fontSize: 11 }}>Day of month: </label>
            <input
              type="number"
              value={recurrence.dayOfMonth ?? 1}
              onChange={(e) => setRecurrence({ ...recurrence, dayOfMonth: Number(e.target.value) || 1 })}
              style={{ width: 30, fontSize: 11 }}
              min={1}
              max={31}
            />
          </div>
        )}
        {recurrence.pattern === 'repeat-until' && (
          <div>
            <label style={{ fontSize: 11 }}>Until: </label>
            <input
              type="date"
              value={recurrence.repeatUntil ?? ''}
              onChange={(e) => setRecurrence({ ...recurrence, repeatUntil: e.target.value })}
              style={{ fontSize: 11 }}
            />
          </div>
        )}
      </div>

      {/* Per-task configs */}
      {uniqueTaskIds.length > 0 && (
        <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
          <span style={{ fontSize: 12, fontWeight: 'bold' }}>Task Configs</span>
          {uniqueTaskIds.map((taskId) => {
            const task = tasks.find((t) => t.id === taskId)
            if (!task) return null
            const config = getTaskConfig(taskId)

            return (
              <div key={taskId} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: '1px solid #999' }}>
                <span style={{ fontSize: 11, fontWeight: 'bold' }}>{task.title}</span>

                {/* Ideal time */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <label style={{ fontSize: 11 }}>Ideal:</label>
                  <input
                    type="time"
                    value={config?.idealTime !== undefined ? toTimeStr(config.idealTime) : ''}
                    onChange={(e) => setTaskConfig(taskId, { idealTime: e.target.value ? fromTimeStr(e.target.value) : undefined })}
                    style={{ fontSize: 11 }}
                  />
                  <label style={{ fontSize: 11 }}>Expires:</label>
                  <input
                    type="number"
                    value={config?.expiresAfterMinutes ?? ''}
                    onChange={(e) => setTaskConfig(taskId, { expiresAfterMinutes: Number(e.target.value) || undefined })}
                    placeholder="min"
                    style={{ width: 50, fontSize: 11 }}
                  />
                </div>

                {/* Slot weights (piecewise per anchor) */}
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 'bold' }}>Slot weights (from slot ideal start):</span>
                  {anchors.map((a) => {
                    const points = config?.slotWeights?.[a.id] ?? []
                    return (
                      <div key={a.id} style={{ marginLeft: 12, marginTop: 8, paddingLeft: 8, borderLeft: '1px solid #999' }}>
                        <span style={{ fontSize: 13, fontWeight: 'bold' }}>{a.name}</span>
                        {points.map((pt, pi) => (
                          <div key={pi} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            <label style={{ fontSize: 13 }}>+</label>
                            <input
                              type="number"
                              value={pt.offsetMinutes}
                              onChange={(e) => {
                                const updated = [...points]
                                updated[pi] = { ...updated[pi], offsetMinutes: Number(e.target.value) || 0 }
                                const current = config?.slotWeights ?? {}
                                setTaskConfig(taskId, { slotWeights: { ...current, [a.id]: updated } })
                              }}
                              style={{ width: 60 }}
                            />
                            <label style={{ fontSize: 13 }}>min =</label>
                            <input
                              type="number"
                              value={pt.value}
                              onChange={(e) => {
                                const updated = [...points]
                                updated[pi] = { ...updated[pi], value: Number(e.target.value) || 0 }
                                const current = config?.slotWeights ?? {}
                                setTaskConfig(taskId, { slotWeights: { ...current, [a.id]: updated } })
                              }}
                              style={{ width: 60 }}
                            />
                            <button
                              onClick={() => {
                                const updated = points.filter((_, j) => j !== pi)
                                const current = config?.slotWeights ?? {}
                                if (updated.length === 0) {
                                  const { [a.id]: _, ...rest } = current
                                  setTaskConfig(taskId, { slotWeights: Object.keys(rest).length > 0 ? rest : undefined })
                                } else {
                                  setTaskConfig(taskId, { slotWeights: { ...current, [a.id]: updated } })
                                }
                              }}
                            >x</button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const last = points[points.length - 1]
                            const newPt = { offsetMinutes: (last?.offsetMinutes ?? 0) + 60, value: 0 }
                            const current = config?.slotWeights ?? {}
                            setTaskConfig(taskId, { slotWeights: { ...current, [a.id]: [...points, newPt] } })
                          }}
                          style={{ marginTop: 4 }}
                        >+ Add point</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
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

export default RoutinePanel
