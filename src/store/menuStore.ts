import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Ingredient, PrePrepItem, Recipe, WeekMenuPlan, MealGroup } from '../types/menu'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function createEmptyWeekPlan(): WeekMenuPlan {
  const plan: WeekMenuPlan = {}
  DAY_NAMES.forEach((dayName, dayIndex) => {
    plan[dayIndex] = {
      dayIndex,
      dayName,
      breakfast: {},
      lunch: {},
      dinner: {},
      snack: {},
    }
  })
  return plan
}

interface MenuStore {
  ingredients: Ingredient[]
  prePrepItems: PrePrepItem[]
  recipes: Recipe[]
  weekPlan: WeekMenuPlan

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
  setSlotRecipe: (dayIndex: number, mealGroup: MealGroup, recipeId?: string, customName?: string) => void
  randomizeWeekPlan: () => void
  clearWeekPlan: () => void
}

export const useMenuStore = create<MenuStore>()(
  persist(
    (set, get) => ({
      ingredients: [],
      prePrepItems: [],
      recipes: [],
      weekPlan: createEmptyWeekPlan(),

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

      setSlotRecipe: (dayIndex, mealGroup, recipeId, customName) =>
        set((state) => {
          const currentPlan = state.weekPlan[dayIndex] || {
            dayIndex,
            dayName: DAY_NAMES[dayIndex] || `Day ${dayIndex + 1}`,
            breakfast: {},
            lunch: {},
            dinner: {},
            snack: {},
          }
          return {
            weekPlan: {
              ...state.weekPlan,
              [dayIndex]: {
                ...currentPlan,
                [mealGroup]: { recipeId, customName },
              },
            },
          }
        }),

      randomizeWeekPlan: () => {
        const { recipes } = get()
        if (recipes.length === 0) return

        const getRecipesForGroup = (group: MealGroup) => recipes.filter((r) => r.mealGroup === group)

        const newPlan = createEmptyWeekPlan()
        const groups: MealGroup[] = ['breakfast', 'lunch', 'dinner', 'snack']

        DAY_NAMES.forEach((_dayName, dayIndex) => {
          groups.forEach((group) => {
            const available = getRecipesForGroup(group)
            const pool = available.length > 0 ? available : recipes // Fallback to all if group pool empty
            const randomIndex = Math.floor(Math.random() * pool.length)
            const selected = pool[randomIndex]
            if (selected) {
              newPlan[dayIndex][group] = { recipeId: selected.id }
            }
          })
        })

        set({ weekPlan: newPlan })
      },

      clearWeekPlan: () => set({ weekPlan: createEmptyWeekPlan() }),
    }),
    {
      name: 'to-live-menu',
    }
  )
)
