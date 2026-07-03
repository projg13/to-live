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
      obligations: [
        // Example: Passport application
        {
          id: 'oblig-passport',
          name: 'Passport Application',
          tasks: [
            { taskId: 'task-email-replies', order: 0 },  // placeholder — real tasks TBD
          ],
          deadline: '2026-08-15',
          weightBrackets: [
            // Last day: all day, max priority
            { maxDaysRemaining: 1, timeCurve: [
              { time: 0, value: 500 },
              { time: 1439, value: 500 },
            ]},
            // Last 7 days: 10 AM to 7 PM, high weight
            { maxDaysRemaining: 7, timeCurve: [
              { time: 0, value: 0 },
              { time: 600, value: 100 },   // 10 AM
              { time: 1140, value: 100 },  // 7 PM
              { time: 1200, value: 0 },
            ]},
            // 30 days out: only 5-7 PM, low weight
            { maxDaysRemaining: 30, timeCurve: [
              { time: 0, value: 0 },
              { time: 1020, value: 0 },    // 5 PM
              { time: 1020, value: 30 },
              { time: 1260, value: 30 },   // 7 PM
              { time: 1260, value: 0 },
            ]},
          ],
          recurrence: 'one-time',
          enabled: true,
        },
      ],
      addObligation: (obligation) =>
        set((state) => ({ obligations: [...state.obligations, obligation] })),
      updateObligation: (id, updates) =>
        set((state) => ({
          obligations: state.obligations.map((o) => (o.id === id ? { ...o, ...updates } : o)),
        })),
      deleteObligation: (id) =>
        set((state) => ({ obligations: state.obligations.filter((o) => o.id !== id) })),
      toggleEnabled: (id) =>
        set((state) => ({
          obligations: state.obligations.map((o) =>
            o.id === id ? { ...o, enabled: !o.enabled } : o
          ),
        })),
    }),
    { name: 'to-live-obligations' }
  )
)
