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
      routines: [
        // Mon/Wed
        {
          id: 'routine-gym-day',
          name: 'Gym Day (Mon/Wed)',
          blockIds: ['block-morning-gym', 'block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [1, 3] },
          idealSpawnTime: 360, // 6 AM
          enabled: true,
        },
        // Tue/Thu
        {
          id: 'routine-study-day',
          name: 'Study Day (Tue/Thu)',
          blockIds: ['block-morning-study', 'block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [2, 4] },
          idealSpawnTime: 360,
          enabled: true,
        },
        // Friday
        {
          id: 'routine-friday',
          name: 'Friday',
          blockIds: ['block-morning-fri', 'block-fri-game', 'block-fri-post-game', 'block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [5] },
          idealSpawnTime: 360,
          enabled: true,
        },
        // Saturday
        {
          id: 'routine-saturday',
          name: 'Saturday',
          blockIds: ['block-morning-sat', 'block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [6] },
          idealSpawnTime: 360,
          enabled: true,
        },
        // Sunday
        {
          id: 'routine-sunday',
          name: 'Sunday',
          blockIds: ['block-morning-sun', 'block-sun-pre-evening', 'block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [0] },
          idealSpawnTime: 360,
          enabled: true,
        },
      ],
      addRoutine: (routine) =>
        set((state) => ({ routines: [...state.routines, routine] })),
      updateRoutine: (id, updates) =>
        set((state) => ({ routines: state.routines.map((r) => (r.id === id ? { ...r, ...updates } : r)) })),
      deleteRoutine: (id) =>
        set((state) => ({ routines: state.routines.filter((r) => r.id !== id) })),
      toggleEnabled: (id) =>
        set((state) => ({ routines: state.routines.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r) })),
    }),
    { name: 'to-live-routines' }
  )
)
