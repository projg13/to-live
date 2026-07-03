import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { formatTime, toMinutes } from '../types/anchor'
import type { Anchor } from '../types/anchor'

function AnchorPanel() {
  const { anchors, addAnchor, updateAnchor, deleteAnchor } = useAnchorStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
                <strong>{anchor.name}</strong>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  @ {formatTime(anchor.spikeTime)}
                </span>
              </div>
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
  const [time, setTime] = useState(initial ? toTimeStr(initial.spikeTime) : '06:00')
  const [weight, setWeight] = useState(initial?.weight ?? 100)

  const handleSave = () => {
    if (!name.trim()) return
    const [h, m] = time.split(':').map(Number)
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      spikeTime: toMinutes(h || 0, m || 0),
      weight,
    })
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
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

function toTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default AnchorPanel
