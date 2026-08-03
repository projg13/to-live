import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Ingredient, PrePrepItem, Recipe, WeekMenuPlan, EatingSlot, DayMealSlot } from '../types/menu'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const DEFAULT_EATING_SLOTS: EatingSlot[] = [
  { id: 'breakfast', name: 'Breakfast', scheduledTime: '08:00', icon: '🌅' },
  { id: 'lunch', name: 'Lunch', scheduledTime: '13:00', icon: '☀️' },
  { id: 'snack', name: 'Snacks', scheduledTime: '17:00', icon: '🍿' },
  { id: 'dinner', name: 'Dinner', scheduledTime: '20:00', icon: '🌙' },
]

function createEmptyWeekPlan(slotsList: EatingSlot[] = DEFAULT_EATING_SLOTS): WeekMenuPlan {
  const plan: WeekMenuPlan = {}
  DAY_NAMES.forEach((dayName, dayIndex) => {
    const slotsMap: Record<string, DayMealSlot> = {}
    slotsList.forEach((slot) => {
      slotsMap[slot.id] = {}
    })
    plan[dayIndex] = {
      dayIndex,
      dayName,
      slots: slotsMap,
      breakfast: slotsMap['breakfast'],
      lunch: slotsMap['lunch'],
      dinner: slotsMap['dinner'],
      snack: slotsMap['snack'],
    }
  })
  return plan
}

interface MenuStore {
  ingredients: Ingredient[]
  prePrepItems: PrePrepItem[]
  recipes: Recipe[]
  eatingSlots: EatingSlot[]
  weekPlan: WeekMenuPlan

  // Eating Slots CRUD
  addEatingSlot: (slot: EatingSlot) => void
  updateEatingSlot: (id: string, updates: Partial<EatingSlot>) => void
  deleteEatingSlot: (id: string) => void
  reorderEatingSlots: (newSlots: EatingSlot[]) => void

  // Ingredients CRUD
  addIngredient: (ingredient: Ingredient) => void
  updateIngredient: (id: string, updates: Partial<Ingredient>) => void
  deleteIngredient: (id: string) => void

  // Pre-Prep Items CRUD
  addPrePrepItem: (item: PrePrepItem) => void
  updatePrePrepItem: (id: string, updates: Partial<PrePrepItem>) => void
  deletePrePrepItem: (id: string) => void

  // Recipes CRUD
  addRecipe: (recipe: Recipe) => void
  updateRecipe: (id: string, updates: Partial<Recipe>) => void
  deleteRecipe: (id: string) => void

  // Week Plan Actions
  setSlotRecipe: (dayIndex: number, slotId: string, recipeId?: string, customName?: string) => void
  randomizeWeekPlan: () => void
  clearWeekPlan: () => void
}

