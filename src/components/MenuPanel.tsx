import { useState } from 'react'
import { useMenuStore, DEFAULT_EATING_SLOTS } from '../store/menuStore'
import type { Ingredient, PrePrepItem, Recipe, EatingSlot } from '../types/menu'
import { getSlotRecipeIds } from '../types/menu'

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

const ShuffleIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16M4 20h16M16 4l4 4-4 4M8 20l-4-4 4-4" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-3 h-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const FireIcon = () => (
  <svg className="w-3.5 h-3.5 inline-block text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
  </svg>
)

// Helper to get eating slots sorted in ascending order by scheduled time
function getSortedEatingSlots(slots?: EatingSlot[]): EatingSlot[] {
  const raw = slots && slots.length > 0 ? slots : DEFAULT_EATING_SLOTS
  return [...raw].sort((a, b) => {
    const timeA = a.scheduledTime || '99:99'
    const timeB = b.scheduledTime || '99:99'
    return timeA.localeCompare(timeB)
  })
}

export default function MenuPanel() {
  const [subTab, setSubTab] = useState<'planner' | 'templates' | 'recipes' | 'ingredients' | 'preprep' | 'slots'>('planner')

  return (
    <div className="space-y-6">
      {/* Unified Top Header & Navigation Pane */}
      <div className="border-b border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-xl font-black tracking-wide text-slate-100 flex items-center gap-2">
            🥗 Menu & Recipe Manager
          </h2>
          <p className="text-xs text-slate-400">
            Plan meals, save reusable day templates, track calories, catalog recipes & aggregate groceries.
          </p>
        </div>

        {/* Sleek Navigation Pane Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-850 shadow-inner">
          {[
            { id: 'planner', label: '📅 Day Planner' },
            { id: 'templates', label: '🗂️ Day Templates' },
            { id: 'recipes', label: '🍲 Recipes' },
            { id: 'ingredients', label: '🥬 Ingredients' },
            { id: 'preprep', label: '🔪 Pre-Prep' },
            { id: 'slots', label: '⚙️ Eating Slots' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                subTab === t.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-955 shadow-md shadow-cyan-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Render Sub View */}
      {subTab === 'planner' && <WeeklyPlannerView />}
      {subTab === 'templates' && <DayTemplatesView />}
      {subTab === 'recipes' && <RecipesView />}
      {subTab === 'ingredients' && <IngredientsView />}
      {subTab === 'preprep' && <PrePrepView />}
      {subTab === 'slots' && <EatingSlotsView />}
    </div>
  )
}

/* =========================================================================
   1. DAY PLANNER VIEW, MULTI-RECIPE SLOTS & CALORIES
   ========================================================================= */
