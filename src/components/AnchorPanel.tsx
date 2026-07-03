import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { formatTime, toMinutes } from '../types/anchor'
import type { Anchor, AnchorTemplate } from '../types/anchor'

function AnchorPanel() {
  const { anchors, templates, addAnchor, updateAnchor, deleteAnchor, addTemplate, updateTemplate, deleteTemplate } = useAnchorStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  const sorted = [...anchors].sort((a, b) => a.spikeTime - b.spikeTime)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Anchors</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Anchor
        </button>
      )}

      {creating && (
        <AnchorEditor
          onSave={(anchor) => { addAnchor(anchor); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {sorted.map((anchor) => {
          if (editing === anchor.id) {
            return (
              <AnchorEditor
                key={anchor.id}
                initial={anchor}
                onSave={(updated) => { updateAnchor(anchor.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteAnchor(anchor.id); setEditing(null) }}
              />
            )
          }

          return (
            <div
              key={anchor.id}
              onClick={() => setEditing(anchor.id)}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  <strong>{anchor.name}</strong>
                  {anchor.slotName && <span style={{ fontSize: 12, marginLeft: 8 }}>({anchor.slotName})</span>}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  @ {formatTime(anchor.spikeTime)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Templates */}
      <h3 style={{ marginTop: 24, marginBottom: 8 }}>Anchor Templates</h3>

      {!creatingTemplate && (
        <button onClick={() => setCreatingTemplate(true)} style={{ marginBottom: 12 }}>
          + New Template
        </button>
      )}

      {creatingTemplate && (
        <TemplateEditor
          anchors={anchors}
          onSave={(tpl) => { addTemplate(tpl); setCreatingTemplate(false) }}
          onCancel={() => setCreatingTemplate(false)}
        />
      )}

      <div>
        {templates.map((tpl) => {
          if (editingTemplate === tpl.id) {
            return (
              <TemplateEditor
                key={tpl.id}
                initial={tpl}
                anchors={anchors}
                onSave={(updated) => { updateTemplate(tpl.id, updated); setEditingTemplate(null) }}
                onCancel={() => setEditingTemplate(null)}
                onDelete={() => { deleteTemplate(tpl.id); setEditingTemplate(null) }}
              />
            )
          }
          return (
            <div
              key={tpl.id}
              onClick={() => setEditingTemplate(tpl.id)}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}
            >
              <strong>{tpl.name}</strong>
              <span style={{ fontSize: 12, marginLeft: 8 }}>
                ({tpl.anchorIds.length} anchors: {tpl.anchorIds.map((id) => anchors.find((a) => a.id === id)?.name ?? '?').join(', ')})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnchorEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Anchor
  onSave: (anchor: Anchor) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [slotName, setSlotName] = useState(initial?.slotName ?? '')
  const [time, setTime] = useState(initial ? toTimeStr(initial.spikeTime) : '06:00')
  const [weight, setWeight] = useState(initial?.weight ?? 100)

  const handleSave = () => {
    if (!name.trim()) return
    const [h, m] = time.split(':').map(Number)
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      slotName: slotName.trim() || undefined,
      spikeTime: toMinutes(h || 0, m || 0),
      weight,
    })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13 }}>Anchor Name</label><br />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13 }}>Slot Name</label><br />
          <input type="text" value={slotName} onChange={(e) => setSlotName(e.target.value)} placeholder="e.g. Morning" style={{ width: '100%' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 13 }}>Time</label><br />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 13 }}>Weight</label><br />
          <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} style={{ width: 60 }} />
        </div>
      </div>

      <div>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save Changes</button>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Discard</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

function TemplateEditor({
  initial,
  anchors,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: AnchorTemplate
  anchors: Anchor[]
  onSave: (tpl: AnchorTemplate) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [anchorIds, setAnchorIds] = useState<string[]>(initial?.anchorIds ?? [])

  const handleSave = () => {
    if (!name.trim() || anchorIds.length === 0) return
    onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), anchorIds })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Template Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workday, Weekend" style={{ width: '100%' }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Anchors</label>
        {anchorIds.map((aid, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <select value={aid} onChange={(e) => { const u = [...anchorIds]; u[i] = e.target.value; setAnchorIds(u) }}>
              <option value="">-- select --</option>
              {anchors.map((a) => <option key={a.id} value={a.id}>{a.name} @ {formatTime(a.spikeTime)}</option>)}
            </select>
            <button onClick={() => setAnchorIds(anchorIds.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setAnchorIds([...anchorIds, ''])} style={{ marginTop: 4 }}>+ Add anchor</button>
      </div>

      <div>
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

export default AnchorPanel
