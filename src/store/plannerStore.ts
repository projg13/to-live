import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayPlan, WeekPlan, CalendarEvent } from '../types/planner'

interface PlannerStore {
  dayPlans: DayPlan[]
  weekPlan: WeekPlan
  calendarEvents: CalendarEvent[]
  addDayPlan: (plan: DayPlan) => void
  updateDayPlan: (id: string, updates: Partial<DayPlan>) => void
  deleteDayPlan: (id: string) => void
  setWeekDay: (day: number, dayPlanId: string) => void
  addEvent: (event: CalendarEvent) => void
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  getDayPlanForDate: (date: string) => DayPlan | undefined
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      dayPlans: [
        {
          id: 'dp-gym-day',
          name: 'Gym Day (Mon/Wed)',
          anchorIds: ['anchor-wake', 'anchor-work-start', 'anchor-work-end', 'anchor-sleep'],
          routineIds: ['routine-gym-day'],
        },
        {
          id: 'dp-study-day',
          name: 'Study Day (Tue/Thu)',
          anchorIds: ['anchor-wake', 'anchor-work-start', 'anchor-work-end', 'anchor-sleep'],
          routineIds: ['routine-study-day'],
        },
        {
          id: 'dp-friday',
          name: 'Friday',
          anchorIds: ['anchor-wake', 'anchor-work-start', 'anchor-game-start', 'anchor-game-end', 'anchor-work-end', 'anchor-sleep'],
          routineIds: ['routine-friday'],
        },
        {
          id: 'dp-saturday',
          name: 'Saturday',
          anchorIds: ['anchor-wake', 'anchor-sleep'],
          routineIds: ['routine-saturday'],
        },
        {
          id: 'dp-sunday',
          name: 'Sunday',
          anchorIds: ['anchor-wake', 'anchor-sleep'],
          routineIds: ['routine-sunday'],
        },
      ],
      weekPlan: {
        days: {
          0: 'dp-sunday',
          1: 'dp-gym-day',
          2: 'dp-study-day',
          3: 'dp-gym-day',
          4: 'dp-study-day',
          5: 'dp-friday',
          6: 'dp-saturday',
        },
      },
      calendarEvents: [],

      addDayPlan: (plan) =>
        set((state) => ({ dayPlans: [...state.dayPlans, plan] })),
      updateDayPlan: (id, updates) =>
        set((state) => ({ dayPlans: state.dayPlans.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
      deleteDayPlan: (id) =>
        set((state) => ({ dayPlans: state.dayPlans.filter((p) => p.id !== id) })),
      setWeekDay: (day, dayPlanId) =>
        set((state) => ({ weekPlan: { days: { ...state.weekPlan.days, [day]: dayPlanId } } })),
      addEvent: (event) =>
        set((state) => ({ calendarEvents: [...state.calendarEvents, event] })),
      updateEvent: (id, updates) =>
        set((state) => ({ calendarEvents: state.calendarEvents.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
      deleteEvent: (id) =>
        set((state) => ({ calendarEvents: state.calendarEvents.filter((e) => e.id !== id) })),
      getDayPlanForDate: (date) => {
        const state = get()
        const event = state.calendarEvents.find((e) => {
          if (e.dayPlanOverride) {
            if (e.date === date) return true
            if (e.endDate && date >= e.date && date <= e.endDate) return true
          }
          return false
        })
        if (event?.dayPlanOverride) return state.dayPlans.find((p) => p.id === event.dayPlanOverride)
        const dayOfWeek = new Date(date).getDay()
        const planId = state.weekPlan.days[dayOfWeek]
        return state.dayPlans.find((p) => p.id === planId)
      },
    }),
    { name: 'to-live-planner' }
  )
)
