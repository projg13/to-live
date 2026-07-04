import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RecoveryPlan } from '../types/recovery'

interface RecoveryStore {
  plans: RecoveryPlan[]
  addPlan: (plan: RecoveryPlan) => void
  updatePlan: (id: string, updates: Partial<RecoveryPlan>) => void
  deletePlan: (id: string) => void
  trigger: (id: string) => void
  resolve: (id: string) => void
}

export const useRecoveryStore = create<RecoveryStore>()(
  persist(
    (set) => ({
      plans: [],
      addPlan: (plan) =>
        set((state) => ({ plans: [...state.plans, plan] })),
      updatePlan: (id, updates) =>
        set((state) => ({ plans: state.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
      deletePlan: (id) =>
        set((state) => ({ plans: state.plans.filter((p) => p.id !== id) })),
      trigger: (id) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === id ? { ...p, triggered: true, triggeredAt: new Date().toISOString().split('T')[0] } : p
          ),
        })),
      resolve: (id) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === id ? { ...p, triggered: false, triggeredAt: undefined } : p
          ),
        })),
    }),
    { name: 'to-live-recovery', version: 2 }
  )
)
