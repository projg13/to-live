import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Ingredient, PrePrepItem, Recipe, WeekMenuPlan, EatingSlot, DayMealSlot } from '../types/menu'
import { getSlotRecipeIds } from '../types/menu'

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
      slotsMap[slot.id] = { recipeIds: [] }
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

  // Week Plan Actions (Multi-Recipe Slot Support)
  setSlotRecipe: (dayIndex: number, slotId: string, recipeId?: string, customName?: string) => void
  addSlotRecipe: (dayIndex: number, slotId: string, recipeId: string) => void
  removeSlotRecipe: (dayIndex: number, slotId: string, recipeId: string) => void
  setSlotRecipes: (dayIndex: number, slotId: string, recipeIds: string[]) => void
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

          const existingSlot = currentDay.slots?.[slotId] || (currentDay as any)[slotId] || {}
          const newRecipeIds = recipeId ? [recipeId] : []

          const updatedSlot: DayMealSlot = {
            ...existingSlot,
            recipeId,
            recipeIds: newRecipeIds,
            customName,
          }

          const updatedSlots = {
            ...(currentDay.slots || {}),
            [slotId]: updatedSlot,
          }

          if (slotId === 'breakfast') currentDay.breakfast = updatedSlot
          if (slotId === 'lunch') currentDay.lunch = updatedSlot
          if (slotId === 'dinner') currentDay.dinner = updatedSlot
          if (slotId === 'snack') currentDay.snack = updatedSlot

          return {
            weekPlan: {
              ...state.weekPlan,
              [dayIndex]: {
                ...currentDay,
                slots: updatedSlots,
                [slotId]: updatedSlot,
              },
            },
          }
        }),

      addSlotRecipe: (dayIndex, slotId, recipeId) =>
        set((state) => {
          const currentDay = state.weekPlan[dayIndex] || {
            dayIndex,
            dayName: DAY_NAMES[dayIndex] || `Day ${dayIndex + 1}`,
            slots: {},
          }

          const existingSlot = currentDay.slots?.[slotId] || (currentDay as any)[slotId] || {}
          const currentRecipeIds = getSlotRecipeIds(existingSlot)
          if (currentRecipeIds.includes(recipeId)) return state

          const newRecipeIds = [...currentRecipeIds, recipeId]
          const updatedSlot: DayMealSlot = {
            ...existingSlot,
            recipeId: newRecipeIds[0],
            recipeIds: newRecipeIds,
          }

          const updatedSlots = {
            ...(currentDay.slots || {}),
            [slotId]: updatedSlot,
          }

          return {
            weekPlan: {
              ...state.weekPlan,
              [dayIndex]: {
                ...currentDay,
                slots: updatedSlots,
                [slotId]: updatedSlot,
              },
            },
          }
        }),

      removeSlotRecipe: (dayIndex, slotId, recipeId) =>
        set((state) => {
          const currentDay = state.weekPlan[dayIndex]
          if (!currentDay) return state

          const existingSlot = currentDay.slots?.[slotId] || (currentDay as any)[slotId] || {}
          const currentRecipeIds = getSlotRecipeIds(existingSlot)
          const newRecipeIds = currentRecipeIds.filter((id) => id !== recipeId)

          const updatedSlot: DayMealSlot = {
            ...existingSlot,
            recipeId: newRecipeIds[0],
            recipeIds: newRecipeIds,
          }

          const updatedSlots = {
            ...(currentDay.slots || {}),
            [slotId]: updatedSlot,
          }

          return {
            weekPlan: {
              ...state.weekPlan,
              [dayIndex]: {
                ...currentDay,
                slots: updatedSlots,
                [slotId]: updatedSlot,
              },
            },
          }
        }),

      setSlotRecipes: (dayIndex, slotId, recipeIds) =>
        set((state) => {
          const currentDay = state.weekPlan[dayIndex] || {
            dayIndex,
            dayName: DAY_NAMES[dayIndex] || `Day ${dayIndex + 1}`,
            slots: {},
          }

          const existingSlot = currentDay.slots?.[slotId] || (currentDay as any)[slotId] || {}
          const updatedSlot: DayMealSlot = {
            ...existingSlot,
            recipeId: recipeIds[0],
            recipeIds: recipeIds,
          }

          const updatedSlots = {
            ...(currentDay.slots || {}),
            [slotId]: updatedSlot,
          }

          return {
            weekPlan: {
              ...state.weekPlan,
              [dayIndex]: {
                ...currentDay,
                slots: updatedSlots,
                [slotId]: updatedSlot,
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
              const slotVal: DayMealSlot = { recipeId: selected.id, recipeIds: [selected.id] }
              newPlan[dayIndex].slots[slot.id] = slotVal
              if (slot.id === 'breakfast') newPlan[dayIndex].breakfast = slotVal
              if (slot.id === 'lunch') newPlan[dayIndex].lunch = slotVal
              if (slot.id === 'dinner') newPlan[dayIndex].dinner = slotVal
              if (slot.id === 'snack') newPlan[dayIndex].snack = slotVal
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
        if (!persistedState.eatingSlots || persistedState.eatingSlots.length === 0) {
          persistedState.eatingSlots = DEFAULT_EATING_SLOTS
        }
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
            // Ensure recipeIds array exists on all slots
            Object.values(dayPlan.slots).forEach((s: any) => {
              if (s && !s.recipeIds && s.recipeId) {
                s.recipeIds = [s.recipeId]
              }
            })
          });
        }
        return persistedState
      },
    }
  )
)
