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
        // Mon/Wed morning
        {
          id: 'routine-gym-morning',
          name: 'Gym Morning (Mon/Wed)',
          blockIds: ['block-morning-gym'],
          recurrence: { pattern: 'weekly', daysOfWeek: [1, 3] },
          idealSpawnTime: 360,
          taskConfigs: [
            { taskId: 't-cook', expiresAfterMinutes: 240 },       // dead after 10 AM
            { taskId: 't-sandhi-am', expiresAfterMinutes: 120 },
            { taskId: 't-protein-am', expiresAfterMinutes: 180 },
            { taskId: 't-eat-am', expiresAfterMinutes: 240 },
          ],
          enabled: true,
        },
        // Mon/Wed evening
        {
          id: 'routine-gym-evening',
          name: 'Evening (Mon/Wed)',
          blockIds: ['block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [1, 3] },
          idealSpawnTime: 1080, // Evening @ 6 PM
          taskConfigs: [
            { taskId: 't-dinner-prep', expiresAfterMinutes: 135 }, // must start before 8:15 PM
          ],
          enabled: true,
        },
        // Tue/Thu morning
        {
          id: 'routine-study-morning',
          name: 'Study Morning (Tue/Thu)',
          blockIds: ['block-morning-study'],
          recurrence: { pattern: 'weekly', daysOfWeek: [2, 4] },
          idealSpawnTime: 360,
          taskConfigs: [
            { taskId: 't-cook', expiresAfterMinutes: 240 },       // dead after 10 AM
            { taskId: 't-sandhi-am', expiresAfterMinutes: 120 },
            { taskId: 't-protein-am', expiresAfterMinutes: 180 },
            { taskId: 't-eat-am', expiresAfterMinutes: 240 },
          ],
          enabled: true,
        },
        // Tue/Thu evening
        {
          id: 'routine-study-evening',
          name: 'Evening (Tue/Thu)',
          blockIds: ['block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [2, 4] },
          idealSpawnTime: 1080,
          taskConfigs: [
            { taskId: 't-dinner-prep', expiresAfterMinutes: 135 },
          ],
          enabled: true,
        },
        // Friday morning
        {
          id: 'routine-fri-morning',
          name: 'Friday Morning',
          blockIds: ['block-morning-fri'],
          recurrence: { pattern: 'weekly', daysOfWeek: [5] },
          idealSpawnTime: 360,
          taskConfigs: [
            { taskId: 't-cook', expiresAfterMinutes: 120 },
            { taskId: 't-sandhi-am', expiresAfterMinutes: 120 },
            { taskId: 't-protein-am', expiresAfterMinutes: 180 },
            { taskId: 't-eat-am', expiresAfterMinutes: 240 },
          ],
          enabled: true,
        },
        // Friday game
        {
          id: 'routine-fri-game',
          name: 'Friday Game',
          blockIds: ['block-fri-game'],
          recurrence: { pattern: 'weekly', daysOfWeek: [5] },
          idealSpawnTime: 810, // Game Start @ 1:30 PM
          enabled: true,
        },
        // Friday post-game
        {
          id: 'routine-fri-post-game',
          name: 'Friday Post-Game',
          blockIds: ['block-fri-post-game'],
          recurrence: { pattern: 'weekly', daysOfWeek: [5] },
          idealSpawnTime: 990, // Game End @ 4:30 PM
          enabled: true,
        },
        // Friday evening
        {
          id: 'routine-fri-evening',
          name: 'Friday Evening',
          blockIds: ['block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [5] },
          idealSpawnTime: 1080,
          taskConfigs: [
            { taskId: 't-dinner-prep', expiresAfterMinutes: 135 },
          ],
          enabled: true,
        },
        // Saturday morning
        {
          id: 'routine-sat-morning',
          name: 'Saturday Morning',
          blockIds: ['block-morning-sat'],
          recurrence: { pattern: 'weekly', daysOfWeek: [6] },
          idealSpawnTime: 360,
          taskConfigs: [
            { taskId: 't-cook', expiresAfterMinutes: 240 },
            { taskId: 't-sandhi-am', expiresAfterMinutes: 120 },
            { taskId: 't-protein-am', expiresAfterMinutes: 180 },
            { taskId: 't-eat-am', expiresAfterMinutes: 240 },
          ],
          enabled: true,
        },
        // Saturday evening
        {
          id: 'routine-sat-evening',
          name: 'Saturday Evening',
          blockIds: ['block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [6] },
          idealSpawnTime: 1080,
          taskConfigs: [
            { taskId: 't-dinner-prep', expiresAfterMinutes: 135 },
          ],
          enabled: true,
        },
        // Sunday morning
        {
          id: 'routine-sun-morning',
          name: 'Sunday Morning',
          blockIds: ['block-morning-sun'],
          recurrence: { pattern: 'weekly', daysOfWeek: [0] },
          idealSpawnTime: 360,
          taskConfigs: [
            { taskId: 't-cook', expiresAfterMinutes: 240 },
            { taskId: 't-sandhi-am', expiresAfterMinutes: 120 },
            { taskId: 't-protein-am', expiresAfterMinutes: 180 },
            { taskId: 't-eat-am', expiresAfterMinutes: 240 },
          ],
          enabled: true,
        },
        // Sunday pre-evening (groceries)
        {
          id: 'routine-sun-groceries',
          name: 'Sunday Groceries',
          blockIds: ['block-sun-pre-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [0] },
          idealSpawnTime: 1020, // 5 PM (before evening)
          enabled: true,
        },
        // Sunday evening
        {
          id: 'routine-sun-evening',
          name: 'Sunday Evening',
          blockIds: ['block-evening'],
          recurrence: { pattern: 'weekly', daysOfWeek: [0] },
          idealSpawnTime: 1080,
          taskConfigs: [
            { taskId: 't-dinner-prep', expiresAfterMinutes: 135 },
          ],
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
