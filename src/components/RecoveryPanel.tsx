import { useState } from 'react'
import { useRecoveryStore } from '../store/recoveryStore'
import { useTaskStore } from '../store/taskStore'
import { useBlockStore } from '../store/blockStore'
import type { RecoveryPlan, TriggerType, AutoTriggerCondition, TimeWeight } from '../types/recovery'

function RecoveryPanel() {
  const { plans, addPlan, updatePlan, deletePlan, trigger, resolve } = useRecoveryStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Recovery Plans</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Recovery Plan
        </button>
      )}

      {creating && (
        <RecoveryEditor
          onSave={(p) => { addPlan(p); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {plans.map((plan) => {
          if (editing === plan.id) {
            return (
              <RecoveryEditor
                key={plan.id}
                initial={plan}
                onSave={(updated) => { updatePlan(plan.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deletePlan(plan.id); setEditing(null) }}
              />
            )
          }

          const daysPending = plan.triggeredAt
            ? Math.floor((new Date(today).getTime() - new Date(plan.triggeredAt).getTime()) / 86400000)
            : 0

          return (
            <div
              key={plan.id}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div onClick={() => setEditing(plan.id)} style={{ cursor: 'pointer', flex: 1 }}>
                <strong>{plan.name}</strong>
                {plan.triggered && <span style={{ marginLeft: 8 }}>[ACTIVE - {daysPending}d]</span>}
                <div style={{ fontSize: 12 }}>
                  {plan.triggerType}
                  {plan.autoCondition && ` | ${plan.autoCondition.consecutiveMisses} misses`}
                  {' | '}growth: {plan.growthRate}/day
                  {' | '}cap: {plan.saturationLimit}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {!plan.triggered && (
                  <button onClick={() => trigger(plan.id)}>Trigger</button>
                )}
                {plan.triggered && (
                  <button onClick={() => resolve(plan.id)}>Resolve</button>
                )}
              </div>
            </div>
          )
        })}
        {plans.length === 0 && !creating && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No recovery plans yet.</p>
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
  const [taskIds, setTaskIds] = useState<string[]>(initial?.taskIds ?? [])
  const [blockIds, setBlockIds] = useState<string[]>(initial?.blockIds ?? [])
  const [triggerType, setTriggerType] = useState<TriggerType>(initial?.triggerType ?? 'manual')
  const [autoCondition, setAutoCondition] = useState<AutoTriggerCondition>(
    initial?.autoCondition ?? { taskId: '', consecutiveMisses: 3 }
  )
  const [baseTimeCurve, setBaseTimeCurve] = useState<TimeWeight[]>(initial?.baseTimeCurve ?? [])
  const [growthRate, setGrowthRate] = useState(initial?.growthRate ?? 0.5)
  const [saturationLimit, setSaturationLimit] = useState(initial?.saturationLimit ?? 300)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      taskIds,
      blockIds,
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

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      {/* Name */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Trigger type */}
      <div style={{ marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: 13 }}>Trigger</label><br />
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)}>
            <option value="manual">manual</option>
            <option value="auto">auto</option>
          </select>
        </div>
        {triggerType === 'auto' && (
          <>
            <div>
              <label style={{ fontSize: 13 }}>Task</label><br />
              <select
                value={autoCondition.taskId}
                onChange={(e) => setAutoCondition({ ...autoCondition, taskId: e.target.value })}
              >
                <option value="">-- task --</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13 }}>Misses</label><br />
              <input
                type="number"
                value={autoCondition.consecutiveMisses}
                onChange={(e) => setAutoCondition({ ...autoCondition, consecutiveMisses: Number(e.target.value) || 1 })}
                style={{ width: 50 }}
              />
            </div>
          </>
        )}
      </div>

      {/* Growth + Saturation */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 13 }}>Growth rate (/day)</label><br />
          <input type="number" value={growthRate} onChange={(e) => setGrowthRate(Number(e.target.value) || 0)} style={{ width: 60 }} step="0.1" />
        </div>
        <div>
          <label style={{ fontSize: 13 }}>Saturation limit</label><br />
          <input type="number" value={saturationLimit} onChange={(e) => setSaturationLimit(Number(e.target.value) || 0)} style={{ width: 80 }} />
        </div>
      </div>

      {/* Tasks */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Tasks</span>
        {taskIds.map((tid, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select value={tid} onChange={(e) => { const u = [...taskIds]; u[i] = e.target.value; setTaskIds(u) }}>
              <option value="">-- task --</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button onClick={() => setTaskIds(taskIds.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setTaskIds([...taskIds, ''])} style={{ marginTop: 4 }}>+ Add task</button>
      </div>

      {/* Blocks */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Blocks</span>
        {blockIds.map((bid, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select value={bid} onChange={(e) => { const u = [...blockIds]; u[i] = e.target.value; setBlockIds(u) }}>
              <option value="">-- block --</option>
              {blocks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={() => setBlockIds(blockIds.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setBlockIds([...blockIds, ''])} style={{ marginTop: 4 }}>+ Add block</button>
      </div>

      {/* Base time curve */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 13, fontWeight: 'bold' }}>Base time-of-day weight</span>
        {baseTimeCurve.map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input
              type="time"
              value={toTimeStr(pt.time)}
              onChange={(e) => {
                const updated = [...baseTimeCurve]
                updated[i] = { ...updated[i], time: fromTimeStr(e.target.value) }
                setBaseTimeCurve(updated)
              }}
            />
            <span style={{ fontSize: 13 }}>=</span>
            <input
              type="number"
              value={pt.value}
              onChange={(e) => {
                const updated = [...baseTimeCurve]
                updated[i] = { ...updated[i], value: Number(e.target.value) || 0 }
                setBaseTimeCurve(updated)
              }}
              style={{ width: 60 }}
            />
            <button onClick={() => setBaseTimeCurve(baseTimeCurve.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setBaseTimeCurve([...baseTimeCurve, { time: 600, value: 50 }])} style={{ marginTop: 4 }}>
          + Add point
        </button>
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

export default RecoveryPanel
