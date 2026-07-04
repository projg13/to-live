import { useState } from 'react'
import { useBlockStore } from '../store/blockStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import type { Block, BlockEntry, OverflowBehavior } from '../types/block'

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

const ArrowUpIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

function BlockPanel() {
  const { blocks, addBlock, updateBlock, deleteBlock } = useBlockStore()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Schedule Blocks</h3>
          <p className="text-xs text-slate-400">Fixed duration windows containing a list of target tasks.</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> New Block
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <BlockEditor
            onSave={(block) => {
              addBlock(block)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {blocks.map((block) => {
          if (editing === block.id) {
            return (
              <div key={block.id} className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
                <BlockEditor
                  initial={block}
                  onSave={(updated) => {
                    updateBlock(block.id, updated)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    deleteBlock(block.id)
                    setEditing(null)
                  }}
                />
              </div>
            )
          }

          const activeParams: string[] = []
          if (block.overflowBehavior === 'push') activeParams.push('overflow: push')
          if (block.blockStickiness) activeParams.push(`sticky: ${block.blockStickiness}`)
          if (block.expiresAfterMinutes) activeParams.push(`expires: +${block.expiresAfterMinutes}m`)

          return (
            <div
              key={block.id}
              onClick={() => setEditing(block.id)}
              className="group flex justify-between items-center py-3.5 px-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm cursor-pointer transition-all duration-200"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-205 text-[15px]">
                    {block.name}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-400">
                    {block.entries.length} tasks | {block.expectedDurationMinutes}m
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs font-semibold text-slate-400">
                  {activeParams.map((p) => {
                    let color = 'bg-slate-950/60 text-slate-400 border-slate-850'
                    if (p.includes('push')) color = 'bg-teal-955/35 text-teal-400 border-teal-900/30'
                    if (p.includes('sticky')) color = 'bg-indigo-955/35 text-indigo-400 border-indigo-900/30'
                    if (p.includes('expires')) color = 'bg-rose-955/35 text-rose-455 border-rose-900/20'
                    return (
                      <span key={p} className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${color}`}>
                        {p}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-bold text-cyan-400">
                  Edit Block
                </span>
              </div>
            </div>
          )
        })}

        {blocks.length === 0 && !creating && (
          <p className="text-sm italic text-slate-500 py-4">
            No schedule blocks created. Build blocks to organize task lists.
          </p>
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
    const taskId = window.prompt('Enter mother task ID to explode its chain')
    const task = tasks.find((t) => t.id === taskId)
    if (!task) { addEntry(); return }

    const chain: BlockEntry[] = [
      { taskId: task.id, order: entries.length, isBackground: false, mandatory: true },
    ]

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
        current = linked
        break
      }
      if (!current.links || current.links.length === 0) break
    }

    setEntries([...entries, ...chain])
  }

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i })))
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
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Focus Work Block"
          className="text-sm px-3.5 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
        />
      </div>

      {/* Anchor */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Attached to Anchor/Slot
        </label>
        <select
          value={anchorId}
          onChange={(e) => setAnchorId(e.target.value)}
          className="text-sm px-3 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:outline-none cursor-pointer"
        >
          <option value="">-- select anchor --</option>
          {anchors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Config Row params */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/30 p-3.5 border border-slate-800 rounded-xl flex-wrap">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Expected (min)
          </label>
          <input
            type="number"
            value={expectedDuration}
            onChange={(e) => setExpectedDuration(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Overflow
          </label>
          <select
            value={overflowBehavior}
            onChange={(e) => setOverflowBehavior(e.target.value as OverflowBehavior)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="drop">drop</option>
            <option value="push">push</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            Stickiness
          </label>
          <input
            type="number"
            value={blockStickiness}
            onChange={(e) => setBlockStickiness(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            Expires (min)
          </label>
          <input
            type="number"
            value={expiresAfter}
            onChange={(e) => setExpiresAfter(Number(e.target.value) || 0)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-300 focus:outline-none"
          />
        </div>
      </div>

      {/* Entries Checklist */}
      <div className="space-y-3 pl-4 border-l-2 border-cyan-505 bg-slate-900/10 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Tasks in Block
        </span>
        
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {entries
            .sort((a, b) => a.order - b.order)
            .map((entry, i) => (
              <div
                key={i}
                className="bg-slate-950/60 border border-slate-850 p-3 rounded-2xl space-y-2.5 transition-all duration-200"
                style={{
                  paddingLeft: entry.isBackground ? '24px' : '12px',
                }}
              >
                {/* Top Row: Selector & Delete */}
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-slate-500 w-5">
                    {entry.isBackground ? '~' : `${entry.order + 1}.`}
                  </span>

                  <select
                    value={entry.taskId}
                    onChange={(e) => updateEntry(i, { taskId: e.target.value })}
                    className="text-xs px-2.5 py-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-205 focus:outline-none cursor-pointer flex-1 min-w-0"
                  >
                    <option value="">-- select task --</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => removeEntry(i)}
                    className="p-2 rounded-xl text-slate-405 hover:bg-rose-955/25 hover:text-rose-400 transition-all cursor-pointer flex-none"
                    title="Remove task"
                  >
                    <XIcon />
                  </button>
                </div>

                {/* Bottom Row: Knobs and ordering */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-900/60">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={entry.isBackground}
                        onChange={(e) => updateEntry(i, { isBackground: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-505 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
                      />
                      background task
                    </label>

                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={entry.mandatory}
                        onChange={(e) => updateEntry(i, { mandatory: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-505 focus:ring-cyan-500 h-4 w-4 cursor-pointer"
                      />
                      mandatory
                    </label>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-450">
                      <span>sticky boost:</span>
                      <input
                        type="number"
                        value={entry.stickinessBoost ?? ''}
                        onChange={(e) => updateEntry(i, { stickinessBoost: Number(e.target.value) || undefined })}
                        placeholder="0"
                        className="w-14 px-2 py-1 text-center bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Ordering arrows */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-850 p-0.5 rounded-lg flex-none">
                    <button
                      onClick={() => moveEntry(i, -1)}
                      disabled={i === 0}
                      className="p-1 px-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUpIcon />
                    </button>
                    <div className="w-[1px] h-3 bg-slate-800" />
                    <button
                      onClick={() => moveEntry(i, 1)}
                      disabled={i === entries.length - 1}
                      className="p-1 px-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDownIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={addEntry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-850 transition-all cursor-pointer"
          >
            <PlusIcon /> Add task
          </button>
          <button
            onClick={addLinkedChain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-955 hover:bg-slate-900 text-slate-350 border border-slate-850 transition-all cursor-pointer"
          >
            <PlusIcon /> Explode chain
          </button>
        </div>
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

export default BlockPanel
