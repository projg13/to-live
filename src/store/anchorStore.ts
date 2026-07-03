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
        {
          id: 'sleep-default',
          name: 'Sleep',
          weightCurve: [
            { time: toMinutes(6, 0), value: 0 },
            { time: toMinutes(21, 0), value: 100 },
            { time: toMinutes(22, 0), value: 200 },
            { time: toMinutes(23, 0), value: 300 },
          ],
        },
        {
          id: 'anchor-work-start',
          name: 'Work Start',
          weightCurve: [
            { time: toMinutes(9, 0), value: 0 },
            { time: toMinutes(9, 15), value: 100 },
          ],
        },
        {
          id: 'anchor-work-end',
          name: 'Work End',
          weightCurve: [
            { time: toMinutes(17, 0), value: 0 },
            { time: toMinutes(17, 15), value: 100 },
          ],
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
    }),
    { name: 'to-live-anchors' }
  )
)
