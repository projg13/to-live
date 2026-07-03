import { useState } from 'react'
import { useAnchorStore } from '../store/anchorStore'
import { formatTime } from '../types/anchor'
import type { Anchor, Slot as SlotType, AnchorTemplate } from '../types/anchor'

export interface ResolvedSlot {
  startTime: number
  endTime: number
  slotId: string
  slotName: string
  anchorId: string
  anchorName: string
}

// Find resolved slots from a template
export function findSlots(template: AnchorTemplate, anchors: Anchor[], slots: SlotType[]): ResolvedSlot[] {
  if (!template || template.entries.length < 2) return []

  const sorted = [...template.entries].sort((a, b) => a.spikeTime - b.spikeTime)

  const resolved: ResolvedSlot[] = []
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    const next = sorted[(i + 1) % sorted.length]
    const anchor = anchors.find((a) => a.id === current.anchorId)
    const slot = slots.find((s) => s.id === current.slotId)

    resolved.push({
      startTime: current.spikeTime,
      endTime: next.spikeTime,
      slotId: current.slotId,
      slotName: slot?.name ?? '?',
      anchorId: current.anchorId,
      anchorName: anchor?.name ?? '?',
    })
  }

  return resolved
}

function DayPlanner() {
  const { anchors, slots, templates } = useAnchorStore()
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? '')
  const [virtualTime, setVirtualTime] = useState(360)

  const template = templates.find((t) => t.id === selectedTemplate)
  const resolvedSlots = template ? findSlots(template, anchors, slots) : []

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Day Planner</h3>

      {/* Template selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13 }}>Template: </label>
        <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

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
        {resolvedSlots.length === 0 && <p>Select a template with at least 2 anchors.</p>}
        {resolvedSlots.map((slot, i) => {
          const isActive = virtualTime >= slot.startTime && virtualTime < slot.endTime

          return (
            <div
              key={i}
              style={{
                borderTop: '1px solid #ccc',
                padding: '10px 8px',
                fontWeight: isActive ? 'bold' : 'normal',
              }}
            >
              <span>
                {isActive && <span>&#9654; </span>}
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                </span>
                {' '}
                <strong>{slot.slotName}</strong>
                <span style={{ fontSize: 11, marginLeft: 8 }}>({slot.anchorName})</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DayPlanner
