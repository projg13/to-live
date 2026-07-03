import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { getWeight, formatTime, toMinutes } from '../types/anchor'
import type { Anchor, WeightPoint } from '../types/anchor'

function AnchorPanel() {
  const { anchors, addAnchor, updateAnchor, deleteAnchor } = useAnchorStore()
  const [virtualTime, setVirtualTime] = useState(360)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      {/* Virtual Timer */}
      <div className="bg-white dark:bg-black rounded-lg p-4 shadow-sm border border-gray-300 dark:border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Virtual Time</span>
          <span className="text-lg font-mono font-bold">{formatTime(virtualTime)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1439}
          value={virtualTime}
          onChange={(e) => setVirtualTime(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      {/* Add button */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="w-full py-2 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-600 hover:text-gray-800 dark:hover:border-gray-300 dark:hover:text-gray-200 transition-colors"
        >
          + New Anchor
        </button>
      )}

      {/* Create form */}
      {creating && (
        <AnchorEditor
          virtualTime={virtualTime}
          onSave={(anchor) => {
            addAnchor(anchor)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Anchor list */}
      <div className="space-y-3">
        {anchors.map((anchor) => {
          const weight = getWeight(anchor, virtualTime)
          const maxWeight = Math.max(...anchor.weightCurve.map((p) => p.value), 1)
          const percent = (weight / maxWeight) * 100

          if (editing === anchor.id) {
            return (
              <AnchorEditor
                key={anchor.id}
                initial={anchor}
                virtualTime={virtualTime}
                onSave={(updated) => {
                  updateAnchor(anchor.id, updated)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
                onDelete={() => {
                  deleteAnchor(anchor.id)
                  setEditing(null)
                }}
              />
            )
          }

          return (
            <div
              key={anchor.id}
              onClick={() => setEditing(anchor.id)}
              className="bg-white dark:bg-black rounded-lg p-4 shadow-sm border border-gray-300 dark:border-gray-600 cursor-pointer hover:border-gray-500 dark:hover:border-gray-400 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{anchor.name}</span>
                <span className="font-mono text-sm font-bold">
                  {Math.round(weight)}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-800 dark:bg-gray-200 rounded-full transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {anchor.weightCurve.map((pt, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600"
                  >
                    {formatTime(pt.time)} → {pt.value}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Editor Component ---

function AnchorEditor({
  initial,
  virtualTime,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: Anchor
  virtualTime: number
  onSave: (anchor: Partial<Anchor> & { id: string; name: string; weightCurve: WeightPoint[] }) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [points, setPoints] = useState<WeightPoint[]>(
    initial?.weightCurve ?? [{ time: 360, value: 0 }]
  )

  const updatePoint = (index: number, field: 'time' | 'value', raw: string) => {
    const updated = [...points]
    if (field === 'time') {
      const [h, m] = raw.split(':').map(Number)
      if (!isNaN(h)) updated[index] = { ...updated[index], time: toMinutes(h, m || 0) }
    } else {
      updated[index] = { ...updated[index], value: Number(raw) || 0 }
    }
    setPoints(updated)
  }

  const addPoint = () => {
    const last = points[points.length - 1]
    setPoints([...points, { time: (last?.time ?? 360) + 60, value: 0 }])
  }

  const removePoint = (index: number) => {
    setPoints(points.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (!name.trim()) return
    const sorted = [...points].sort((a, b) => a.time - b.time)
    onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), weightCurve: sorted })
  }

  const toTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const sortedPreview = [...points].sort((a, b) => a.time - b.time)
  const previewWeight = getWeight(
    { id: '', name: '', weightCurve: sortedPreview },
    virtualTime
  )

  return (
    <div className="bg-white dark:bg-black rounded-lg p-4 shadow-sm border-2 border-gray-800 dark:border-gray-300">
      {/* Live resolved value */}
      <div className="mb-3 flex items-center justify-between bg-gray-100 dark:bg-gray-900 rounded px-3 py-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          @ {formatTime(virtualTime)}
        </span>
        <span className="font-mono font-bold">
          {Math.round(previewWeight)}
        </span>
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Anchor name"
        className="w-full mb-3 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:border-gray-800 dark:focus:border-gray-300"
      />

      {/* Weight points */}
      <div className="space-y-2 mb-3">
        <span className="text-xs font-medium text-gray-500">Control Points</span>
        {points.map((pt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={toTimeStr(pt.time)}
              onChange={(e) => updatePoint(i, 'time', e.target.value)}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-gray-800 dark:focus:border-gray-300"
            />
            <input
              type="number"
              value={pt.value}
              onChange={(e) => updatePoint(i, 'value', e.target.value)}
              placeholder="Weight"
              className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-gray-800 dark:focus:border-gray-300"
            />
            {points.length > 1 && (
              <button
                onClick={() => removePoint(i)}
                className="text-gray-400 hover:text-gray-800 dark:hover:text-white text-sm font-bold"
              >
                x
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addPoint}
          className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white"
        >
          + Add point
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded text-sm font-medium hover:bg-black dark:hover:bg-gray-200"
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-gray-200 dark:bg-gray-800 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-700"
        >
          Discard
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-4 py-1.5 border border-gray-400 dark:border-gray-500 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-900 ml-auto"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default AnchorPanel
