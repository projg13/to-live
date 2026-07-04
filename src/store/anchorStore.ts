import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Anchor, Slot, AnchorTemplate } from '../types/anchor'

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
      anchors: [],
      slots: [],
      templates: [],
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
    { name: 'to-live-anchors', version: 2 }
  )
)
