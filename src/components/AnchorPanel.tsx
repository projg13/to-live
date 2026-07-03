import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { formatTime, toMinutes } from '../types/anchor'
import type { Anchor, Slot, AnchorTemplate, AnchorTemplateEntry } from '../types/anchor'

function AnchorPanel() {
  const store = useAnchorStore()
  const { anchors, slots, templates } = store

  return (
    <div>
      {/* Anchors */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Anchors</h3>
        <SimpleList
          items={anchors}
          renderItem={(a) => <strong>{a.name}</strong>}
          onAdd={() => store.addAnchor({ id: crypto.randomUUID(), name: 'New Anchor' })}
          onDelete={(id) => store.deleteAnchor(id)}
          onRename={(id, name) => store.updateAnchor(id, { name })}
          addLabel="+ New Anchor"
        />
      </section>

      {/* Slots */}
      <section style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Slots</h3>
        <SimpleList
          items={slots}
          renderItem={(s) => <strong>{s.name}</strong>}
          onAdd={() => store.addSlot({ id: crypto.randomUUID(), name: 'New Slot' })}
          onDelete={(id) => store.deleteSlot(id)}
          onRename={(id, name) => store.updateSlot(id, { name })}
          addLabel="+ New Slot"
        />
      </section>

      {/* Templates */}
      <section>
        <h3 style={{ marginBottom: 8 }}>Anchor Templates</h3>
        <TemplateSection
          templates={templates}
          anchors={anchors}
          slots={slots}
          onAdd={(tpl) => store.addTemplate(tpl)}
          onUpdate={(id, updates) => store.updateTemplate(id, updates)}
          onDelete={(id) => store.deleteTemplate(id)}
        />
      </section>
    </div>
  )
}

// --- Simple editable name list ---
function SimpleList({
  items,
  renderItem,
  onAdd,
  onDelete,
  onRename,
  addLabel,
}: {
  items: { id: string; name: string }[]
  renderItem: (item: { id: string; name: string }) => React.ReactNode
  onAdd: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  addLabel: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  return (
    <div>
      {items.map((item) => (
        <div key={item.id} style={{ borderTop: '1px solid #ccc', padding: '6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingId === item.id ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <button onClick={() => { onRename(item.id, editName); setEditingId(null) }}>save</button>
              <button onClick={() => setEditingId(null)}>cancel</button>
            </div>
          ) : (
            <>
              {renderItem(item)}
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setEditingId(item.id); setEditName(item.name) }} style={{ fontSize: 11 }}>edit</button>
                <button onClick={() => onDelete(item.id)} style={{ fontSize: 11 }}>x</button>
              </div>
            </>
          )}
        </div>
      ))}
      <button onClick={onAdd} style={{ marginTop: 8 }}>{addLabel}</button>
    </div>
  )
}

// --- Template Section ---
function TemplateSection({
  templates,
  anchors,
  slots,
  onAdd,
  onUpdate,
  onDelete,
}: {
  templates: AnchorTemplate[]
  anchors: Anchor[]
  slots: Slot[]
  onAdd: (tpl: AnchorTemplate) => void
  onUpdate: (id: string, updates: Partial<AnchorTemplate>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>+ New Template</button>
      )}

      {creating && (
        <TemplateEditor
          anchors={anchors}
          slots={slots}
          onSave={(tpl) => { onAdd(tpl); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      {templates.map((tpl) => {
        if (editing === tpl.id) {
          return (
            <TemplateEditor
              key={tpl.id}
              initial={tpl}
              anchors={anchors}
              slots={slots}
              onSave={(updated) => { onUpdate(tpl.id, updated); setEditing(null) }}
              onCancel={() => setEditing(null)}
              onDelete={() => { onDelete(tpl.id); setEditing(null) }}
            />
          )
        }

        return (
          <div key={tpl.id} onClick={() => setEditing(tpl.id)} style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}>
            <strong>{tpl.name}</strong>
            <div style={{ fontSize: 12 }}>
              {tpl.entries.map((e) => {
                const a = anchors.find((x) => x.id === e.anchorId)
                const s = slots.find((x) => x.id === e.slotId)
                return `${a?.name ?? '?'} @ ${formatTime(e.spikeTime)} → ${s?.name ?? '?'}`
              }).join(' | ')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TemplateEditor({
  initial,
  anchors,
  slots,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: AnchorTemplate
  anchors: Anchor[]
  slots: Slot[]
  onSave: (tpl: AnchorTemplate) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [entries, setEntries] = useState<AnchorTemplateEntry[]>(initial?.entries ?? [])

  const handleSave = () => {
    if (!name.trim() || entries.length === 0) return
    onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), entries })
  }

  const updateEntry = (i: number, updates: Partial<AnchorTemplateEntry>) => {
    const updated = [...entries]
    updated[i] = { ...updated[i], ...updates }
    setEntries(updated)
  }

  const toTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13 }}>Template Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 'bold' }}>Entries (Anchor + Time + Slot)</label>
        {entries.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <select value={entry.anchorId} onChange={(e) => updateEntry(i, { anchorId: e.target.value })}>
              <option value="">-- anchor --</option>
              {anchors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span>@</span>
            <input
              type="time"
              value={toTimeStr(entry.spikeTime)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                updateEntry(i, { spikeTime: toMinutes(h || 0, m || 0) })
              }}
            />
            <span>→</span>
            <select value={entry.slotId} onChange={(e) => updateEntry(i, { slotId: e.target.value })}>
              <option value="">-- slot --</option>
              {slots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setEntries(entries.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        <button onClick={() => setEntries([...entries, { anchorId: '', spikeTime: 360, slotId: '' }])} style={{ marginTop: 8 }}>
          + Add entry
        </button>
      </div>

      <div>
        <button onClick={handleSave} style={{ marginRight: 8 }}>Save Changes</button>
        <button onClick={onCancel} style={{ marginRight: 8 }}>Discard</button>
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

export default AnchorPanel
