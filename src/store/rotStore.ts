import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RotEntry } from '../types/rot'

interface RotStore {
  entries: RotEntry[]
  addEntry: (entry: RotEntry) => void
  updateEntry: (id: string, updates: Partial<RotEntry>) => void
  deleteEntry: (id: string) => void
  getRotDays: (lastNDays: number) => number  // count of rot days in last N days
}

export const useRotStore = create<RotStore>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({ entries: [...state.entries, entry] })),
      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
      getRotDays: (lastNDays) => {
        const now = Date.now()
        const cutoff = now - lastNDays * 86400000
        return get().entries.filter((e) => new Date(e.date).getTime() >= cutoff).length
      },
    }),
    { name: 'to-live-rot', version: 2 }
  )
)
