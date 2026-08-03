import { useState } from 'react'
import { useMenuStore } from '../store/menuStore'
import type { Ingredient, PrePrepItem, Recipe, MealGroup } from '../types/menu'

// Icons
const PlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const ShuffleIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16M4 20h16M16 4l4 4-4 4M8 20l-4-4 4-4" />
  </svg>
)

export default function MenuPanel() {
  const [subTab, setSubTab] = useState<'planner' | 'recipes' | 'ingredients' | 'preprep'>('planner')

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-black tracking-wide text-slate-100 flex items-center gap-2">
            🥗 Menu & Recipe Manager
          </h2>
          <p className="text-xs text-slate-400">
            Plan weekly meals, catalog recipes, manage ingredient inventories & club pre-prep requirements.
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850">
          {[
            { id: 'planner', label: '📅 Weekly Planner' },
            { id: 'recipes', label: '🍲 Recipes Catalog' },
            { id: 'ingredients', label: '🥬 Ingredients' },
            { id: 'preprep', label: '🔪 Pre-Prep Items' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === t.id
                  ? 'bg-cyan-500 text-slate-955 shadow-md shadow-cyan-950/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render Sub View */}
      {subTab === 'planner' && <WeeklyPlannerView />}
      {subTab === 'recipes' && <RecipesView />}
      {subTab === 'ingredients' && <IngredientsView />}
      {subTab === 'preprep' && <PrePrepView />}
    </div>
  )
}

/* =========================================================================
   1. WEEKLY PLANNER VIEW & AGGREGATOR
   ========================================================================= */
function WeeklyPlannerView() {
  const { weekPlan, recipes, ingredients, prePrepItems, setSlotRecipe, randomizeWeekPlan, clearWeekPlan } =
    useMenuStore()

  // Calculate aggregated Grocery / Raw Ingredients requirement for the week
  const getAggregatedIngredients = () => {
    const totals: Record<string, number> = {}
    Object.values(weekPlan).forEach((dayPlan) => {
      const slots: MealGroup[] = ['breakfast', 'lunch', 'dinner', 'snack']
      slots.forEach((slotKey) => {
        const slot = dayPlan[slotKey]
        if (slot?.recipeId) {
          const recipe = recipes.find((r) => r.id === slot.recipeId)
          if (recipe) {
            recipe.ingredients.forEach((ing) => {
              totals[ing.ingredientId] = (totals[ing.ingredientId] || 0) + ing.quantity
            })
          }
        }
      })
    })
    return totals
  }

  // Calculate aggregated Pre-Prep requirement for the week
  const getAggregatedPrePrep = () => {
    const totals: Record<string, number> = {}
    Object.values(weekPlan).forEach((dayPlan) => {
      const slots: MealGroup[] = ['breakfast', 'lunch', 'dinner', 'snack']
      slots.forEach((slotKey) => {
        const slot = dayPlan[slotKey]
        if (slot?.recipeId) {
          const recipe = recipes.find((r) => r.id === slot.recipeId)
          if (recipe && recipe.prePrepItems) {
            recipe.prePrepItems.forEach((pp) => {
              totals[pp.prePrepId] = (totals[pp.prePrepId] || 0) + pp.quantity
            })
          }
        }
      })
    })
    return totals
  }

  const ingredientTotals = getAggregatedIngredients()
  const prePrepTotals = getAggregatedPrePrep()

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Control Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Weekly Meal Schedule</h3>
          <p className="text-xs text-slate-400">Assign recipes to breakfast, lunch, dinner, & snacks per day.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => randomizeWeekPlan()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md shadow-indigo-950/40 transition-all active:scale-95 cursor-pointer"
          >
            <ShuffleIcon /> 🎲 Randomize Week Menu
          </button>
          <button
            onClick={() => clearWeekPlan()}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-800 transition-colors cursor-pointer"
          >
            Clear Plan
          </button>
        </div>
      </div>

      {/* 7-Day Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {Object.values(weekPlan).map((dayPlan) => (
          <div
            key={dayPlan.dayIndex}
            className="bg-slate-900/40 border border-slate-850 p-3 rounded-2xl space-y-3 flex flex-col justify-between"
          >
            <div className="border-b border-slate-800 pb-1.5">
              <h4 className="font-bold text-cyan-400 text-xs tracking-wider uppercase text-center">
                {dayPlan.dayName}
              </h4>
            </div>

            <div className="space-y-2.5 flex-1">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealGroup[]).map((mealGroup) => {
                const slot = dayPlan[mealGroup]
                const groupRecipes = recipes.filter((r) => r.mealGroup === mealGroup)

                return (
                  <div key={mealGroup} className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-450 block">
                      {mealGroup === 'breakfast' && '🌅 Breakfast'}
                      {mealGroup === 'lunch' && '☀️ Lunch'}
                      {mealGroup === 'dinner' && '🌙 Dinner'}
                      {mealGroup === 'snack' && '🍿 Snack'}
                    </label>

                    <select
                      value={slot?.recipeId ?? ''}
                      onChange={(e) => setSlotRecipe(dayPlan.dayIndex, mealGroup, e.target.value || undefined)}
                      className="text-xs px-2 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- None --</option>
                      {groupRecipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                      {groupRecipes.length === 0 && recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.mealGroup})
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* DUAL AGGREGATORS: Grocery Requirements & Pre-Prep Batch Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 🛒 Aggregated Groceries List */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              🛒 Weekly Grocery Requirements
            </h4>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
              {Object.keys(ingredientTotals).length} items
            </span>
          </div>

          {Object.keys(ingredientTotals).length === 0 ? (
            <p className="text-xs italic text-slate-500 py-3">No recipes assigned yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {Object.entries(ingredientTotals).map(([ingId, qty]) => {
                const ing = ingredients.find((i) => i.id === ingId)
                return (
                  <div
                    key={ingId}
                    className="flex items-center justify-between text-xs bg-slate-955 p-2 rounded-xl border border-slate-850"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{ing?.name ?? 'Unknown Ingredient'}</span>
                      {ing?.category && <span className="ml-2 text-[10px] text-slate-500">({ing.category})</span>}
                    </div>
                    <span className="font-mono font-bold text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {qty} {ing?.unit ?? 'pcs'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 🔪 Aggregated Batch Pre-Prep Requirements */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              🔪 Batch Pre-Prep Requirements
            </h4>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
              {Object.keys(prePrepTotals).length} prep tasks
            </span>
          </div>

          {Object.keys(prePrepTotals).length === 0 ? (
            <p className="text-xs italic text-slate-500 py-3">No pre-prep requirements for assigned recipes.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {Object.entries(prePrepTotals).map(([ppId, qty]) => {
                const pp = prePrepItems.find((p) => p.id === ppId)
                return (
                  <div
                    key={ppId}
                    className="flex items-center justify-between text-xs bg-slate-955 p-2 rounded-xl border border-slate-850"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{pp?.name ?? 'Unknown Pre-Prep'}</span>
                      {pp?.notes && <span className="ml-2 text-[10px] text-slate-500">({pp.notes})</span>}
                    </div>
                    <span className="font-mono font-bold text-purple-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {qty} {pp?.unit ?? 'pcs'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   2. RECIPES CATALOG VIEW
   ========================================================================= */
function RecipesView() {
  const { recipes, ingredients, prePrepItems, addRecipe, updateRecipe, deleteRecipe } = useMenuStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="text-sm font-bold text-slate-200">Registered Recipes</h3>
        {!creating && !editingId && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 transition-colors cursor-pointer"
          >
            <PlusIcon /> New Recipe
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <RecipeEditor
            onSave={(newRecipe) => {
              addRecipe(newRecipe)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl space-y-3 hover:border-slate-800 transition-colors"
          >
            {editingId === recipe.id ? (
              <RecipeEditor
                initial={recipe}
                onSave={(updated) => {
                  updateRecipe(recipe.id, updated)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{recipe.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-955 text-cyan-400 border border-cyan-900/30">
                        {recipe.mealGroup}
                      </span>
                      {recipe.prepTimeMinutes && (
                        <span className="text-[10px] font-mono text-slate-400">⏱️ {recipe.prepTimeMinutes} mins</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingId(recipe.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-cyan-400 px-2 py-1 rounded bg-slate-950 border border-slate-850 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRecipe(recipe.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {/* Ingredients summary */}
                {recipe.ingredients.length > 0 && (
                  <div className="pt-2 border-t border-slate-850 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">Ingredients:</span>
                    <div className="flex flex-wrap gap-1">
                      {recipe.ingredients.map((ingRef, idx) => {
                        const ing = ingredients.find((i) => i.id === ingRef.ingredientId)
                        return (
                          <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-slate-300">
                            {ing?.name ?? 'Item'}: {ingRef.quantity} {ing?.unit ?? ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pre-prep summary */}
                {recipe.prePrepItems && recipe.prePrepItems.length > 0 && (
                  <div className="pt-2 border-t border-slate-850 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">Pre-Prep Requirements:</span>
                    <div className="flex flex-wrap gap-1">
                      {recipe.prePrepItems.map((ppRef, idx) => {
                        const pp = prePrepItems.find((p) => p.id === ppRef.prePrepId)
                        return (
                          <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-955/40 border border-purple-900/30 text-purple-300">
                            🔪 {pp?.name ?? 'Prep'}: {ppRef.quantity} {pp?.unit ?? ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {recipe.notes && (
                  <p className="text-xs text-slate-400 italic pt-1 line-clamp-2">{recipe.notes}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {recipes.length === 0 && !creating && (
        <div className="text-center py-10 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm text-slate-500 font-semibold">No recipes registered yet.</p>
        </div>
      )}
    </div>
  )
}

function RecipeEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Recipe
  onSave: (recipe: Recipe) => void
  onCancel: () => void
}) {
  const { ingredients, prePrepItems } = useMenuStore()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [mealGroup, setMealGroup] = useState<MealGroup>(initial?.mealGroup ?? 'lunch')
  const [prepTime, setPrepTime] = useState<number | undefined>(initial?.prepTimeMinutes)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const [recipeIngredients, setRecipeIngredients] = useState<{ ingredientId: string; quantity: number }[]>(
    initial?.ingredients ?? []
  )
  const [recipePrePreps, setRecipePrePreps] = useState<{ prePrepId: string; quantity: number }[]>(
    initial?.prePrepItems ?? []
  )

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      mealGroup,
      prepTimeMinutes: prepTime,
      notes: notes.trim() || undefined,
      ingredients: recipeIngredients.filter((i) => i.ingredientId && i.quantity > 0),
      prePrepItems: recipePrePreps.filter((p) => p.prePrepId && p.quantity > 0),
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Recipe Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Avocado Toast, Grilled Chicken"
            className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Meal Group
          </label>
          <select
            value={mealGroup}
            onChange={(e) => setMealGroup(e.target.value as MealGroup)}
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Prep Time (min)
          </label>
          <input
            type="number"
            value={prepTime ?? ''}
            onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="mins"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Raw Ingredients Section */}
      <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-3 rounded-2xl">
        <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
          🛒 Raw Grocery Ingredients
        </label>
        {recipeIngredients.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.ingredientId}
              onChange={(e) => {
                const updated = [...recipeIngredients]
                updated[idx] = { ...updated[idx], ingredientId: e.target.value }
                setRecipeIngredients(updated)
              }}
              className="text-xs px-2.5 py-1.5 flex-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="">-- Select Ingredient --</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={row.quantity}
              onChange={(e) => {
                const updated = [...recipeIngredients]
                updated[idx] = { ...updated[idx], quantity: Number(e.target.value) || 0 }
                setRecipeIngredients(updated)
              }}
              placeholder="Qty"
              className="text-xs px-2 py-1.5 w-20 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-center focus:outline-none"
            />
            <button
              onClick={() => setRecipeIngredients(recipeIngredients.filter((_, j) => j !== idx))}
              className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <XIcon />
            </button>
          </div>
        ))}
        <button
          onClick={() => setRecipeIngredients([...recipeIngredients, { ingredientId: '', quantity: 1 }])}
          className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 pt-1 cursor-pointer"
        >
          <PlusIcon /> Add Ingredient Row
        </button>
      </div>

      {/* Pre-Prep Requirements Section */}
      <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-3 rounded-2xl">
        <label className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
          🔪 Pre-Prep Requirements (Batch Items)
        </label>
        {recipePrePreps.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.prePrepId}
              onChange={(e) => {
                const updated = [...recipePrePreps]
                updated[idx] = { ...updated[idx], prePrepId: e.target.value }
                setRecipePrePreps(updated)
              }}
              className="text-xs px-2.5 py-1.5 flex-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="">-- Select Pre-Prep Item --</option>
              {prePrepItems.map((pp) => (
                <option key={pp.id} value={pp.id}>
                  {pp.name} ({pp.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={row.quantity}
              onChange={(e) => {
                const updated = [...recipePrePreps]
                updated[idx] = { ...updated[idx], quantity: Number(e.target.value) || 0 }
                setRecipePrePreps(updated)
              }}
              placeholder="Qty"
              className="text-xs px-2 py-1.5 w-20 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-center focus:outline-none"
            />
            <button
              onClick={() => setRecipePrePreps(recipePrePreps.filter((_, j) => j !== idx))}
              className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <XIcon />
            </button>
          </div>
        ))}
        <button
          onClick={() => setRecipePrePreps([...recipePrePreps, { prePrepId: '', quantity: 1 }])}
          className="flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 pt-1 cursor-pointer"
        >
          <PlusIcon /> Add Pre-Prep Row
        </button>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
          Instructions / Recipe Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Cooking steps, tips, or storage notes..."
          rows={2}
          className="text-xs p-2.5 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 cursor-pointer"
        >
          <CheckIcon /> Save Recipe
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   3. INGREDIENTS DIRECTORY VIEW (WITH PICTURE TAB)
   ========================================================================= */
function IngredientsView() {
  const { ingredients, addIngredient, updateIngredient, deleteIngredient } = useMenuStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="text-sm font-bold text-slate-200">Ingredients Catalog (with Picture References)</h3>
        {!creating && !editingId && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 cursor-pointer"
          >
            <PlusIcon /> New Ingredient
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <IngredientEditor
            onSave={(newItem) => {
              addIngredient(newItem)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {ingredients.map((ing) => (
          <div
            key={ing.id}
            className="bg-slate-900/40 border border-slate-850 p-3.5 rounded-2xl space-y-2.5 flex flex-col justify-between hover:border-slate-800 transition-colors"
          >
            {editingId === ing.id ? (
              <IngredientEditor
                initial={ing}
                onSave={(updated) => {
                  updateIngredient(ing.id, updated)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="space-y-2">
                {/* Image Reference Tab */}
                {ing.imageUrl ? (
                  <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-950 border border-slate-850">
                    <img src={ing.imageUrl} alt={ing.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-20 rounded-xl bg-slate-955 border border-slate-850 flex items-center justify-center text-slate-600 text-xs font-mono">
                    🖼️ No picture reference
                  </div>
                )}

                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{ing.name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                        {ing.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Unit: {ing.unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingId(ing.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-cyan-400 px-2 py-0.5 rounded bg-slate-950 border border-slate-850 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteIngredient(ing.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {ing.notes && <p className="text-[11px] text-slate-400 italic line-clamp-2">{ing.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {ingredients.length === 0 && !creating && (
        <div className="text-center py-10 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm text-slate-500 font-semibold">No ingredients created yet.</p>
        </div>
      )}
    </div>
  )
}

function IngredientEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Ingredient
  onSave: (ingredient: Ingredient) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'Produce')
  const [unit, setUnit] = useState(initial?.unit ?? 'grams')
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category: category.trim() || 'Produce',
      unit: unit.trim() || 'pcs',
      imageUrl: imageUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Olive Oil, Tomatoes"
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Produce, Dairy, Spices"
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="grams, kg, tbsp, pcs"
            className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Image Reference URL (Picture Tab)</label>
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://images.unsplash.com/..."
          className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Inventory / Stock Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Available in pantry, brand preferences..."
          className="text-xs px-2.5 py-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-slate-850">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded-lg text-xs bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955"
        >
          Save
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   4. PRE-PREP ITEMS DIRECTORY VIEW
   ========================================================================= */
function PrePrepView() {
  const { prePrepItems, addPrePrepItem, updatePrePrepItem, deletePrePrepItem } = useMenuStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="text-sm font-bold text-slate-200">Batch Pre-Prep Items (for Clubbing Advance Tasks)</h3>
        {!creating && !editingId && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500 hover:bg-purple-600 text-white cursor-pointer"
          >
            <PlusIcon /> New Pre-Prep Item
          </button>
        )}
      </div>

      {creating && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <PrePrepEditor
            onSave={(newItem) => {
              addPrePrepItem(newItem)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {prePrepItems.map((pp) => (
          <div
            key={pp.id}
            className="bg-slate-900/40 border border-slate-850 p-3.5 rounded-2xl space-y-2 flex flex-col justify-between hover:border-slate-800 transition-colors"
          >
            {editingId === pp.id ? (
              <PrePrepEditor
                initial={pp}
                onSave={(updated) => {
                  updatePrePrepItem(pp.id, updated)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h4 className="font-bold text-purple-300 text-sm">🔪 {pp.name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 block mt-0.5">Unit: {pp.unit}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingId(pp.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-purple-300 px-2 py-0.5 rounded bg-slate-950 border border-slate-850 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePrePrepItem(pp.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {pp.notes && <p className="text-[11px] text-slate-400 italic line-clamp-2">{pp.notes}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {prePrepItems.length === 0 && !creating && (
        <div className="text-center py-10 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm text-slate-500 font-semibold">No pre-prep items created yet.</p>
        </div>
      )}
    </div>
  )
}

function PrePrepEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: PrePrepItem
  onSave: (item: PrePrepItem) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? 'grams')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      unit: unit.trim() || 'pcs',
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Pre-Prep Item Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chopped Onions, Boiled Potatoes"
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="grams, pcs, tbsp, cups"
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Storage / Shelf-Life Instructions</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Refrigerate in airtight container, good for 3 days..."
          className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-slate-850">
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded-lg text-xs bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-500 hover:bg-purple-600 text-white"
        >
          Save
        </button>
      </div>
    </div>
  )
}
