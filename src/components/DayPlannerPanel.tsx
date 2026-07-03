import { useState } from 'react'
import { usePlannerStore } from '../store/plannerStore'
import { useAnchorStore } from '../store/anchorStore'
import { useRoutineStore } from '../store/routineStore'
import type { DayPlan } from '../types/planner'

function DayPlannerPanel() {
  const { dayPlans, weekPlan, addDayPlan, updateDayPlan, deleteDayPlan, setWeekDay } = usePlannerStore()
  const { anchors } = useAnchorStore()
  const { routines } = useRoutineStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Day Plans</h3>

      {/* Day Plan list */}
      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Day Plan
        </button>
      )}

      {creating && (
        <DayPlanEditor
          anchors={anchors}
          routines={routines}
          onSave={(plan) => { addDayPlan(plan); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {dayPlans.map((plan) => {
          if (editing === plan.id) {
            return (
              <DayPlanEditor
                key={plan.id}
                initial={plan}
                anchors={anchors}
                routines={routines}
                onSave={(updated) => { updateDayPlan(plan.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteDayPlan(plan.id); setEditing(null) }}
              />
            )
          }

          return (
            <div
              key={plan.id}
              onClick={() => setEditing(plan.id)}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}
            >
              <strong>{plan.name}</strong>
              <div style={{ fontSize: 12 }}>
                {plan.anchorIds.length} anchor(s) | {plan.routineIds.length} routine(s)
              </div>
            </div>
          )
        })}
      </div>

      {/* Week Planner */}
      <h3 style={{ marginTop: 24, marginBottom: 8 }}>Week Planner</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {weekDays.map((dayName, i) => (
            <tr key={i} style={{ borderTop: '1px solid #ccc' }}>
              <td style={{ padding: '6px 8px', width: 100, fontSize: 13 }}>{dayName}</td>
              <td style={{ padding: '6px 8px' }}>
                <select
                  value={weekPlan.days[i] ?? ''}
                  onChange={(e) => setWeekDay(i, e.target.value)}
                >
                  <option value="">-- none --</option>
                  {dayPlans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DayPlanEditor({
  initial,
  anchors,
  routines,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: DayPlan
  anchors: { id: string; name: string }[]
  routines: { id: string; name: string }[]
  onSave: (plan: DayPlan) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [anchorIds, setAnchorIds] = useState<string[]>(initial?.anchorIds ?? [])
  const [routineIds, setRoutineIds] = useState<string[]>(initial?.routineIds ?? [])

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      anchorIds,
      routineIds,
    })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Anchors */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Anchors (define slots)</label>
        {anchorIds.map((aid, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select
              value={aid}
              onChange={(e) => {
                const updated = [...anchorIds]
                updated[i] = e.target.value
                setAnchorIds(updated)
              }}
            >
              <option value="">-- select --</option>
              {anchors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button onClick={() => setAnchorIds(anchorIds.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setAnchorIds([...anchorIds, ''])} style={{ marginTop: 4 }}>
          + Add anchor
        </button>
      </div>

      {/* Routines */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Routines</label>
        {routineIds.map((rid, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select
              value={rid}
              onChange={(e) => {
                const updated = [...routineIds]
                updated[i] = e.target.value
                setRoutineIds(updated)
              }}
            >
              <option value="">-- select --</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button onClick={() => setRoutineIds(routineIds.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setRoutineIds([...routineIds, ''])} style={{ marginTop: 4 }}>
          + Add routine
        </button>
      </div>

      <div style={{ borderTop: '1px solid #999', paddingTop: 8 }}>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save Changes</button>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Discard</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

export default DayPlannerPanel
