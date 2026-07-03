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

const k = { scheduled: false, isMother: false, hasWeightCurve: false, hasExpiry: false, hasStickiness: false }

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [
        // === Morning routine tasks ===
        { id: 't-brush', title: 'Brush', weight: 80, durationMinutes: 10, knobs: { ...k, hasStickiness: true }, stickiness: 200 },
        { id: 't-protein-am', title: 'Protein', weight: 70, durationMinutes: 10, knobs: k },
        { id: 't-gym', title: 'Gym', weight: 90, durationMinutes: 130, knobs: k },
        { id: 't-study', title: 'Study', weight: 85, durationMinutes: 130, knobs: k },
        { id: 't-heater-relax', title: 'Turn on heater & relax', weight: 50, durationMinutes: 20, knobs: k },
        { id: 't-bath', title: 'Bath', weight: 75, durationMinutes: 20, knobs: k },
        { id: 't-oil-bath', title: 'Oil bath', weight: 75, durationMinutes: 60, knobs: k },
        { id: 't-bath-groom', title: 'Bath + Grooming', weight: 75, durationMinutes: 60, knobs: k },
        { id: 't-sandhi-am', title: 'Sandhi (AM)', weight: 70, durationMinutes: 15, knobs: k },
        { id: 't-cook', title: 'Cook', weight: 80, durationMinutes: 60, knobs: k },
        { id: 't-eat-am', title: 'Eat (morning)', weight: 70, durationMinutes: 15, knobs: k },
        { id: 't-change', title: 'Change', weight: 60, durationMinutes: 10, knobs: k },
        { id: 't-walk-office', title: 'Walk to office', weight: 90, durationMinutes: 10, knobs: k },

        // === Work ===
        { id: 't-work', title: 'Work', weight: 100, durationMinutes: 480, knobs: k },
        { id: 't-work-fri-am', title: 'Work (Fri morning)', weight: 100, durationMinutes: 210, knobs: k },
        { id: 't-work-fri-eve', title: 'Work (Fri post-game)', weight: 90, durationMinutes: 60, knobs: k },

        // === Friday extras ===
        { id: 't-football', title: 'Football', weight: 95, durationMinutes: 180, knobs: k },
        { id: 't-bath-fri', title: 'Bath (post-football)', weight: 75, durationMinutes: 20, knobs: k },
        { id: 't-eat-fri', title: 'Eat (post-football)', weight: 70, durationMinutes: 10, knobs: k },

        // === Evening routine tasks ===
        { id: 't-come-home', title: 'Come home', weight: 80, durationMinutes: 10, knobs: k },
        { id: 't-protein-pm', title: 'Protein (PM)', weight: 70, durationMinutes: 10, knobs: k },
        { id: 't-sandhi-pm', title: 'Sandhi (PM)', weight: 70, durationMinutes: 20, knobs: k },
        { id: 't-dinner-prep', title: 'Dinner prep', weight: 75, durationMinutes: 30, knobs: k },
        { id: 't-eat-pm', title: 'Eat (dinner)', weight: 70, durationMinutes: 15, knobs: k },

        // === Laundry chain ===
        { id: 't-laundry-wash', title: 'Laundry: wash', weight: 60, durationMinutes: 5, knobs: { ...k, isMother: true }, links: [{ linkedTaskId: 't-laundry-machine', linkType: 'passive', continuity: 'continuous' }] },
        { id: 't-laundry-machine', title: 'Laundry: machine running', weight: 10, durationMinutes: 45, knobs: { ...k, isMother: true }, links: [{ linkedTaskId: 't-laundry-fold', linkType: 'active' }] },
        { id: 't-laundry-fold', title: 'Laundry: fold', weight: 60, durationMinutes: 15, knobs: k },
        { id: 't-laundry-prep', title: 'Laundry: prep (iron/sort)', weight: 55, durationMinutes: 30, knobs: k },
        { id: 't-laundry-hang', title: 'Laundry: hang', weight: 55, durationMinutes: 10, knobs: k },

        // === Misc ===
        { id: 't-relax', title: 'Relax', weight: 30, durationMinutes: 30, knobs: k },
        { id: 't-groceries-sat', title: 'Groceries (Saturday)', weight: 70, durationMinutes: 30, knobs: k },
        { id: 't-groceries-sun', title: 'Groceries (Sunday - weekly)', weight: 75, durationMinutes: 45, knobs: k },
        { id: 't-read', title: 'Read', weight: 60, durationMinutes: 130, knobs: k },

        // === Sleep ===
        { id: 't-sleep', title: 'Sleep', weight: 1000, durationMinutes: 540, knobs: k },

        // === Recovery tasks ===
        { id: 't-garbage', title: 'Garbage collection', weight: 80, durationMinutes: 15, knobs: k },
        { id: 't-kitchen-clean', title: 'Kitchen cleaning', weight: 70, durationMinutes: 30, knobs: k },
        { id: 't-get-ready', title: 'Get ready', weight: 60, durationMinutes: 15, knobs: k },
        { id: 't-water-can', title: 'Water can', weight: 65, durationMinutes: 10, knobs: k },
      ],
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) =>
        set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      deleteTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      triggerLink: (parentId, linkedTaskId) => {
        const state = get()
        const parent = state.tasks.find((t) => t.id === parentId)
        if (!parent?.links) return
        const link = parent.links.find((l) => l.linkedTaskId === linkedTaskId)
        if (!link) return
        if (parent.spawnedIds?.includes(linkedTaskId)) return
        const linked = state.tasks.find((t) => t.id === linkedTaskId)
        if (!linked) return
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id === parentId) return { ...t, spawnedIds: [...(t.spawnedIds || []), linkedTaskId] }
            if (t.id === linkedTaskId) return { ...t, parentId }
            return t
          }),
        }))
      },
      getChildrenOf: (parentId) => get().tasks.filter((t) => t.parentId === parentId),
    }),
    { name: 'to-live-tasks', version: 3 }
  )
)
