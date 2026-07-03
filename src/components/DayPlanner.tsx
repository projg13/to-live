import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { getWeight, formatTime } from '../types/anchor'
import type { Anchor } from '../types/anchor'

export interface Slot {
  startTime: number // minutes from midnight
  endTime: number   // minutes from midnight (next anchor takes over)
  anchorName: string
  items: SlotItem[] // tasks, blocks, routines, obligations — TBD
}

export interface SlotItem {
  id: string
  type: 'task' | 'block' | 'routine' | 'obligation'
  title: string
}

// Find slots: periods between anchor dominance transitions
export function findSlots(anchors: Anchor[]): Slot[] {
  if (anchors.length === 0) return []

  const transitions: { time: number; anchorName: string }[] = []
  let prevDominant = ''

  for (let t = 0; t < 1440; t++) {
    let maxWeight = -1
    let dominant = ''

    for (const anchor of anchors) {
      const w = getWeight(anchor, t)
      if (w > maxWeight) {
        maxWeight = w
        dominant = anchor.name
      }
    }

    if (dominant !== prevDominant && maxWeight > 0) {
      transitions.push({ time: t, anchorName: dominant })
      prevDominant = dominant
    } else if (maxWeight <= 0) {
      prevDominant = ''
    }
  }

  const slots: Slot[] = []
  for (let i = 0; i < transitions.length; i++) {
    const next = transitions[i + 1]
    slots.push({
      startTime: transitions[i].time,
      endTime: next ? next.time : 1440,
      anchorName: transitions[i].anchorName,
      items: [],
    })
  }

  // Merge first and last slot if same anchor (wraps around midnight)
  if (slots.length >= 2 && slots[0].anchorName === slots[slots.length - 1].anchorName) {
    const last = slots.pop()!
    slots[0].startTime = last.startTime
    // endTime stays as original first slot's endTime (the next transition)
  }

  return slots
}

function DayPlanner() {
  const { anchors } = useAnchorStore()
  const [virtualTime, setVirtualTime] = useState(360)
  const [editingSlot, setEditingSlot] = useState<number | null>(null) // index

  const slots = findSlots(anchors)

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Day Planner</h3>

      {/* Virtual Timer */}
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

      {/* Slots */}
      <div>
        {slots.length === 0 && <p>No anchors defined. Add anchors to generate slots.</p>}
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
              {/* Slot header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {isActive && <span>&#9654; </span>}
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                  </span>
                  {' '}
                  <strong>{slot.anchorName}</strong>
                </span>
                <button
                  onClick={() => setEditingSlot(isEditing ? null : i)}
                  style={{ fontSize: 12 }}
                >
                  {isEditing ? 'close' : 'edit'}
                </button>
              </div>

              {/* Slot edit area (placeholder for tasks/blocks/routines/obligations) */}
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
