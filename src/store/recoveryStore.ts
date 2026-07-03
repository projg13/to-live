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
      plans: [
        {
          id: 'recovery-big-laundry',
          name: 'Big Laundry',
          taskIds: ['task-laundry-load'],
          blockIds: [],
          triggerType: 'auto',
          autoCondition: { taskId: 'task-laundry-load', consecutiveMisses: 3 },
          baseTimeCurve: [
            { time: 0, value: 0 },
            { time: 480, value: 80 },   // 8 AM
            { time: 1080, value: 80 },  // 6 PM
            { time: 1200, value: 0 },
          ],
          growthRate: 0.5,
          saturationLimit: 400,
          triggered: false,
        },
        {
          id: 'recovery-grocery',
          name: 'Grocery Run',
          taskIds: [],
          blockIds: [],
          triggerType: 'manual',
          baseTimeCurve: [
            { time: 0, value: 0 },
            { time: 600, value: 100 },  // 10 AM
            { time: 1140, value: 100 }, // 7 PM
            { time: 1200, value: 0 },
          ],
          growthRate: 0.3,
          saturationLimit: 300,
          triggered: false,
        },
        {
          id: 'recovery-sleep',
          name: 'Sleep Recovery',
          taskIds: [],
          blockIds: [],
          triggerType: 'manual',
          baseTimeCurve: [
            { time: 1200, value: 50 },  // 8 PM
            { time: 1320, value: 200 }, // 10 PM
            { time: 1439, value: 300 },
          ],
          growthRate: 1.0,
          saturationLimit: 500,
          triggered: false,
        },
      ],
      addPlan: (plan) =>
        set((state) => ({ plans: [...state.plans, plan] })),
      updatePlan: (id, updates) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
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
    { name: 'to-live-recovery' }
  )
)
