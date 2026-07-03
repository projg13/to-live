import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Obligation } from '../types/obligation'

interface ObligationStore {
  obligations: Obligation[]
  addObligation: (obligation: Obligation) => void
  updateObligation: (id: string, updates: Partial<Obligation>) => void
  deleteObligation: (id: string) => void
  toggleEnabled: (id: string) => void
}

export const useObligationStore = create<ObligationStore>()(
  persist(
    (set) => ({
      obligations: [],
      addObligation: (obligation) =>
        set((state) => ({ obligations: [...state.obligations, obligation] })),
      updateObligation: (id, updates) =>
        set((state) => ({ obligations: state.obligations.map((o) => (o.id === id ? { ...o, ...updates } : o)) })),
      deleteObligation: (id) =>
        set((state) => ({ obligations: state.obligations.filter((o) => o.id !== id) })),
      toggleEnabled: (id) =>
        set((state) => ({ obligations: state.obligations.map((o) => o.id === id ? { ...o, enabled: !o.enabled } : o) })),
    }),
    { name: 'to-live-obligations' }
  )
)
