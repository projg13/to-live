import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task } from '../types/task'

interface TaskStore {
  tasks: Task[]
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  triggerLink: (parentId: string, linkedTaskId: string) => void
  getChildrenOf: (parentId: string) => Task[]
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [
        // Laundry chain: load → run (passive) → unload → hang
        {
          id: 'task-laundry-load',
          title: 'Laundry: load machine',
          weight: 80,
          durationMinutes: 10,
          links: [
            { linkedTaskId: 'task-laundry-run', linkType: 'passive', continuity: 'continuous' },
          ],
          knobs: { scheduled: false, isMother: true, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-laundry-run',
          title: 'Laundry: machine running',
          weight: 10,
          durationMinutes: 45,
          links: [
            { linkedTaskId: 'task-laundry-unload', linkType: 'active' },
          ],
          knobs: { scheduled: false, isMother: true, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-laundry-unload',
          title: 'Laundry: unload',
          weight: 70,
          durationMinutes: 5,
          links: [
            { linkedTaskId: 'task-hang-clothes', linkType: 'active' },
          ],
          knobs: { scheduled: false, isMother: true, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-hang-clothes',
          title: 'Hang clothes',
          weight: 70,
          durationMinutes: 15,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        // Morning workout
        {
          id: 'task-morning-workout',
          title: 'Morning workout',
          weight: 90,
          durationMinutes: 45,
          knobs: { scheduled: true, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: true },
          start: '2026-07-03T06:30:00',
          end: '2026-07-03T07:15:00',
          stickiness: 80,
        },
        // Cook dinner: prep → cooking (passive) → plate
        {
          id: 'task-cook-prep',
          title: 'Cook: prep ingredients',
          weight: 75,
          durationMinutes: 15,
          links: [
            { linkedTaskId: 'task-cook-cooking', linkType: 'passive', continuity: 'continuous' },
          ],
          knobs: { scheduled: false, isMother: true, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-cook-cooking',
          title: 'Cook: on stove',
          weight: 10,
          durationMinutes: 20,
          links: [
            { linkedTaskId: 'task-cook-plate', linkType: 'active' },
          ],
          knobs: { scheduled: false, isMother: true, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-cook-plate',
          title: 'Cook: plate & serve',
          weight: 60,
          durationMinutes: 5,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        // Simple tasks
        {
          id: 'task-read-book',
          title: 'Read book',
          weight: 40,
          durationMinutes: 30,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: true, hasStickiness: false },
          expiresAt: '2026-07-10T23:59:00',
        },
        {
          id: 'task-email-replies',
          title: 'Email replies',
          weight: 60,
          durationMinutes: 20,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: true, hasExpiry: true, hasStickiness: true },
          weightCurve: [
            { datetime: '2026-07-03T09:00:00', value: 30 },
            { datetime: '2026-07-03T12:00:00', value: 80 },
            { datetime: '2026-07-03T17:00:00', value: 100 },
          ],
          expiresAt: '2026-07-03T18:00:00',
          stickiness: 20,
        },
        {
          id: 'task-brush',
          title: 'Brush teeth',
          weight: 50,
          durationMinutes: 5,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-bath',
          title: 'Bath',
          weight: 50,
          durationMinutes: 20,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
        {
          id: 'task-breakfast',
          title: 'Eat breakfast',
          weight: 40,
          durationMinutes: 20,
          knobs: { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: false },
        },
      ],
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      deleteTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      triggerLink: (parentId, linkedTaskId) => {
        const state = get()
        const parent = state.tasks.find((t) => t.id === parentId)
        if (!parent || !parent.links) return

        const link = parent.links.find((l) => l.linkedTaskId === linkedTaskId)
        if (!link) return

        // Check if already triggered
        if (parent.spawnedIds?.includes(linkedTaskId)) return

        // Find the linked task
        const linked = state.tasks.find((t) => t.id === linkedTaskId)
        if (!linked) return

        // Set parent relationship and schedule if parent is scheduled
        const updates: Partial<Task> = { parentId }
        if (parent.start) {
          const parentStart = new Date(parent.start).getTime()
          const childStart = new Date(parentStart + parent.durationMinutes * 60000)
          updates.start = childStart.toISOString()
          updates.end = new Date(childStart.getTime() + linked.durationMinutes * 60000).toISOString()
          updates.knobs = { ...linked.knobs, scheduled: true }
        }

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id === parentId) {
              return { ...t, spawnedIds: [...(t.spawnedIds || []), linkedTaskId] }
            }
            if (t.id === linkedTaskId) {
              return { ...t, ...updates }
            }
            return t
          }),
        }))
      },
      getChildrenOf: (parentId) => get().tasks.filter((t) => t.parentId === parentId),
    }),
    {
      name: 'to-live-tasks',
      version: 2,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          const state = persisted as any
          state.tasks = (state.tasks || []).map((t: any) => {
            let durationMinutes = 30
            if (t.start && t.end) {
              durationMinutes = Math.round(
                (new Date(t.end).getTime() - new Date(t.start).getTime()) / 60000
              )
            }
            return {
              ...t,
              durationMinutes,
              knobs: { scheduled: !!(t.start && t.end), hasPhases: false, isMother: false },
            }
          })
        }
        return persisted
      },
    }
  )
)
