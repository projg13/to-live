import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { formatTime } from '../types/anchor'
import type { Anchor } from '../types/anchor'

export interface Slot {
  startTime: number       // minutes from midnight
  endTime: number         // minutes from midnight
  startAnchorId: string   // anchor that starts this slot
  endAnchorId: string     // anchor that ends this slot
  startAnchorName: string
  endAnchorName: string
  name: string            // "Wake → Work Start"
}

// Find slots: periods defined between consecutive anchors
export function findSlots(anchors: Anchor[]): Slot[] {
  if (anchors.length < 2) return []

  const sorted = [...anchors].sort((a, b) => a.spikeTime - b.spikeTime)

  const slots: Slot[] = []
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    const next = sorted[(i + 1) % sorted.length]
    const endTime = i === sorted.length - 1 ? next.spikeTime : next.spikeTime

    slots.push({
      startTime: current.spikeTime,
      endTime,
      startAnchorId: current.id,
      endAnchorId: next.id,
      startAnchorName: current.name,
      endAnchorName: next.name,
      name: `${current.name} → ${next.name}`,
    })
  }

  return slots
}

function DayPlanner() {
  const { anchors } = useAnchorStore()
  const [virtualTime, setVirtualTime] = useState(360)
  const [editingSlot, setEditingSlot] = useState<number | null>(null)

  const slots = findSlots(anchors)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Day Planner</h3>

      <div style={{ marginBottom: 16 }}>
        <span>Virtual Time: <strong>{formatTime(virtualTime)}</strong></span>
        <br />
        <input
          type="range"
          min={0}
          max={1439}
          value={virtualTime}
          onChange={(e) => setVirtualTime(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        {slots.length === 0 && <p>No anchors defined.</p>}
        {slots.map((slot, i) => {
          const isActive = virtualTime >= slot.startTime && virtualTime < slot.endTime
          const isEditing = editingSlot === i

          return (
            <div
              key={i}
              style={{
                borderTop: '1px solid #ccc',
                padding: '10px 8px',
                fontWeight: isActive ? 'bold' : 'normal',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {isActive && <span>&#9654; </span>}
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                  </span>
                  {' '}
                  <strong>{slot.name}</strong>
                </span>
                <button
                  onClick={() => setEditingSlot(isEditing ? null : i)}
                  style={{ fontSize: 12 }}
                >
                  {isEditing ? 'close' : 'edit'}
                </button>
              </div>

              {isEditing && (
                <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: '2px solid #999' }}>
                  <p style={{ fontSize: 12, fontStyle: 'italic', margin: 0 }}>
                    Slot items: tasks, blocks, routines, obligations (coming soon)
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DayPlanner