function WeeklyPlannerView() {
  const { weekPlan, recipes, ingredients, prePrepItems, eatingSlots, dayMenuTemplates, addSlotRecipe, removeSlotRecipe, saveDayAsTemplate, applyTemplateToDay, randomizeWeekPlan, clearWeekPlan } =
    useMenuStore()
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0) // Default: Monday (0)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateNameInput, setTemplateNameInput] = useState('')

  const activeSlots = getSortedEatingSlots(eatingSlots)
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const selectedDayPlan = weekPlan[selectedDayIndex] || {
    dayIndex: selectedDayIndex,
    dayName: DAY_NAMES[selectedDayIndex],
    slots: {},
  }

  // Helper to resolve slot data from day plan (supports both slots record & legacy properties)
  const getSlotAssignment = (slotId: string) => {
    if (selectedDayPlan.slots && selectedDayPlan.slots[slotId]) {
      return selectedDayPlan.slots[slotId]
    }
    return (selectedDayPlan as any)[slotId] || {}
  }

  // Calculate Total Daily Calorie Consumption for selected day
  const calculateDailyCalories = () => {
    let total = 0
    activeSlots.forEach((slot) => {
      const assignment = getSlotAssignment(slot.id)
      const recipeIds = getSlotRecipeIds(assignment)
      recipeIds.forEach((rid) => {
        const recipe = recipes.find((r) => r.id === rid)
        if (recipe?.calories) {
          total += recipe.calories
        }
      })
    })
    return total
  }

  // Calculate aggregated Grocery / Raw Ingredients requirement for the week
  const getAggregatedIngredients = () => {
    const totals: Record<string, number> = {}
    Object.values(weekPlan).forEach((dayPlan) => {
      activeSlots.forEach((slot) => {
        const assignment = dayPlan.slots?.[slot.id] || (dayPlan as any)[slot.id]
        const recipeIds = getSlotRecipeIds(assignment)
        recipeIds.forEach((rid) => {
          const recipe = recipes.find((r) => r.id === rid)
          if (recipe) {
            recipe.ingredients.forEach((ing) => {
              totals[ing.ingredientId] = (totals[ing.ingredientId] || 0) + ing.quantity
            })
          }
        })
      })
    })
    return totals
  }

  // Calculate aggregated Pre-Prep requirement for the week
  const getAggregatedPrePrep = () => {
    const totals: Record<string, number> = {}
    Object.values(weekPlan).forEach((dayPlan) => {
      activeSlots.forEach((slot) => {
        const assignment = dayPlan.slots?.[slot.id] || (dayPlan as any)[slot.id]
        const recipeIds = getSlotRecipeIds(assignment)
        recipeIds.forEach((rid) => {
          const recipe = recipes.find((r) => r.id === rid)
          if (recipe && recipe.prePrepItems) {
            recipe.prePrepItems.forEach((pp) => {
              totals[pp.prePrepId] = (totals[pp.prePrepId] || 0) + pp.quantity
            })
          }
        })
      })
    })
    return totals
  }

  const dailyCalories = calculateDailyCalories()
  const ingredientTotals = getAggregatedIngredients()
  const prePrepTotals = getAggregatedPrePrep()

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Calorie Total Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 border border-slate-800 rounded-3xl shadow-lg">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            📅 Day Menu Planner: <span className="text-cyan-400 font-extrabold">{DAY_NAMES[selectedDayIndex]}</span>
          </h3>
          <p className="text-xs text-slate-400">Assign multiple recipes per eating slot, save reusable day templates & track daily calories.</p>
        </div>

        {/* Daily Calorie Banner & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-amber-500/30 flex items-center gap-2 shadow-inner">
            <FireIcon />
            <div className="text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-450 block leading-tight">
                Daily Calories
              </span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {dailyCalories > 0 ? `${dailyCalories} kcal` : '0 kcal'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Apply Template Dropdown */}
            {dayMenuTemplates && dayMenuTemplates.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    applyTemplateToDay(selectedDayIndex, e.target.value)
                  }
                }}
                className="text-xs px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-400 font-bold focus:outline-none cursor-pointer"
              >
                <option value="">📋 Apply Template…</option>
                {dayMenuTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    Load "{t.name}"
                  </option>
                ))}
              </select>
            )}

            {/* Save Day as Template Button */}
            <button
              onClick={() => {
                setTemplateNameInput(`${DAY_NAMES[selectedDayIndex]} Menu`)
                setShowSaveModal(true)
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-cyan-400 border border-cyan-800/40 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              💾 Save Day as Template
            </button>

            <button
              onClick={() => randomizeWeekPlan()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white shadow-md shadow-indigo-950/40 transition-all active:scale-95 cursor-pointer"
            >
              <ShuffleIcon /> 🎲 Randomize Week
            </button>
            <button
              onClick={() => clearWeekPlan()}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-800 transition-colors cursor-pointer"
            >
              Clear Plan
            </button>
          </div>
        </div>
      </div>

      {/* Save Day Template Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              💾 Save {DAY_NAMES[selectedDayIndex]}'s Menu as Template
            </h3>
            <p className="text-xs text-slate-400">
              Save all assigned recipes for {DAY_NAMES[selectedDayIndex]} so you can quickly apply it to any day of the week anytime!
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder="e.g. High Protein Workout Day, Keto Weekend"
                className="text-xs px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-950 text-slate-400 border border-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (templateNameInput.trim()) {
                    saveDayAsTemplate(selectedDayIndex, templateNameInput.trim())
                    setShowSaveModal(false)
                  }
                }}
                className="px-5 py-1.5 text-xs font-bold bg-cyan-500 text-slate-955 rounded-xl shadow-md active:scale-95 cursor-pointer"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Day Selector Tab Bar */}
      <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-2xl border border-slate-850 overflow-x-auto gap-1">
        {DAY_NAMES.map((dayName, idx) => {
          const isSelected = selectedDayIndex === idx
          const dPlan = weekPlan[idx]
          const hasAssigned =
            dPlan &&
            activeSlots.some((s) => {
              const slotData = dPlan.slots?.[s.id] || (dPlan as any)[s.id]
              const rIds = getSlotRecipeIds(slotData)
              return rIds.length > 0
            })

          return (
            <button
              key={idx}
              onClick={() => setSelectedDayIndex(idx)}
              className={`flex-1 min-w-[95px] py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center relative active:scale-95 ${
                isSelected
                  ? 'bg-slate-900 text-cyan-400 border border-slate-800 shadow-md shadow-cyan-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <span>{dayName}</span>
              {hasAssigned && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 absolute top-1.5 right-2" title="Meals Planned" />
              )}
            </button>
          )
        })}
      </div>

      {/* Dynamic Single-Day Multi-Recipe Eating Slot Cards Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeSlots.map((slot) => {
          const assignment = getSlotAssignment(slot.id)
          const recipeIds = getSlotRecipeIds(assignment)
          const slotRecipes = recipeIds.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as Recipe[]
          const groupRecipes = recipes.filter((r) => r.mealGroup === slot.id)

          // Calculate slot total calories
          const slotCalories = slotRecipes.reduce((sum, r) => sum + (r.calories || 0), 0)

          return (
            <div
              key={slot.id}
              className="bg-slate-900/40 border border-slate-800 p-4 rounded-3xl space-y-3.5 shadow-lg flex flex-col justify-between"
            >
              {/* Header with Slot Name, Scheduled Time, and Slot Calories */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <h4 className="text-sm font-extrabold tracking-wide text-slate-100 flex items-center gap-2">
                  <span>{slot.icon || '🍱'}</span>
                  <span>{slot.name}</span>
                </h4>

                <div className="flex items-center gap-2 font-mono text-[10px]">
                  {slot.scheduledTime && (
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-bold flex items-center gap-1">
                      <ClockIcon /> {slot.scheduledTime}
                    </span>
                  )}
                  {slotCalories > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-955/60 border border-amber-900/40 text-amber-400 font-bold flex items-center gap-1">
                      <FireIcon /> {slotCalories} kcal
                    </span>
                  )}
                </div>
              </div>

              {/* Multi-Recipe Pills List */}
              {slotRecipes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">
                    Assigned Dishes ({slotRecipes.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {slotRecipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-100 shadow-inner"
                      >
                        <span>{recipe.title}</span>
                        {recipe.calories && (
                          <span className="text-[10px] font-mono text-amber-400 font-bold">
                            {recipe.calories}kcal
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSlotRecipe(selectedDayIndex, slot.id, recipe.id)}
                          className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer font-bold"
                          title="Remove from slot"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* + Add Recipe to Slot Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">
                  + Add Recipe to Slot:
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addSlotRecipe(selectedDayIndex, slot.id, e.target.value)
                    }
                  }}
                  className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Add another dish to {slot.name} --</option>
                  {groupRecipes
                    .filter((r) => !recipeIds.includes(r.id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        + {r.title} {r.calories ? `(${r.calories} kcal)` : ''}
                      </option>
                    ))}
                  {recipes
                    .filter((r) => r.mealGroup !== slot.id && !recipeIds.includes(r.id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        + {r.title} ({r.mealGroup}) {r.calories ? `(${r.calories} kcal)` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Multi-Recipe Ingredients & Pre-Prep Combined Breakdown */}
              {slotRecipes.length > 0 ? (
                <div className="bg-slate-950/80 border border-slate-850 p-3 rounded-2xl space-y-2 text-xs">
                  {/* Aggregated Raw Ingredients for this Slot */}
                  {(() => {
                    const slotIngs: Record<string, number> = {}
                    slotRecipes.forEach((r) => {
                      r.ingredients.forEach((ing) => {
                        slotIngs[ing.ingredientId] = (slotIngs[ing.ingredientId] || 0) + ing.quantity
                      })
                    })
                    const entries = Object.entries(slotIngs)
                    if (entries.length === 0) return null

                    return (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-450 block mb-1">Raw Groceries Needed:</span>
                        <div className="flex flex-wrap gap-1">
                          {entries.map(([ingId, qty], idx) => {
                            const ing = ingredients.find((i) => i.id === ingId)
                            return (
                              <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                                {ing?.name ?? 'Item'}: {qty} {ing?.unit ?? ''}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Aggregated Pre-Prep for this Slot */}
                  {(() => {
                    const slotPreps: Record<string, number> = {}
                    slotRecipes.forEach((r) => {
                      r.prePrepItems?.forEach((pp) => {
                        slotPreps[pp.prePrepId] = (slotPreps[pp.prePrepId] || 0) + pp.quantity
                      })
                    })
                    const entries = Object.entries(slotPreps)
                    if (entries.length === 0) return null

                    return (
                      <div className="pt-1.5 border-t border-slate-850/80">
                        <span className="text-[10px] font-bold uppercase text-purple-400 block mb-1">Batch Pre-Prep:</span>
                        <div className="flex flex-wrap gap-1">
                          {entries.map(([ppId, qty], idx) => {
                            const pp = prePrepItems.find((p) => p.id === ppId)
                            return (
                              <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-955/40 border border-purple-900/30 text-purple-300">
                                🔪 {pp?.name ?? 'Prep'}: {qty} {pp?.unit ?? ''}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="bg-slate-950/40 border border-dashed border-slate-850 p-3.5 rounded-2xl text-center">
                  <p className="text-xs text-slate-500 italic">No dishes assigned to {slot.name}.</p>
                </div>
              )}
            </div>
          )
        })}
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

          {Object.keys(ingredientTotals).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(ingredientTotals).map(([ingId, qty]) => {
                const ing = ingredients.find((i) => i.id === ingId)
                return (
                  <div key={ingId} className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-850 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">{ing?.name ?? 'Unknown'}</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {qty} {ing?.unit ?? ''}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-2 text-center">No grocery items required for this week's plan.</p>
          )}
        </div>

        {/* 🔪 Aggregated Pre-Prep Batch List */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              🔪 Batch Pre-Prep Requirements
            </h4>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-purple-400">
              {Object.keys(prePrepTotals).length} items
            </span>
          </div>

          {Object.keys(prePrepTotals).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(prePrepTotals).map(([ppId, qty]) => {
                const pp = prePrepItems.find((p) => p.id === ppId)
                return (
                  <div key={ppId} className="bg-purple-955/30 p-2.5 rounded-xl border border-purple-900/30 flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-200">{pp?.name ?? 'Unknown'}</span>
                    <span className="text-xs font-mono font-bold text-purple-400">
                      {qty} {pp?.unit ?? ''}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-2 text-center">No batch pre-prep items required for this week's plan.</p>
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
  const { recipes, ingredients, prePrepItems, eatingSlots, addRecipe, updateRecipe, deleteRecipe } = useMenuStore()
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const activeSlots = getSortedEatingSlots(eatingSlots)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Catalog Header & Action */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Recipe Catalog</h3>
          <p className="text-xs text-slate-400">Store recipes, raw ingredient quantities, calories & pre-prep items.</p>
        </div>
        <button
          onClick={() => {
            setEditingRecipe(null)
            setIsCreating(true)
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-955 transition-all cursor-pointer shadow-md shadow-cyan-950/40 active:scale-95"
        >
          <PlusIcon /> Add Recipe
        </button>
      </div>

      {/* Recipe Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((recipe) => {
          const slot = activeSlots.find((s) => s.id === recipe.mealGroup)
          return (
            <div key={recipe.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-md flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-100">{recipe.title}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-extrabold text-cyan-400 bg-cyan-955/50 border border-cyan-900/40 px-2 py-0.5 rounded">
                      {slot?.name || recipe.mealGroup}
                    </span>
                    {recipe.calories && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-955/50 border border-amber-900/30 text-amber-300 font-bold flex items-center gap-1">
                        <FireIcon /> {recipe.calories} kcal
                      </span>
                    )}
                  </div>
                </div>

                {recipe.prepTimeMinutes && (
                  <p className="text-[10px] font-mono text-slate-400">⏱️ Prep Time: {recipe.prepTimeMinutes} mins</p>
                )}

                {/* Raw Ingredients */}
                {recipe.ingredients.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-450 block">Groceries:</span>
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

                {/* Pre-Prep Items */}
                {recipe.prePrepItems && recipe.prePrepItems.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold uppercase text-purple-400 block">Batch Pre-Prep:</span>
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

                {recipe.notes && <p className="text-xs text-slate-400 italic pt-1">{recipe.notes}</p>}
              </div>

              {/* Edit/Delete Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button
                  onClick={() => {
                    setEditingRecipe(recipe)
                    setIsCreating(false)
                  }}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteRecipe(recipe.id)}
                  className="text-xs px-3 py-1 rounded-lg bg-rose-955/40 hover:bg-rose-950 text-rose-300 border border-rose-900/40 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
        {recipes.length === 0 && (
          <div className="col-span-full bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-2xl text-center">
            <p className="text-sm text-slate-400">No recipes added yet.</p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {(isCreating || editingRecipe) && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">
              {editingRecipe ? 'Edit Recipe' : 'Add New Recipe'}
            </h3>

            <RecipeEditor
              initial={editingRecipe ?? undefined}
              onSave={(recipe) => {
                if (editingRecipe) {
                  updateRecipe(editingRecipe.id, recipe)
                } else {
                  addRecipe(recipe)
                }
                setEditingRecipe(null)
                setIsCreating(false)
              }}
              onCancel={() => {
                setEditingRecipe(null)
                setIsCreating(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   RECIPE EDITOR FORM
   ========================================================================= */
function RecipeEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Recipe
  onSave: (recipe: Recipe) => void
  onCancel: () => void
}) {
  const { ingredients, prePrepItems, eatingSlots } = useMenuStore()
  const activeSlots = getSortedEatingSlots(eatingSlots)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [mealGroup, setMealGroup] = useState<string>(initial?.mealGroup ?? activeSlots[0]?.id ?? 'lunch')
  const [prepTime, setPrepTime] = useState<number | undefined>(initial?.prepTimeMinutes)
  const [calories, setCalories] = useState<number | undefined>(initial?.calories)
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
      calories: calories,
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
            Eating Slot
          </label>
          <select
            value={mealGroup}
            onChange={(e) => setMealGroup(e.target.value)}
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
          >
            {activeSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Calories (kcal)
          </label>
          <input
            type="number"
            value={calories ?? ''}
            onChange={(e) => setCalories(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="e.g. 450"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-amber-400 font-mono font-bold focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Prep Time (mins)
          </label>
          <input
            type="number"
            value={prepTime ?? ''}
            onChange={(e) => setPrepTime(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="mins"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Instructions / Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Recipe steps or serving notes"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      {/* Raw Ingredients Section */}
      <div className="space-y-2 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Raw Ingredients Required
          </label>
          <button
            type="button"
            onClick={() => setRecipeIngredients([...recipeIngredients, { ingredientId: '', quantity: 1 }])}
            className="text-[10px] font-bold px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-cyan-400 rounded-lg cursor-pointer"
          >
            + Add Ingredient
          </button>
        </div>

        {recipeIngredients.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.ingredientId}
              onChange={(e) => {
                const updated = [...recipeIngredients]
                updated[idx].ingredientId = e.target.value
                setRecipeIngredients(updated)
              }}
              className="text-xs px-3 py-1.5 flex-1 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none cursor-pointer"
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
              step="any"
              value={row.quantity}
              onChange={(e) => {
                const updated = [...recipeIngredients]
                updated[idx].quantity = Number(e.target.value)
                setRecipeIngredients(updated)
              }}
              placeholder="Qty"
              className="text-xs px-2.5 py-1.5 w-20 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-center font-mono focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
              className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {/* Pre-Prep Items Section */}
      <div className="space-y-2 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
            Batch Pre-Prep Requirements
          </label>
          <button
            type="button"
            onClick={() => setRecipePrePreps([...recipePrePreps, { prePrepId: '', quantity: 1 }])}
            className="text-[10px] font-bold px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-purple-400 rounded-lg cursor-pointer"
          >
            + Add Pre-Prep Item
          </button>
        </div>

        {recipePrePreps.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.prePrepId}
              onChange={(e) => {
                const updated = [...recipePrePreps]
                updated[idx].prePrepId = e.target.value
                setRecipePrePreps(updated)
              }}
              className="text-xs px-3 py-1.5 flex-1 bg-slate-950 border border-slate-800 rounded-xl text-purple-200 focus:outline-none cursor-pointer"
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
              step="any"
              value={row.quantity}
              onChange={(e) => {
                const updated = [...recipePrePreps]
                updated[idx].quantity = Number(e.target.value)
                setRecipePrePreps(updated)
              }}
              placeholder="Qty"
              className="text-xs px-2.5 py-1.5 w-20 bg-slate-950 border border-slate-800 rounded-xl text-purple-300 text-center font-mono focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setRecipePrePreps(recipePrePreps.filter((_, i) => i !== idx))}
              className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-800 rounded-xl cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-955 rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
        >
          Save Recipe
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   3. INGREDIENTS DIRECTORY VIEW (PICTURE TAB)
   ========================================================================= */
function IngredientsView() {
  const { ingredients, addIngredient, updateIngredient, deleteIngredient } = useMenuStore()
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Ingredients Directory</h3>
          <p className="text-xs text-slate-400">Store raw ingredients, picture reference URLs, measurement units & stock notes.</p>
        </div>
        <button
          onClick={() => {
            setEditingIngredient(null)
            setIsCreating(true)
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-955 transition-all cursor-pointer shadow-md active:scale-95"
        >
          <PlusIcon /> Add Ingredient
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ingredients.map((ing) => (
          <div key={ing.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              {ing.imageUrl && (
                <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-850">
                  <img src={ing.imageUrl} alt={ing.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100">{ing.name}</h4>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                  {ing.unit}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{ing.category}</p>
              {ing.notes && <p className="text-xs text-slate-400 italic">{ing.notes}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
              <button
                onClick={() => {
                  setEditingIngredient(ing)
                  setIsCreating(false)
                }}
                className="text-xs px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => deleteIngredient(ing.id)}
                className="text-xs px-3 py-1 rounded-lg bg-rose-955/40 hover:bg-rose-950 text-rose-300 border border-rose-900/40 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {ingredients.length === 0 && (
          <div className="col-span-full bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-2xl text-center">
            <p className="text-sm text-slate-400">No ingredients added yet.</p>
          </div>
        )}
      </div>

      {(isCreating || editingIngredient) && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">
              {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
            </h3>

            <IngredientEditor
              initial={editingIngredient ?? undefined}
              onSave={(ing) => {
                if (editingIngredient) {
                  updateIngredient(editingIngredient.id, ing)
                } else {
                  addIngredient(ing)
                }
                setEditingIngredient(null)
                setIsCreating(false)
              }}
              onCancel={() => {
                setEditingIngredient(null)
                setIsCreating(false)
              }}
            />
          </div>
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
  onSave: (ing: Ingredient) => void
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
      category: category.trim(),
      unit: unit.trim(),
      imageUrl: imageUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Ingredient Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Avocado, Olive Oil, Chicken Breast"
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Produce, Dairy, Spices"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="grams, kg, tbsp, pcs"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Picture Reference URL</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Inventory Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Storage or brand preferences"
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-semibold bg-slate-950 text-slate-400 border border-slate-800 rounded-xl"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 text-xs font-bold bg-cyan-500 text-slate-955 rounded-xl shadow-md active:scale-95"
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
  const [editingItem, setEditingItem] = useState<PrePrepItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-purple-300">Pre-Prep Items Directory</h3>
          <p className="text-xs text-slate-400">Manage batch pre-prep items (e.g. Chopped Onions, Pastes, Boiled Items) for multiple recipes.</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null)
            setIsCreating(true)
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-500 hover:bg-purple-400 text-white transition-all cursor-pointer shadow-md active:scale-95"
        >
          <PlusIcon /> Add Pre-Prep Item
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {prePrepItems.map((item) => (
          <div key={item.id} className="bg-purple-955/20 border border-purple-900/30 p-4 rounded-2xl space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-purple-200">🔪 {item.name}</h4>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-purple-900/40 text-purple-300">
                  {item.unit}
                </span>
              </div>
              {item.notes && <p className="text-xs text-slate-400 italic pt-1">{item.notes}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-purple-900/30">
              <button
                onClick={() => {
                  setEditingItem(item)
                  setIsCreating(false)
                }}
                className="text-xs px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => deletePrePrepItem(item.id)}
                className="text-xs px-3 py-1 rounded-lg bg-rose-955/40 hover:bg-rose-950 text-rose-300 border border-rose-900/40 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {prePrepItems.length === 0 && (
          <div className="col-span-full bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-2xl text-center">
            <p className="text-sm text-slate-400">No pre-prep items added yet.</p>
          </div>
        )}
      </div>

      {(isCreating || editingItem) && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">
              {editingItem ? 'Edit Pre-Prep Item' : 'Add Pre-Prep Item'}
            </h3>

            <PrePrepEditor
              initial={editingItem ?? undefined}
              onSave={(item) => {
                if (editingItem) {
                  updatePrePrepItem(editingItem.id, item)
                } else {
                  addPrePrepItem(item)
                }
                setEditingItem(null)
                setIsCreating(false)
              }}
              onCancel={() => {
                setEditingItem(null)
                setIsCreating(false)
              }}
            />
          </div>
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
      unit: unit.trim(),
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Pre-Prep Item Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chopped Onions, Ginger Garlic Paste"
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-purple-200 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Unit</label>
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="grams, tbsp, cups, batches"
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Storage & Shelf-Life Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Refrigerate for up to 3 days"
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-semibold bg-slate-950 text-slate-400 border border-slate-800 rounded-xl"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 text-xs font-bold bg-purple-500 text-white rounded-xl shadow-md active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   5. VARIABLE EATING SLOTS CONFIGURATION VIEW
   ========================================================================= */
function EatingSlotsView() {
  const { eatingSlots, addEatingSlot, updateEatingSlot, deleteEatingSlot } = useMenuStore()
  const [editingSlot, setEditingSlot] = useState<EatingSlot | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const activeSlots = getSortedEatingSlots(eatingSlots)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Variable Eating Slots & Meal Schedule</h3>
          <p className="text-xs text-slate-400">Add, adjust, or rename eating slots and target scheduled meal times.</p>
        </div>
        <button
          onClick={() => {
            setEditingSlot(null)
            setIsCreating(true)
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-955 transition-all cursor-pointer shadow-md active:scale-95"
        >
          <PlusIcon /> Add Eating Slot
        </button>
      </div>

      {/* Eating Slots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {activeSlots.map((slot) => (
          <div key={slot.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-md flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>{slot.icon || '🍱'}</span>
                  <span>{slot.name}</span>
                </h4>
                {slot.scheduledTime && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 flex items-center gap-1">
                    <ClockIcon /> {slot.scheduledTime}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-slate-500">ID: {slot.id}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
              <button
                onClick={() => {
                  setEditingSlot(slot)
                  setIsCreating(false)
                }}
                className="text-xs px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => deleteEatingSlot(slot.id)}
                className="text-xs px-3 py-1 rounded-lg bg-rose-955/40 hover:bg-rose-950 text-rose-300 border border-rose-900/40 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {(isCreating || editingSlot) && (
        <div className="fixed inset-0 bg-slate-955/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100">
              {editingSlot ? 'Edit Eating Slot' : 'Add New Eating Slot'}
            </h3>

            <EatingSlotEditor
              initial={editingSlot ?? undefined}
              onSave={(slot) => {
                if (editingSlot) {
                  updateEatingSlot(editingSlot.id, slot)
                } else {
                  addEatingSlot(slot)
                }
                setEditingSlot(null)
                setIsCreating(false)
              }}
              onCancel={() => {
                setEditingSlot(null)
                setIsCreating(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function EatingSlotEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: EatingSlot
  onSave: (slot: EatingSlot) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [scheduledTime, setScheduledTime] = useState(initial?.scheduledTime ?? '12:00')
  const [icon, setIcon] = useState(initial?.icon ?? '🍱')

  const handleSave = () => {
    if (!name.trim()) return
    const slotId = initial?.id ?? name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    onSave({
      id: slotId,
      name: name.trim(),
      scheduledTime: scheduledTime.trim() || undefined,
      icon: icon.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Slot Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Post-Workout Shake, Early Morning Tea"
          className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Scheduled Time (HH:MM)</label>
          <input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-cyan-400 font-mono font-bold focus:outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase block mb-1">Icon / Emoji</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="⚡, 🌅, ☀️, 🌙"
            className="text-xs px-3 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-center focus:outline-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-semibold bg-slate-950 text-slate-400 border border-slate-800 rounded-xl"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 text-xs font-bold bg-cyan-500 text-slate-955 rounded-xl shadow-md active:scale-95"
        >
          Save Slot
        </button>
      </div>
    </div>
  )
}

/* =========================================================================
   6. REUSABLE DAY MENU TEMPLATES VIEW
   ========================================================================= */
function DayTemplatesView() {
  const { dayMenuTemplates, recipes, eatingSlots, applyTemplateToDay, deleteDayMenuTemplate } = useMenuStore()
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const activeSlots = getSortedEatingSlots(eatingSlots)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div>
          <h3 className="text-sm font-bold text-cyan-300">🗂️ Reusable Day Menu Templates</h3>
          <p className="text-xs text-slate-400">Save full-day meal configurations and apply them to any day of the week with 1 click.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(dayMenuTemplates || []).map((template) => {
          // Compute total template calories
          let templateCalories = 0
          activeSlots.forEach((slot) => {
            const slotData = template.slots?.[slot.id]
            const rIds = getSlotRecipeIds(slotData)
            rIds.forEach((rid) => {
              const r = recipes.find((rec) => rec.id === rid)
              if (r?.calories) templateCalories += r.calories
            })
          })

          return (
            <div key={template.id} className="bg-slate-900/40 border border-slate-800 p-4 rounded-3xl space-y-3.5 shadow-lg flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <h4 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                    <span>🗂️</span>
                    <span>{template.name}</span>
                  </h4>

                  {templateCalories > 0 && (
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-amber-955/60 border border-amber-900/40 text-amber-400 font-bold flex items-center gap-1">
                      <FireIcon /> {templateCalories} kcal
                    </span>
                  )}
                </div>

                {/* Eating Slots Breakdown */}
                <div className="space-y-2 text-xs">
                  {activeSlots.map((slot) => {
                    const slotData = template.slots?.[slot.id]
                    const rIds = getSlotRecipeIds(slotData)
                    const slotRecipes = rIds.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as Recipe[]

                    if (slotRecipes.length === 0) return null

                    return (
                      <div key={slot.id} className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-850 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-450 flex items-center gap-1">
                          <span>{slot.icon || '🍱'}</span>
                          <span>{slot.name}</span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {slotRecipes.map((r) => (
                            <span key={r.id} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200">
                              {r.title} {r.calories ? `(${r.calories} kcal)` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-850 gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value !== '') {
                      applyTemplateToDay(Number(e.target.value), template.id)
                    }
                  }}
                  className="text-xs px-3 py-1.5 bg-slate-950 border border-cyan-800/40 rounded-xl text-cyan-400 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">Apply to Day…</option>
                  {DAY_NAMES.map((dayName, idx) => (
                    <option key={idx} value={idx}>
                      Apply to {dayName}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => deleteDayMenuTemplate(template.id)}
                  className="text-xs px-3 py-1 rounded-xl bg-rose-955/40 hover:bg-rose-950 text-rose-300 border border-rose-900/40 cursor-pointer"
                >
                  Delete Template
                </button>
              </div>
            </div>
          )
        })}

        {(!dayMenuTemplates || dayMenuTemplates.length === 0) && (
          <div className="col-span-full bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-2xl text-center">
            <p className="text-sm text-slate-400">No day menu templates saved yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Go to the 📅 Day Planner tab and click "💾 Save Day as Template" to save your custom daily menus!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
