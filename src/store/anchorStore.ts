import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Anchor, Slot, AnchorTemplate } from '../types/anchor'
import { toMinutes } from '../types/anchor'

interface AnchorStore {
  anchors: Anchor[]
  slots: Slot[]
  templates: AnchorTemplate[]
  addAnchor: (anchor: Anchor) => void
  updateAnchor: (id: string, updates: Partial<Anchor>) => void
  deleteAnchor: (id: string) => void
  addSlot: (slot: Slot) => void
  updateSlot: (id: string, updates: Partial<Slot>) => void
  deleteSlot: (id: string) => void
  addTemplate: (template: AnchorTemplate) => void
  updateTemplate: (id: string, updates: Partial<AnchorTemplate>) => void
  deleteTemplate: (id: string) => void
}

export const useAnchorStore = create<AnchorStore>()(
  persist(
    (set) => ({
      anchors: [
        { id: 'anchor-wake', name: 'Wake' },
        { id: 'anchor-work-start', name: 'Work Start' },
        { id: 'anchor-work-end', name: 'Work End' },
        { id: 'anchor-sleep', name: 'Sleep' },
      ],
      slots: [
        { id: 'slot-morning', name: 'Morning' },
        { id: 'slot-work', name: 'Work Hours' },
        { id: 'slot-evening', name: 'Evening' },
        { id: 'slot-night', name: 'Night' },
        { id: 'slot-free', name: 'Free Time' },
      ],
      templates: [
        {
          id: 'tpl-workday',
          name: 'Workday',
          entries: [
            { anchorId: 'anchor-wake', spikeTime: toMinutes(6, 0), slotId: 'slot-morning' },
            { anchorId: 'anchor-work-start', spikeTime: toMinutes(9, 0), slotId: 'slot-work' },
            { anchorId: 'anchor-work-end', spikeTime: toMinutes(18, 0), slotId: 'slot-evening' },
            { anchorId: 'anchor-sleep', spikeTime: toMinutes(21, 0), slotId: 'slot-night' },
          ],
        },
        {
          id: 'tpl-friday',
          name: 'Friday',
          entries: [
            { anchorId: 'anchor-wake', spikeTime: toMinutes(6, 0), slotId: 'slot-morning' },
            { anchorId: 'anchor-work-start', spikeTime: toMinutes(9, 0), slotId: 'slot-work' },
            { anchorId: 'anchor-work-end', spikeTime: toMinutes(13, 30), slotId: 'slot-free' },
            { anchorId: 'anchor-sleep', spikeTime: toMinutes(21, 0), slotId: 'slot-night' },
          ],
        },
        {
          id: 'tpl-weekend',
          name: 'Weekend',
          entries: [
            { anchorId: 'anchor-wake', spikeTime: toMinutes(6, 0), slotId: 'slot-morning' },
            { anchorId: 'anchor-sleep', spikeTime: toMinutes(21, 0), slotId: 'slot-night' },
          ],
        },
      ],
      addAnchor: (anchor) => set((state) => ({ anchors: [...state.anchors, anchor] })),
      updateAnchor: (id, updates) => set((state) => ({ anchors: state.anchors.map((a) => (a.id === id ? { ...a, ...updates } : a)) })),
      deleteAnchor: (id) => set((state) => ({ anchors: state.anchors.filter((a) => a.id !== id) })),
      addSlot: (slot) => set((state) => ({ slots: [...state.slots, slot] })),
      updateSlot: (id, updates) => set((state) => ({ slots: state.slots.map((s) => (s.id === id ? { ...s, ...updates } : s)) })),
      deleteSlot: (id) => set((state) => ({ slots: state.slots.filter((s) => s.id !== id) })),
      addTemplate: (template) => set((state) => ({ templates: [...state.templates, template] })),
      updateTemplate: (id, updates) => set((state) => ({ templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      deleteTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'to-live-anchors' }
  )
)
