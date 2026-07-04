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
      tasks: [],
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
    { name: 'to-live-tasks', version: 4 }
  )
)
