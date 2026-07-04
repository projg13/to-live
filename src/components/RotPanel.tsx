import { useState } from 'react'
import { useRotStore } from '../store/rotStore'
import { useTaskStore } from '../store/taskStore'
import type { RotEntry } from '../types/rot'
import { formatTime } from '../types/anchor'

// Icons
const PlusIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

function RotPanel() {
  const { entries, addEntry, deleteEntry, getRotDays } = useRotStore()
  const { tasks } = useTaskStore()
  const [adding, setAdding] = useState(false)

  const rot7 = getRotDays(7)
  const rot30 = getRotDays(30)

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-wide text-slate-100">Rot Logger</h3>
          <p className="text-xs text-slate-400">Track unstructured, unproductive blocks of time to adjust scheduling weights.</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusIcon /> Log Rot
          </button>
        )}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 gap-4 bg-slate-900/30 p-4 border border-slate-800 rounded-2xl shadow-inner">
        <div className="text-center p-2">
          <div className="text-2xl font-black text-rose-450 drop-shadow-[0_0_8px_rgba(244,63,94,0.2)]">{rot7}</div>
          <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">Last 7 Days</div>
        </div>
        <div className="text-center p-2 border-l border-slate-850">
          <div className="text-2xl font-black text-rose-450 drop-shadow-[0_0_8px_rgba(244,63,94,0.2)]">{rot30}</div>
          <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">Last 30 Days</div>
        </div>
      </div>

      {adding && (
        <div className="bg-slate-955 border border-slate-800 rounded-2xl p-4">
          <RotEditor
            tasks={tasks}
            onSave={(entry) => {
              addEntry(entry)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* Log list */}
      <div className="space-y-2">
        {entries
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((entry) => (
            <div
              key={entry.id}
              className="flex justify-between items-center py-3.5 px-4 bg-slate-950/40 hover:bg-slate-900 rounded-2xl border border-slate-800/80 shadow-sm transition-all"
            >
              <div className="space-y-1.5 flex-1 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-205 text-[15px] flex items-center gap-1.5">
                    <CalendarIcon />
                    {entry.date}
                  </span>
                  {entry.startTime !== undefined && entry.endTime !== undefined && (
                    <span className="inline-flex text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-400">
                      {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                    </span>
                  )}
                </div>
                
                <div className="text-xs font-semibold text-slate-400">
                  <span className="text-rose-400 font-bold">{entry.suspendedTaskIds.length} tasks suspended</span>
                  {entry.note && (
                    <span className="text-slate-500 ml-1.5">— {entry.note}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => deleteEntry(entry.id)}
                className="p-1.5 rounded-lg text-slate-450 hover:bg-rose-955/25 hover:text-rose-400 transition-all cursor-pointer"
                title="Delete entry"
              >
                <TrashIcon />
              </button>
            </div>
          ))}

        {entries.length === 0 && !adding && (
          <p className="text-sm italic text-slate-500 py-4">
            No rot logged yet. Great job!
          </p>
        )}
      </div>
    </div>
  )
}

function RotEditor({
  tasks,
  onSave,
  onCancel,
}: {
  tasks: { id: string; title: string }[]
  onSave: (entry: RotEntry) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [suspendedTaskIds, setSuspendedTaskIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [taskSearch, setTaskSearch] = useState('')

  const filtered = tasks.filter(
    (t) => t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !suspendedTaskIds.includes(t.id)
  )

  const fromTimeStr = (str: string) => {
    const [h, m] = str.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const handleSave = () => {
    if (!date) return
    onSave({
      id: crypto.randomUUID(),
      date,
      startTime: startTime ? fromTimeStr(startTime) : undefined,
      endTime: endTime ? fromTimeStr(endTime) : undefined,
      suspendedTaskIds,
      note: note || undefined,
    })
  }

  return (
    <div className="space-y-4">
      {/* Date and times */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/30 p-3.5 border border-slate-800 rounded-xl">
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-1">
            Start Time (optional)
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-1">
            End Time (optional)
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="text-xs px-2.5 py-1.5 w-full bg-slate-955 border border-slate-800 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Note
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened? e.g. Doomscrolling on social media"
          className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-rose-500/20 focus:outline-none placeholder-slate-500"
        />
      </div>

      {/* Suspended tasks checklist */}
      <div className="space-y-3 pl-4 border-l-2 border-rose-500 bg-rose-955/5 p-3 rounded-2xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Suspended Tasks
        </span>

        {/* Selected Tasks */}
        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
          {suspendedTaskIds.map((tid) => {
            const task = tasks.find((t) => t.id === tid)
            return (
              <div
                key={tid}
                className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-lg"
              >
                <span className="text-xs font-semibold text-slate-300">
                  {task?.title ?? tid}
                </span>
                <button
                  onClick={() => setSuspendedTaskIds(suspendedTaskIds.filter((id) => id !== tid))}
                  className="p-1 rounded text-slate-400 hover:bg-rose-955/25 hover:text-rose-455 transition-all cursor-pointer"
                >
                  <XIcon />
                </button>
              </div>
            )
          })}
        </div>

        {/* Search & Add */}
        <div className="relative">
          <input
            type="text"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Search tasks to mark suspended..."
            className="w-full text-xs px-3 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-slate-205 focus:ring-2 focus:ring-rose-500/20 focus:outline-none placeholder-slate-500"
          />
          {taskSearch && filtered.length > 0 && (
            <div className="absolute z-20 w-full mt-1.5 max-h-40 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-1.5 divide-y divide-slate-850">
              {filtered.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSuspendedTaskIds([...suspendedTaskIds, t.id])
                    setTaskSearch('')
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-cyan-400 hover:bg-slate-850/50 cursor-pointer rounded-lg transition-all"
                >
                  {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-start gap-2 border-t border-slate-800 pt-4 mt-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 transition-all cursor-pointer active:scale-95"
        >
          <CheckIcon /> Save Rot Log
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-955 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all cursor-pointer"
        >
          Discard
        </button>
      </div>
    </div>
  )
}

export default RotPanel
