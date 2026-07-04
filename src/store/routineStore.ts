import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Routine } from '../types/routine'

interface RoutineStore {
  routines: Routine[]
  addRoutine: (routine: Routine) => void
  updateRoutine: (id: string, updates: Partial<Routine>) => void
  deleteRoutine: (id: string) => void
  toggleEnabled: (id: string) => void
}

export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set) => ({
      routines: [],
      addRoutine: (routine) =>
        set((state) => ({ routines: [...state.routines, routine] })),
      updateRoutine: (id, updates) =>
        set((state) => ({ routines: state.routines.map((r) => (r.id === id ? { ...r, ...updates } : r)) })),
      deleteRoutine: (id) =>
        set((state) => ({ routines: state.routines.filter((r) => r.id !== id) })),
      toggleEnabled: (id) =>
        set((state) => ({ routines: state.routines.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r) })),
    }),
    { name: 'to-live-routines', version: 2 }
  )
)
