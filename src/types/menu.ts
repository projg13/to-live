export type MealGroup = 'breakfast' | 'lunch' | 'dinner' | 'snack'

// Ingredient Object
export interface Ingredient {
  id: string
  name: string
  category: string           // e.g. Produce, Dairy, Spices, Pantry, Protein, Bakery, Beverage
  unit: string               // e.g. grams, kg, tbsp, tsp, pcs, ml, cups, liters
  imageUrl?: string          // Image URL or base64 for picture reference
  notes?: string             // Inventory & stock notes
}

// Pre-Prep Item Object (e.g. Chopped Onions, Boiled Potatoes, Ginger-Garlic Paste)
export interface PrePrepItem {
  id: string
  name: string
  unit: string               // e.g. grams, pcs, tbsp, cups, batches
  notes?: string             // Storage instructions, shelf life notes
}

// Recipe Ingredient Reference
export interface RecipeIngredient {
  ingredientId: string
  quantity: number
}

// Recipe Pre-Prep Reference
export interface RecipePrePrep {
  prePrepId: string
  quantity: number
}

// Recipe Object
export interface Recipe {
  id: string
  title: string
  mealGroup: MealGroup       // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ingredients: RecipeIngredient[]
  prePrepItems: RecipePrePrep[]
  notes?: string             // Instructions / recipe notes
  prepTimeMinutes?: number
}

// Meal slot on a specific day
export interface DayMealSlot {
  recipeId?: string
  customName?: string
}

// Single day menu plan across 4 meal groups
export interface DayMenuPlan {
  dayIndex: number           // 0 = Monday, 1 = Tuesday ... 6 = Sunday
  dayName: string            // "Monday", "Tuesday", etc.
  breakfast: DayMealSlot
  lunch: DayMealSlot
  dinner: DayMealSlot
  snack: DayMealSlot
}

// Weekly Menu Plan (Key: 0..6)
export type WeekMenuPlan = Record<number, DayMenuPlan>
