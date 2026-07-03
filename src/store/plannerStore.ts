import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayPlan, WeekPlan, CalendarEvent } from '../types/planner'

interface PlannerStore {
  dayPlans: DayPlan[]
  weekPlan: WeekPlan
  calendarEvents: CalendarEvent[]

  // Day Plans
  addDayPlan: (plan: DayPlan) => void
  updateDayPlan: (id: string, updates: Partial<DayPlan>) => void
  deleteDayPlan: (id: string) => void

  // Week Plan
  setWeekDay: (day: number, dayPlanId: string) => void

  // Calendar Events
  addEvent: (event: CalendarEvent) => void
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void

  // Resolvers
  getDayPlanForDate: (date: string) => DayPlan | undefined
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      dayPlans: [
        {
          id: 'dp-bangalore-work',
          name: 'Bangalore Work Day',
          anchorIds: ['anchor-wake', 'anchor-work-start', 'anchor-work-end', 'anchor-sleep'],
          routineIds: ['routine-morning', 'routine-evening-cook'],
        },
        {
          id: 'dp-hometown',
          name: 'Hometown Day',
          anchorIds: ['anchor-wake', 'anchor-work-start', 'anchor-work-end', 'anchor-sleep'],
          routineIds: ['routine-morning'],
        },
      ],
      weekPlan: {
        days: {
          0: 'dp-hometown',        // Sunday
          1: 'dp-bangalore-work',  // Monday
          2: 'dp-bangalore-work',
          3: 'dp-bangalore-work',
          4: 'dp-bangalore-work',
          5: 'dp-bangalore-work',  // Friday
          6: 'dp-hometown',        // Saturday
        },
      },
      calendarEvents: [
        {
          id: 'event-wedding',
          name: 'Cousin wedding in Chennai',
          date: '2026-07-12',
          endDate: '2026-07-13',
          taskIds: [],
          suspendRegular: true,
        },
        {
          id: 'event-dinner',
          name: 'Team dinner',
          date: '2026-07-08',
          taskIds: [],
          suspendRegular: false,
          dayPlanOverride: 'dp-hometown',
        },
      ],

      // Day Plans
      addDayPlan: (plan) =>
        set((state) => ({ dayPlans: [...state.dayPlans, plan] })),
      updateDayPlan: (id, updates) =>
        set((state) => ({
          dayPlans: state.dayPlans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deleteDayPlan: (id) =>
        set((state) => ({ dayPlans: state.dayPlans.filter((p) => p.id !== id) })),

      // Week Plan
      setWeekDay: (day, dayPlanId) =>
        set((state) => ({
          weekPlan: { days: { ...state.weekPlan.days, [day]: dayPlanId } },
        })),

      // Calendar Events
      addEvent: (event) =>
        set((state) => ({ calendarEvents: [...state.calendarEvents, event] })),
      updateEvent: (id, updates) =>
        set((state) => ({
          calendarEvents: state.calendarEvents.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteEvent: (id) =>
        set((state) => ({ calendarEvents: state.calendarEvents.filter((e) => e.id !== id) })),

      // Resolve: which day plan applies for a given date
      getDayPlanForDate: (date) => {
        const state = get()
        // Check calendar events for override
        const event = state.calendarEvents.find((e) => {
          if (e.dayPlanOverride) {
            if (e.date === date) return true
            if (e.endDate && date >= e.date && date <= e.endDate) return true
          }
          return false
        })
        if (event?.dayPlanOverride) {
          return state.dayPlans.find((p) => p.id === event.dayPlanOverride)
        }

        // Fall back to week plan
        const dayOfWeek = new Date(date).getDay()
        const planId = state.weekPlan.days[dayOfWeek]
        return state.dayPlans.find((p) => p.id === planId)
      },
    }),
    { name: 'to-live-planner' }
  )
)
