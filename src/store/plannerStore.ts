import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayPlan, WeekPlan, CalendarEvent, EventTemplate } from '../types/planner'

interface PlannerStore {
  dayPlans: DayPlan[]
  weekPlan: WeekPlan
  calendarEvents: CalendarEvent[]
  eventTemplates: EventTemplate[]
  addDayPlan: (plan: DayPlan) => void
  updateDayPlan: (id: string, updates: Partial<DayPlan>) => void
  deleteDayPlan: (id: string) => void
  setWeekDay: (day: number, dayPlanId: string) => void
  addEvent: (event: CalendarEvent) => void
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  addEventTemplate: (tpl: EventTemplate) => void
  updateEventTemplate: (id: string, updates: Partial<EventTemplate>) => void
  deleteEventTemplate: (id: string) => void
  getDayPlanForDate: (date: string) => DayPlan | undefined
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      dayPlans: [],
      weekPlan: { days: {} },
      calendarEvents: [],
      eventTemplates: [],

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
      addEventTemplate: (tpl) =>
        set((state) => ({ eventTemplates: [...state.eventTemplates, tpl] })),
      updateEventTemplate: (id, updates) =>
        set((state) => ({ eventTemplates: state.eventTemplates.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
      deleteEventTemplate: (id) =>
        set((state) => ({ eventTemplates: state.eventTemplates.filter((t) => t.id !== id) })),
      getDayPlanForDate: (date) => {
        const state = get()
        const event = state.calendarEvents.find((e) => {
          if (e.dayPlanOverride || e.dayPlanOverrides) {
            if (e.date === date) return true
            if (e.endDate && date >= e.date && date <= e.endDate) return true
          }
          return false
        })
        if (event) {
          const pieceId = event.dayPlanOverrides?.[date]
          if (pieceId) return state.dayPlans.find((p) => p.id === pieceId)
          if (event.dayPlanOverride) return state.dayPlans.find((p) => p.id === event.dayPlanOverride)
        }
        const dayOfWeek = new Date(date).getDay()
        const planId = state.weekPlan.days[dayOfWeek]
        return state.dayPlans.find((p) => p.id === planId)
      },
    }),
    { name: 'to-live-planner', version: 2 }
  )
)
