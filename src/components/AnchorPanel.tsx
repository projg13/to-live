import React, { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { formatTime, toMinutes } from '../types/anchor'
import type { Anchor, Slot, AnchorTemplate, AnchorTemplateEntry } from '../types/anchor'

// Icons
const PlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

function AnchorPanel() {
  const store = useAnchorStore()
  const { anchors, slots, templates } = store

  return (
    <div className="space-y-8 text-slate-100">
      {/* Anchors Section */}
      <section className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-105">Anchors</h3>
          <p className="text-xs text-slate-400">Fixed time markers (e.g. Wakeup, Sleep) that organize your day flow.</p>
        </div>
        <SimpleList
          items={anchors}
          renderItem={(a) => <span className="font-bold text-slate-200 text-sm">{a.name}</span>}
          onAdd={() => store.addAnchor({ id: crypto.randomUUID(), name: 'New Anchor' })}
          onDelete={(id) => store.deleteAnchor(id)}
          onRename={(id, name) => store.updateAnchor(id, { name })}
          addLabel="New Anchor"
        />
      </section>

      {/* Slots Section */}
      <section className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-105">Slots</h3>
          <p className="text-xs text-slate-400">Period buffers between anchor events (e.g. Morning, Work hours, Night).</p>
        </div>
        <SimpleList
          items={slots}
          renderItem={(s) => <span className="font-bold text-slate-200 text-sm">{s.name}</span>}
          onAdd={() => store.addSlot({ id: crypto.randomUUID(), name: 'New Slot' })}
          onDelete={(id) => store.deleteSlot(id)}
          onRename={(id, name) => store.updateSlot(id, { name })}
          addLabel="New Slot"
        />
      </section>

      {/* Templates Section */}
      <section className="bg-slate-900/30 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-105">Anchor Templates</h3>
          <p className="text-xs text-slate-400">Complete day layouts assigning specific spike times to anchors and slot splits.</p>
        </div>
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
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex justify-between items-center py-2.5 px-4 bg-slate-950/40 border border-slate-850 rounded-xl"
        >
          {editingId === item.id ? (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none flex-1 max-w-xs"
              />
              <button
                onClick={() => {
                  onRename(item.id, editName)
                  setEditingId(null)
                }}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 transition-all cursor-pointer"
              >
                <CheckIcon /> Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold bg-slate-850 hover:bg-slate-800 text-slate-400 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {renderItem(item)}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingId(item.id)
                    setEditName(item.name)
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold bg-slate-900 hover:bg-slate-850 text-cyan-400 border border-slate-800 transition-all cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-rose-955/20 hover:text-rose-400 transition-all cursor-pointer"
                >
                  <TrashIcon />
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-850 transition-all cursor-pointer"
      >
        <PlusIcon /> {addLabel}
      </button>
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
    <div className="space-y-4">
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
        >
          <PlusIcon /> New Template
        </button>
      )}

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <TemplateEditor
            anchors={anchors}
            slots={slots}
            onSave={(tpl) => {
              onAdd(tpl)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {templates.map((tpl) => {
          if (editing === tpl.id) {
            return (
              <div key={tpl.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <TemplateEditor
                  initial={tpl}
                  anchors={anchors}
                  slots={slots}
                  onSave={(updated) => {
                    onUpdate(tpl.id, updated)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    onDelete(tpl.id)
                    setEditing(null)
                  }}
                />
              </div>
            )
          }

          return (
            <div
              key={tpl.id}
              onClick={() => setEditing(tpl.id)}
              className="group p-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm cursor-pointer hover:border-cyan-500/25 transition-all duration-200"
            >
              <div className="flex justify-between items-center mb-2">
                <strong className="text-slate-205 text-sm">{tpl.name}</strong>
                <span className="text-[11px] font-bold text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Edit Layout
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-450 font-mono">
                {tpl.entries.map((e, idx) => {
                  const a = anchors.find((x) => x.id === e.anchorId)
                  const s = slots.find((x) => x.id === e.slotId)
                  return (
                    <span
                      key={idx}
                      className="bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-[10px]"
                    >
                      {a?.name ?? '?'}: {formatTime(e.spikeTime)} → {s?.name ?? '?'}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
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
    <div className="space-y-4">
      {/* Template Name */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Template Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Workday Layout, Weekend Routine"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Entries List */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Entries (Anchor → Time → Slot)
        </span>
        
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 bg-slate-950/60 border border-slate-850 p-2.5 rounded-xl"
            >
              <select
                value={entry.anchorId}
                onChange={(e) => updateEntry(i, { anchorId: e.target.value })}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer flex-1 min-w-[100px]"
              >
                <option value="">-- select anchor --</option>
                {anchors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              
              <span className="text-slate-500 text-xs">@</span>

              <input
                type="time"
                value={toTimeStr(entry.spikeTime)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number)
                  updateEntry(i, { spikeTime: toMinutes(h || 0, m || 0) })
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 focus:outline-none cursor-pointer w-24"
              />

              <span className="text-slate-500 text-xs">→</span>

              <select
                value={entry.slotId}
                onChange={(e) => updateEntry(i, { slotId: e.target.value })}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer flex-1 min-w-[100px]"
              >
                <option value="">-- select slot --</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setEntries(entries.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-955/20 hover:text-rose-455 transition-all cursor-pointer"
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={() => setEntries([...entries, { anchorId: '', spikeTime: 360, slotId: '' }])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-955 hover:bg-slate-900 text-slate-350 border border-slate-850 transition-all cursor-pointer"
        >
          <PlusIcon /> Add entry
        </button>
      </div>

      {/* Save / Discard Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <CheckIcon /> Save Changes
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-955 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all cursor-pointer"
          >
            Discard
          </button>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-955/35 hover:bg-rose-900/30 text-rose-400 border border-rose-800/30 transition-all cursor-pointer"
          >
            <TrashIcon /> Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default AnchorPanel
