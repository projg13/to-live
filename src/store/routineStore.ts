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
        {
          id: 'routine-morning',
          name: 'Daily Morning',
          blockIds: ['block-morning'],
          recurrence: { pattern: 'daily' },
          idealSpawnTime: 360,
          taskConfigs: [
            {
              taskId: 'task-brush',
              // During work slot: weight 0 the whole time
              slotWeights: { 'anchor-work': [{ offsetMinutes: 0, value: 0 }] },
              expiresAfterMinutes: 720,
              idealTime: 370,
            },
            {
              taskId: 'task-bath',
              slotWeights: { 'anchor-work': [{ offsetMinutes: 0, value: 0 }] },
              expiresAfterMinutes: 720,
              idealTime: 390,
            },
            {
              taskId: 'task-breakfast',
              // During work slot: starts low, ramps up toward lunch (hunger)
              slotWeights: { 'anchor-work': [
                { offsetMinutes: 0, value: 10 },
                { offsetMinutes: 120, value: 50 },
                { offsetMinutes: 180, value: 80 },
              ]},
              expiresAfterMinutes: 480,
            },
          ],
          enabled: true,
        },
        {
          id: 'routine-evening-cook',
          name: 'Evening Cook',
          blockIds: ['block-evening-cook'],
          recurrence: { pattern: 'daily' },
          idealSpawnTime: 1080, // 6 PM
          taskConfigs: [
            {
              taskId: 'task-cook-prep',
              expiresAfterMinutes: 240,
              idealTime: 1080,
            },
          ],
          enabled: true,
        },
      ],
      addRoutine: (routine) =>
        set((state) => ({ routines: [...state.routines, routine] })),
      updateRoutine: (id, updates) =>
        set((state) => ({
          routines: state.routines.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      deleteRoutine: (id) =>
        set((state) => ({ routines: state.routines.filter((r) => r.id !== id) })),
      toggleEnabled: (id) =>
        set((state) => ({
          routines: state.routines.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
          ),
        })),
    }),
    { name: 'to-live-routines' }
  )
)
