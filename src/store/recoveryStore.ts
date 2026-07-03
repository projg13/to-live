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
        // Full recovery — triggered manually when things pile up
        {
          id: 'recovery-full',
          name: 'Full Recovery',
          taskIds: ['t-garbage', 't-laundry-wash', 't-kitchen-clean', 't-laundry-fold', 't-bath', 't-get-ready', 't-groceries-sat', 't-laundry-hang'],
          blockIds: [],
          triggerType: 'manual' as const,
          baseTimeCurve: [
            { time: 360, value: 100 },  // 6 AM
            { time: 1260, value: 100 }, // 9 PM
            { time: 1320, value: 0 },
          ],
          growthRate: 0.3,
          saturationLimit: 300,
          triggered: false,
        },
        // Laundry recovery — auto after 3 consecutive skips
        {
          id: 'recovery-laundry',
          name: 'Laundry Recovery',
          taskIds: ['t-laundry-wash', 't-laundry-fold', 't-laundry-prep', 't-laundry-hang'],
          blockIds: [],
          triggerType: 'auto' as const,
          autoCondition: { taskId: 't-laundry-wash', consecutiveMisses: 3 },
          baseTimeCurve: [
            { time: 360, value: 80 },
            { time: 1200, value: 80 },
            { time: 1260, value: 0 },
          ],
          growthRate: 0.5,
          saturationLimit: 400,
          triggered: false,
        },
        // Garbage dump — manual
        {
          id: 'recovery-garbage',
          name: 'Garbage Dump',
          taskIds: ['t-garbage'],
          blockIds: [],
          triggerType: 'manual' as const,
          baseTimeCurve: [
            { time: 360, value: 70 },
            { time: 540, value: 100 },
            { time: 1080, value: 100 },
            { time: 1200, value: 0 },
          ],
          growthRate: 1.0,
          saturationLimit: 500,
          triggered: false,
        },
        // Groceries — manual
        {
          id: 'recovery-groceries',
          name: 'Groceries',
          taskIds: ['t-groceries-sat'],
          blockIds: [],
          triggerType: 'manual' as const,
          baseTimeCurve: [
            { time: 480, value: 80 },
            { time: 1080, value: 80 },
            { time: 1200, value: 0 },
          ],
          growthRate: 0.5,
          saturationLimit: 300,
          triggered: false,
        },
        // Water can — manual
        {
          id: 'recovery-water',
          name: 'Water Can',
          taskIds: ['t-water-can'],
          blockIds: [],
          triggerType: 'manual' as const,
          baseTimeCurve: [
            { time: 360, value: 90 },
            { time: 1260, value: 90 },
            { time: 1320, value: 0 },
          ],
          growthRate: 1.5,
          saturationLimit: 500,
          triggered: false,
        },
      ],
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
    { name: 'to-live-recovery' }
  )
)
