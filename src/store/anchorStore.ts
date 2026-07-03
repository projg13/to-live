import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Anchor, AnchorTemplate } from '../types/anchor'
import { toMinutes } from '../types/anchor'

interface AnchorStore {
  anchors: Anchor[]
  templates: AnchorTemplate[]
  addAnchor: (anchor: Anchor) => void
  updateAnchor: (id: string, updates: Partial<Anchor>) => void
  deleteAnchor: (id: string) => void
  addTemplate: (template: AnchorTemplate) => void
  updateTemplate: (id: string, updates: Partial<AnchorTemplate>) => void
  deleteTemplate: (id: string) => void
}

export const useAnchorStore = create<AnchorStore>()(
  persist(
    (set) => ({
      anchors: [
        { id: 'anchor-wake', name: 'Wake', slotName: 'Morning', spikeTime: toMinutes(6, 0), weight: 100 },
        { id: 'anchor-work-start', name: 'Work Start', slotName: 'Work Hours', spikeTime: toMinutes(9, 0), weight: 100 },
        { id: 'anchor-work-end', name: 'Work End', slotName: 'Evening', spikeTime: toMinutes(17, 0), weight: 100 },
        { id: 'anchor-sleep', name: 'Sleep', slotName: 'Night', spikeTime: toMinutes(21, 0), weight: 100 },
      ],
      templates: [
        {
          id: 'tpl-workday',
          name: 'Workday',
          anchorIds: ['anchor-wake', 'anchor-work-start', 'anchor-work-end', 'anchor-sleep'],
        },
        {
          id: 'tpl-weekend',
          name: 'Weekend',
          anchorIds: ['anchor-wake', 'anchor-sleep'],
        },
      ],
      addAnchor: (anchor) =>
        set((state) => ({ anchors: [...state.anchors, anchor] })),
      updateAnchor: (id, updates) =>
        set((state) => ({
          anchors: state.anchors.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
      deleteAnchor: (id) =>
        set((state) => ({ anchors: state.anchors.filter((a) => a.id !== id) })),
      addTemplate: (template) =>
        set((state) => ({ templates: [...state.templates, template] })),
      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      deleteTemplate: (id) =>
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'to-live-anchors' }
  )
)
