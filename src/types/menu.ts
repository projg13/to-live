export type MealGroup = 'breakfast' | 'lunch' | 'dinner' | 'snack' | string

// Configurable & Adjustable Eating Slot (e.g. Breakfast, Post-Workout, Lunch, Dinner, Evening Tea)
export interface EatingSlot {
  id: string              // Unique slot key (e.g. 'breakfast', 'post_workout', 'lunch', 'dinner')
  name: string            // Display name (e.g. "Early Morning Tea", "Breakfast", "Post-Workout Shake")
  scheduledTime?: string  // Target HH:MM schedule time (e.g. "08:00", "13:30", "20:00")
  icon?: string           // Visual emoji / icon (e.g. "🌅", "⚡", "☀️", "🍿", "🌙")
}

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
  mealGroup: MealGroup       // 'breakfast' | 'lunch' | 'dinner' | 'snack' or custom slot ID
  ingredients: RecipeIngredient[]
  prePrepItems: RecipePrePrep[]
  notes?: string             // Instructions / recipe notes
  prepTimeMinutes?: number
  calories?: number          // Calorie count (kcal per serving)
}

// Meal slot assignment on a specific day
export interface DayMealSlot {
  recipeId?: string
  customName?: string
}

// Single day menu plan across eating slots
export interface DayMenuPlan {
  dayIndex: number           // 0 = Monday, 1 = Tuesday ... 6 = Sunday
  dayName: string            // "Monday", "Tuesday", etc.
  slots: Record<string, DayMealSlot> // Key: slotId -> DayMealSlot

  // Backward compatibility fields
  breakfast?: DayMealSlot
  lunch?: DayMealSlot
  dinner?: DayMealSlot
  snack?: DayMealSlot
}

// Weekly Menu Plan (Key: 0..6)
export type WeekMenuPlan = Record<number, DayMenuPlan>