export const useMenuStore = create<MenuStore>()(
  persist(
    (set, get) => ({
      ingredients: [],
      prePrepItems: [],
      recipes: [],
      eatingSlots: DEFAULT_EATING_SLOTS,
      weekPlan: createEmptyWeekPlan(),

      addEatingSlot: (slot) =>
        set((state) => ({ eatingSlots: [...state.eatingSlots, slot] })),

      updateEatingSlot: (id, updates) =>
        set((state) => ({
          eatingSlots: state.eatingSlots.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      deleteEatingSlot: (id) =>
        set((state) => ({
          eatingSlots: state.eatingSlots.filter((s) => s.id !== id),
        })),

      reorderEatingSlots: (newSlots) => set({ eatingSlots: newSlots }),

      addIngredient: (ingredient) =>
        set((state) => ({ ingredients: [...state.ingredients, ingredient] })),

      updateIngredient: (id, updates) =>
        set((state) => ({
          ingredients: state.ingredients.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        })),

      deleteIngredient: (id) =>
        set((state) => ({
          ingredients: state.ingredients.filter((item) => item.id !== id),
        })),

      addPrePrepItem: (item) =>
        set((state) => ({ prePrepItems: [...state.prePrepItems, item] })),

      updatePrePrepItem: (id, updates) =>
        set((state) => ({
          prePrepItems: state.prePrepItems.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        })),

      deletePrePrepItem: (id) =>
        set((state) => ({
          prePrepItems: state.prePrepItems.filter((item) => item.id !== id),
        })),

      addRecipe: (recipe) =>
        set((state) => ({ recipes: [...state.recipes, recipe] })),

      updateRecipe: (id, updates) =>
        set((state) => ({
          recipes: state.recipes.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        })),

      deleteRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((item) => item.id !== id),
        })),

      setSlotRecipe: (dayIndex, slotId, recipeId, customName) =>
        set((state) => {
          const currentDay = state.weekPlan[dayIndex] || {
            dayIndex,
            dayName: DAY_NAMES[dayIndex] || `Day ${dayIndex + 1}`,
            slots: {},
          }

          const updatedSlots = {
            ...(currentDay.slots || {}),
            [slotId]: { recipeId, customName },
          }

          // Backward compatibility mappings
          if (slotId === 'breakfast') currentDay.breakfast = updatedSlots['breakfast']
          if (slotId === 'lunch') currentDay.lunch = updatedSlots['lunch']
          if (slotId === 'dinner') currentDay.dinner = updatedSlots['dinner']
          if (slotId === 'snack') currentDay.snack = updatedSlots['snack']

          return {
            weekPlan: {
              ...state.weekPlan,
              [dayIndex]: {
                ...currentDay,
                slots: updatedSlots,
                [slotId]: { recipeId, customName },
              },
            },
          }
        }),

      randomizeWeekPlan: () => {
        const { recipes, eatingSlots } = get()
        if (recipes.length === 0) return

        const activeSlots = eatingSlots.length > 0 ? eatingSlots : DEFAULT_EATING_SLOTS
        const newPlan = createEmptyWeekPlan(activeSlots)

        DAY_NAMES.forEach((_dayName, dayIndex) => {
          activeSlots.forEach((slot) => {
            const available = recipes.filter((r) => r.mealGroup === slot.id)
            const pool = available.length > 0 ? available : recipes
            const randomIndex = Math.floor(Math.random() * pool.length)
            const selected = pool[randomIndex]
            if (selected) {
              if (!newPlan[dayIndex].slots) newPlan[dayIndex].slots = {}
              newPlan[dayIndex].slots[slot.id] = { recipeId: selected.id }
              if (slot.id === 'breakfast') newPlan[dayIndex].breakfast = { recipeId: selected.id }
              if (slot.id === 'lunch') newPlan[dayIndex].lunch = { recipeId: selected.id }
              if (slot.id === 'dinner') newPlan[dayIndex].dinner = { recipeId: selected.id }
              if (slot.id === 'snack') newPlan[dayIndex].snack = { recipeId: selected.id }
            }
          })
        })

        set({ weekPlan: newPlan })
      },

      clearWeekPlan: () => {
        const { eatingSlots } = get()
        set({ weekPlan: createEmptyWeekPlan(eatingSlots) })
      },
    }),
    {
      name: 'to-live-menu',
      migrate: (persistedState: any) => {
        if (!persistedState) return persistedState
        // Ensure eatingSlots is present
        if (!persistedState.eatingSlots || persistedState.eatingSlots.length === 0) {
          persistedState.eatingSlots = DEFAULT_EATING_SLOTS
        }
        // Ensure slots record exists on weekPlan days
        if (persistedState.weekPlan) {
          Object.values(persistedState.weekPlan).forEach((dayPlan: any) => {
            if (!dayPlan.slots) {
              dayPlan.slots = {
                breakfast: dayPlan.breakfast || {},
                lunch: dayPlan.lunch || {},
                dinner: dayPlan.dinner || {},
                snack: dayPlan.snack || {},
              }
            }
          })
        }
        return persistedState
      },
    }
  )
)
