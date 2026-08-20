import { useState } from 'react'
import { useSchedulerStore } from '../store/schedulerStore'

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const dayLabels = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const mins = m % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(mins).padStart(2, '0')} ${period}`
}

function AdhocPanel() {
  const { adhocTasks, removeAdhocTask } = useSchedulerStore()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Group by day
  const tasksByDay = adhocTasks.reduce<Record<number, typeof adhocTasks>>((acc, task) => {
    if (!acc[task.day]) acc[task.day] = []
    acc[task.day].push(task)
    return acc
  }, {})

  const sortedDays = Object.keys(tasksByDay)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2">
        <h3 className="text-lg font-black tracking-wide text-slate-100">Ad Hoc Tasks</h3>
        <p className="text-xs text-slate-400">
          On-the-fly tasks injected into the schedule. Obliterate the ones that have outlived their purpose.
        </p>
      </div>

      {adhocTasks.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm font-semibold text-slate-500">No ad hoc tasks in existence.</p>
          <p className="text-xs text-slate-600 mt-1">Create them from the Dashboard timeline.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedDays.map((dayIndex) => (
            <div key={dayIndex} className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />
                {dayLabels[dayIndex] ?? `Day ${dayIndex + 1}`}
                <span className="text-slate-600 font-mono">({tasksByDay[dayIndex].length})</span>
              </h4>
              <div className="space-y-2">
                {tasksByDay[dayIndex]
                  .sort((a, b) => a.startTime - b.startTime)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 bg-slate-900/40 border border-slate-850 p-3.5 rounded-2xl hover:border-slate-700 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <h5 className="text-sm font-bold text-slate-200 truncate">{task.title}</h5>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-400">
                          <span>⏰ {formatMinutes(task.startTime)}</span>
                          <span>⏱️ {task.durationMinutes}m</span>
                          <span>⚡ W: {task.weight}</span>
                          {task.fixedEndTime !== undefined && (
                            <span>🛑 End: {formatMinutes(task.fixedEndTime)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {confirmDeleteId === task.id ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider whitespace-nowrap">
                              Obliterate?
                            </span>
                            <button
                              onClick={() => {
                                removeAdhocTask(task.id)
                                setConfirmDeleteId(null)
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-950/40 transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer uppercase tracking-wider"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(task.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-800/30 transition-all cursor-pointer opacity-60 group-hover:opacity-100 uppercase tracking-wider"
                            title="Obliterate this ad hoc task"
                          >
                            <TrashIcon /> Obliterate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Bulk obliterate */}
          {adhocTasks.length > 1 && (
            <div className="pt-3 border-t border-slate-800/60">
              <ObliterateAllButton
                count={adhocTasks.length}
                onConfirm={() => {
                  adhocTasks.forEach((t) => removeAdhocTask(t.id))
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ObliterateAllButton({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
        <span className="text-xs font-bold text-rose-400">
          Obliterate all {count} ad hoc tasks from existence?
        </span>
        <button
          onClick={() => {
            onConfirm()
            setConfirming(false)
          }}
          className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-950/40 transition-all active:scale-95 cursor-pointer"
        >
          Yes, annihilate them all
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
        >
          Spare them
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400/70 hover:text-rose-400 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/20 hover:border-rose-800/30 transition-all cursor-pointer"
    >
      <TrashIcon /> Obliterate All ({count})
    </button>
  )
}

export default AdhocPanel
