import { useState } from 'react'
import { useBlockStore } from '../store/blockStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import type { Block, BlockEntry, OverflowBehavior } from '../types/block'

function BlockPanel() {
  const { blocks, addBlock, updateBlock, deleteBlock } = useBlockStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Blocks</h3>

      {!creating && (
        <button onClick={() => setCreating(true)} style={{ marginBottom: 12 }}>
          + New Block
        </button>
      )}

      {creating && (
        <BlockEditor
          onSave={(block) => { addBlock(block); setCreating(false) }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div>
        {blocks.map((block) => {
          if (editing === block.id) {
            return (
              <BlockEditor
                key={block.id}
                initial={block}
                onSave={(updated) => { updateBlock(block.id, updated); setEditing(null) }}
                onCancel={() => setEditing(null)}
                onDelete={() => { deleteBlock(block.id); setEditing(null) }}
              />
            )
          }

          return (
            <div
              key={block.id}
              onClick={() => setEditing(block.id)}
              style={{ borderTop: '1px solid #ccc', padding: '8px 0', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{block.name}</strong>
                <span style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  {block.entries.length} tasks | {block.expectedDurationMinutes}min
                </span>
              </div>
              <div style={{ fontSize: 11 }}>
                Overflow: {block.overflowBehavior}
                {block.blockStickiness ? ` | Sticky: ${block.blockStickiness}` : ''}
                {block.expiresAfterMinutes ? ` | Expires: +${block.expiresAfterMinutes}min` : ''}
              </div>
            </div>
          )
        })}
        {blocks.length === 0 && !creating && (
          <p style={{ fontSize: 12, fontStyle: 'italic' }}>No blocks yet.</p>
        )}
      </div>
    </div>
  )
}

function BlockEditor({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Block
  onSave: (block: Block) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { tasks } = useTaskStore()
  const { anchors } = useAnchorStore()

  const [name, setName] = useState(initial?.name ?? '')
  const [anchorId, setAnchorId] = useState(initial?.anchorId ?? '')
  const [entries, setEntries] = useState<BlockEntry[]>(initial?.entries ?? [])
  const [expectedDuration, setExpectedDuration] = useState(initial?.expectedDurationMinutes ?? 0)
  const [overflowBehavior, setOverflowBehavior] = useState<OverflowBehavior>(
    initial?.overflowBehavior ?? 'drop'
  )
  const [blockStickiness, setBlockStickiness] = useState(initial?.blockStickiness ?? 0)
  const [expiresAfter, setExpiresAfter] = useState(initial?.expiresAfterMinutes ?? 0)

  const handleSave = () => {
    if (!name.trim() || !anchorId) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      anchorId,
      entries,
      expectedDurationMinutes: expectedDuration,
      overflowBehavior,
      blockStickiness: blockStickiness || undefined,
      expiresAfterMinutes: expiresAfter || undefined,
    })
  }

  const addEntry = () => {
    setEntries([...entries, { taskId: '', order: entries.length, isBackground: false, mandatory: false }])
  }

  const addLinkedChain = () => {
    // Pick a mother task, then explode its link chain into entries
    const taskId = window.prompt('Enter mother task ID to explode its chain')
    const task = tasks.find((t) => t.id === taskId)
    if (!task) { addEntry(); return }

    const chain: BlockEntry[] = [
      { taskId: task.id, order: entries.length, isBackground: false, mandatory: true },
    ]

    // Follow links and add each as an entry
    let current = task
    let idx = 1
    while (current.links && current.links.length > 0) {
      for (const link of current.links) {
        const linked = tasks.find((t) => t.id === link.linkedTaskId)
        if (!linked) continue
        chain.push({
          taskId: linked.id,
          order: entries.length + idx,
          isBackground: link.linkType === 'passive',
          mandatory: true,
        })
        idx++
        // Follow first link chain only
        current = linked
        break
      }
      if (!current.links || current.links.length === 0) break
    }

    setEntries([...entries, ...chain])
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const updateEntry = (index: number, updates: Partial<BlockEntry>) => {
    const updated = [...entries]
    updated[index] = { ...updated[index], ...updates }
    setEntries(updated)
  }

  const moveEntry = (index: number, direction: -1 | 1) => {
    const sorted = [...entries].sort((a, b) => a.order - b.order)
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const temp = sorted[index].order
    sorted[index] = { ...sorted[index], order: sorted[target].order }
    sorted[target] = { ...sorted[target], order: temp }
    setEntries(sorted)
  }

  return (
    <div style={{ border: '2px solid #333', padding: 12, marginBottom: 12 }}>
      {/* Name */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Name</label><br />
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
      </div>

      {/* Anchor */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Attached to Anchor/Slot</label><br />
        <select value={anchorId} onChange={(e) => setAnchorId(e.target.value)}>
          <option value="">-- select anchor --</option>
          {anchors.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Config row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12 }}>Expected (min)</label><br />
          <input type="number" value={expectedDuration} onChange={(e) => setExpectedDuration(Number(e.target.value) || 0)} style={{ width: 60 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Overflow</label><br />
          <select value={overflowBehavior} onChange={(e) => setOverflowBehavior(e.target.value as OverflowBehavior)} style={{ fontSize: 11 }}>
            <option value="drop">drop</option>
            <option value="push">push</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Stickiness</label><br />
          <input type="number" value={blockStickiness} onChange={(e) => setBlockStickiness(Number(e.target.value) || 0)} style={{ width: 60 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Expires after (min)</label><br />
          <input type="number" value={expiresAfter} onChange={(e) => setExpiresAfter(Number(e.target.value) || 0)} style={{ width: 60 }} />
        </div>
      </div>

      {/* Entries */}
      <div style={{ marginBottom: 8, paddingLeft: 12, borderLeft: '2px solid #666' }}>
        <span style={{ fontSize: 12, fontWeight: 'bold' }}>Tasks in Block</span>
        {entries
          .sort((a, b) => a.order - b.order)
          .map((entry, i) => {
            return (
              <div key={i} style={{
                display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap',
                paddingLeft: entry.isBackground ? 20 : 0,
                fontStyle: entry.isBackground ? 'italic' : 'normal',
              }}>
                <span style={{ fontSize: 11, width: 20 }}>
                  {entry.isBackground ? '~' : `${entry.order}.`}
                </span>
                <select
                  value={entry.taskId}
                  onChange={(e) => updateEntry(i, { taskId: e.target.value })}
                  style={{ fontSize: 11 }}
                >
                  <option value="">-- task --</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <label style={{ fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={entry.isBackground}
                    onChange={(e) => updateEntry(i, { isBackground: e.target.checked })}
                  />
                  {' '}bg
                </label>
                <label style={{ fontSize: 11 }}>
                  <input
                    type="checkbox"
                    checked={entry.mandatory}
                    onChange={(e) => updateEntry(i, { mandatory: e.target.checked })}
                  />
                  {' '}mand.
                </label>
                <input
                  type="number"
                  value={entry.stickinessBoost ?? ''}
                  onChange={(e) => updateEntry(i, { stickinessBoost: Number(e.target.value) || undefined })}
                  placeholder="sticky+"
                  style={{ width: 50, fontSize: 11 }}
                />
                <button onClick={() => moveEntry(i, -1)} disabled={i === 0} style={{ fontSize: 11 }}>^</button>
                <button onClick={() => moveEntry(i, 1)} disabled={i === entries.length - 1} style={{ fontSize: 11 }}>v</button>
                <button onClick={() => removeEntry(i)} style={{ fontSize: 11 }}>x</button>
              </div>
            )
          })}
        <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
          <button onClick={addEntry} style={{ fontSize: 11 }}>+ Add task</button>
          <button onClick={addLinkedChain} style={{ fontSize: 11 }}>+ Explode chain</button>
        </div>
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

export default BlockPanel
