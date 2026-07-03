import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Anchor } from '../types/anchor'
import { toMinutes } from '../types/anchor'

interface AnchorStore {
  anchors: Anchor[]
  addAnchor: (anchor: Anchor) => void
  updateAnchor: (id: string, updates: Partial<Anchor>) => void
  deleteAnchor: (id: string) => void
}

export const useAnchorStore = create<AnchorStore>()(
  persist(
    (set) => ({
      anchors: [
        { id: 'anchor-wake', name: 'Wake', spikeTime: toMinutes(6, 0), weight: 100 },
        { id: 'anchor-work-start', name: 'Work Start', spikeTime: toMinutes(9, 0), weight: 100 },
        { id: 'anchor-work-end', name: 'Work End', spikeTime: toMinutes(17, 0), weight: 100 },
        { id: 'anchor-sleep', name: 'Sleep', spikeTime: toMinutes(21, 0), weight: 100 },
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
    }),
    { name: 'to-live-anchors' }
  )
)
