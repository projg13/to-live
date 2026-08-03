import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Obligation } from '../types/obligation'
import { resolveObligationDeadline } from '../types/obligation'

interface ObligationStore {
  obligations: Obligation[]
  doneTasks: string[]              // obligation done keys (obligation:obId::taskId:periodKey)
  addObligation: (obligation: Obligation) => void
  updateObligation: (id: string, updates: Partial<Obligation>) => void
  deleteObligation: (id: string) => void
  toggleEnabled: (id: string) => void
  markObligationDone: (completionKey: string) => void
  unmarkObligationDone: (instanceKey: string) => void
  clearObligationDone: (obId?: string) => void
  purgeStaleDone: (todayStr: string) => void
}

export const useObligationStore = create<ObligationStore>()(
  persist(
    (set) => ({
      obligations: [],
      doneTasks: [],
      addObligation: (obligation) =>
        set((state) => ({ obligations: [...state.obligations, obligation] })),
      updateObligation: (id, updates) =>
        set((state) => ({ obligations: state.obligations.map((o) => (o.id === id ? { ...o, ...updates } : o)) })),
      deleteObligation: (id) =>
        set((state) => ({ obligations: state.obligations.filter((o) => o.id !== id) })),
      toggleEnabled: (id) =>
        set((state) => ({ obligations: state.obligations.map((o) => o.id === id ? { ...o, enabled: !o.enabled } : o) })),
      markObligationDone: (completionKey) =>
        set((state) => ({
          doneTasks: [...state.doneTasks.filter((k) => k !== completionKey), completionKey],
        })),
      unmarkObligationDone: (instanceKey) =>
        set((state) => ({
          doneTasks: state.doneTasks.filter((k) => !k.startsWith(instanceKey + ':')),
        })),
      clearObligationDone: (obId) =>
        set((state) => ({
          doneTasks: obId
            ? state.doneTasks.filter((k) => !k.startsWith(`obligation:${obId}:`))
            : [],
        })),
      purgeStaleDone: (todayStr) =>
        set((state) => {
          if (state.doneTasks.length === 0) return state
          const activeDeadlines = new Set<string>()
          for (const ob of state.obligations) {
            if (!ob.enabled) continue
            const dl = resolveObligationDeadline(ob, todayStr)
            if (dl) activeDeadlines.add(dl)
          }
          const freshDone = state.doneTasks.filter((key) => {
            const lastColon = key.lastIndexOf(':')
            if (lastColon === -1) return false
            const suffix = key.slice(lastColon + 1)
            return activeDeadlines.has(suffix)
          })
          return freshDone.length !== state.doneTasks.length ? { doneTasks: freshDone } : state
        }),
    }),
    {
      name: 'to-live-obligations',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version < 3) {
          // v2 → v3: add doneTasks array (obligation done keys move here from scheduler)
          persistedState.doneTasks = persistedState.doneTasks ?? []
        }
        return persistedState
      },
    }
  )
)
