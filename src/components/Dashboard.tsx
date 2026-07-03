import { useState, useEffect } from 'react'
import { useSchedulerStore } from '../store/schedulerStore'
import { useTaskStore } from '../store/taskStore'
import { useAnchorStore } from '../store/anchorStore'
import { useBlockStore } from '../store/blockStore'
import { useRoutineStore } from '../store/routineStore'
import { useObligationStore } from '../store/obligationStore'
import { useRecoveryStore } from '../store/recoveryStore'
import { usePlannerStore } from '../store/plannerStore'
import { formatTime } from '../types/anchor'
import { findSlots } from './DayPlanner'
import type { AdhocTask, AnchorConfirmation, ScheduledItem } from '../types/scheduler'
import type { ResolveContext } from '../store/schedulerStore'

function Dashboard() {
  const scheduler = useSchedulerStore()
  const { tasks } = useTaskStore()
  const { anchors } = useAnchorStore()
  const { blocks } = useBlockStore()
  const { routines } = useRoutineStore()
  const { obligations } = useObligationStore()
  const { plans: recoveryPlans } = useRecoveryStore()
  const { dayPlans, weekPlan, calendarEvents } = usePlannerStore()

  const [selectedDay, setSelectedDay] = useState(0)
  const [showAdhocForm, setShowAdhocForm] = useState(false)
  const [virtualTime, setVirtualTime] = useState(360)
  const [showPrepone, setShowPrepone] = useState<string | null>(null)
  const [preponeTime, setPreponeTime] = useState('')
  const [showDoneAt, setShowDoneAt] = useState<string | null>(null)
  const [doneAtTime, setDoneAtTime] = useState('')

  const buildContext = (): ResolveContext => ({
    tasks: JSON.parse(JSON.stringify(tasks)),
    anchors: JSON.parse(JSON.stringify(anchors)),
    blocks,
    routines,
    obligations,
    recoveryPlans,
    dayPlans,
    weekPlan: weekPlan.days,
    calendarEvents,
  })

  useEffect(() => {
    scheduler.resolve(buildContext())
  }, [tasks, anchors, blocks, routines, obligations, recoveryPlans, dayPlans, weekPlan, calendarEvents, scheduler.confirmedAnchors, scheduler.adhocTasks, scheduler.skippedTaskIds, scheduler.doneTasks, scheduler.postponedTasks, scheduler.lastDoneAt])

  const schedule = scheduler.schedule
  const daySchedule = schedule?.days[selectedDay]

  const maxWeight = daySchedule
    ? Math.max(...daySchedule.items.map((i) => i.weight), 1)
    : 1

  // Build timeline: interleave anchors + tasks
  const slots = findSlots(anchors)
  const timelineItems: { type: 'anchor' | 'task'; time: number; data: any }[] = []

  // Add anchor markers
  for (const slot of slots) {
    timelineItems.push({ type: 'anchor', time: slot.startTime, data: slot })
  }

  // Add tasks
  if (daySchedule) {
    for (const item of daySchedule.items) {
      timelineItems.push({ type: 'task', time: item.startMinutes, data: item })
    }
  }

  // Sort by time
  timelineItems.sort((a, b) => a.time - b.time)

  return (
    <div>
      {/* Virtual time + controls */}
      <div style={{ marginBottom: 12, padding: 8, border: '1px solid #999' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Virtual Time: <strong>{formatTime(virtualTime)}</strong></span>
          <input
            type="range"
            min={0}
            max={1439}
            value={virtualTime}
            onChange={(e) => setVirtualTime(Number(e.target.value))}
            style={{ flex: 1, minWidth: 150 }}
          />
          <button onClick={() => scheduler.clearSchedule()}>Reset</button>
        </div>
      </div>

      {/* Week tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {schedule?.days.map((day, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            style={{
              padding: '6px 10px',
              fontWeight: selectedDay === i ? 'bold' : 'normal',
              borderBottom: selectedDay === i ? '2px solid #333' : 'none',
            }}
          >
            {i === 0 ? 'Today' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
          </button>
        )) ?? <span>Loading...</span>}
      </div>

      {daySchedule && (
        <div>
          {/* Day header */}
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{daySchedule.dayPlanName}</strong>
              <span style={{ fontSize: 12, marginLeft: 8 }}>{daySchedule.date}</span>
            </div>
            <button onClick={() => setShowAdhocForm(!showAdhocForm)}>+ Ad-hoc</button>
          </div>

          {showAdhocForm && (
            <AdhocTaskForm
              day={selectedDay}
              onAdd={(task) => { scheduler.addAdhocTask(task); setShowAdhocForm(false) }}
              onCancel={() => setShowAdhocForm(false)}
            />
          )}

          {/* Timeline: anchors + tasks interleaved */}
          <div>
            {timelineItems.length === 0 && (
              <p style={{ fontSize: 12, fontStyle: 'italic' }}>No items.</p>
            )}
            {timelineItems.map((entry, i) => {
              if (entry.type === 'anchor') {
                const slot = entry.data
                const conf = daySchedule.confirmedAnchors.find((c) => {
                  const a = anchors.find((an) => an.id === c.anchorId)
                  return a?.name === slot.anchorName
                })
                const anchor = anchors.find((a) => a.name === slot.anchorName)
                const displayTime = conf?.actualTime ?? slot.startTime

                return (
                  <div key={`anchor-${i}`} style={{
                    padding: '6px 0',
                    borderTop: '2px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {formatTime(displayTime)}
                    </span>
                    <strong>{slot.anchorName}</strong>
                    {/* Inline time edit for anchor */}
                    <input
                      type="time"
                      value={toTimeStr(displayTime)}
                      onChange={(e) => {
                        if (anchor && e.target.value) {
                          const [h, m] = e.target.value.split(':').map(Number)
                          scheduler.confirmAnchor({ anchorId: anchor.id, actualTime: (h || 0) * 60 + (m || 0), day: selectedDay })
                        }
                      }}
                      style={{ fontSize: 11, width: 90 }}
                    />
                    {conf && <span style={{ fontSize: 11 }}>(edited)</span>}
                  </div>
                )
              }

              // Task item
              const item: ScheduledItem = entry.data
              const isDone = scheduler.doneTasks.includes(item.taskId)
              const isPostponed = scheduler.postponedTasks.includes(item.taskId)
              const isSkipped = scheduler.skippedTaskIds.includes(item.taskId)
              const isCurrent = virtualTime >= item.startMinutes && virtualTime < item.endMinutes
              const weightPct = Math.round((item.weight / maxWeight) * 100)

              return (
                <div key={`task-${item.taskId}-${i}`}>
                  <div
                    style={{
                      borderTop: '1px solid #eee',
                      padding: '6px 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingLeft: item.isBackground ? 20 : 0,
                      fontStyle: item.isBackground ? 'italic' : 'normal',
                      opacity: (isSkipped || isDone || isPostponed) ? 0.4 : 1,
                      fontWeight: isCurrent ? 'bold' : 'normal',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 40, height: 12, border: '1px solid #999', position: 'relative' }}>
                        <div style={{ width: `${weightPct}%`, height: '100%', background: '#333' }} />
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {formatTime(item.startMinutes)}–{formatTime(item.endMinutes)}
                      </span>
                      <span>
                        {isCurrent && '> '}
                        {item.isBackground ? '~ ' : ''}
                        {item.title}
                        {isDone && ' [done]'}
                        {isPostponed && ' [postponed]'}
                      </span>
                      <span style={{ fontSize: 11 }}>w:{Math.round(item.weight)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!isDone && !isPostponed && !isSkipped && (
                        <>
                          <button onClick={() => setShowDoneAt(showDoneAt === item.taskId ? null : item.taskId)} style={{ fontSize: 11 }}>done</button>
                          <button onClick={() => scheduler.postpone(item.taskId)} style={{ fontSize: 11 }}>postpone</button>
                          <button onClick={() => setShowPrepone(showPrepone === item.taskId ? null : item.taskId)} style={{ fontSize: 11 }}>prepone</button>
                          <button onClick={() => scheduler.skipTask(item.taskId)} style={{ fontSize: 11 }}>skip</button>
                        </>
                      )}
                      {isSkipped && (
                        <button onClick={() => scheduler.unskipTask(item.taskId)} style={{ fontSize: 11 }}>unskip</button>
                      )}
                      {(isDone || isPostponed) && (
                        <button onClick={() => scheduler.unmarkTask(item.taskId)} style={{ fontSize: 11 }}>undo</button>
                      )}
                      {item.source === 'adhoc' && (
                        <button onClick={() => scheduler.removeAdhocTask(item.taskId)} style={{ fontSize: 11 }}>x</button>
                      )}
                    </div>
                  </div>

                  {/* Done at time picker */}
                  {showDoneAt === item.taskId && (
                    <div style={{ padding: '4px 0 8px 48px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12 }}>Done at:</span>
                      <input
                        type="time"
                        value={doneAtTime}
                        onChange={(e) => setDoneAtTime(e.target.value)}
                      />
                      <button onClick={() => {
                        if (doneAtTime) {
                          const [h, m] = doneAtTime.split(':').map(Number)
                          scheduler.markDoneAt(item.taskId, (h || 0) * 60 + (m || 0), selectedDay)
                        } else {
                          scheduler.markDone(item.taskId)
                        }
                        setShowDoneAt(null)
                        setDoneAtTime('')
                      }} style={{ fontSize: 11 }}>confirm</button>
                      <button onClick={() => {
                        scheduler.markDone(item.taskId)
                        setShowDoneAt(null)
                        setDoneAtTime('')
                      }} style={{ fontSize: 11 }}>now</button>
                      <button onClick={() => { setShowDoneAt(null); setDoneAtTime('') }} style={{ fontSize: 11 }}>cancel</button>
                    </div>
                  )}

                  {/* Prepone form */}
                  {showPrepone === item.taskId && (
                    <div style={{ padding: '4px 0 8px 48px', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12 }}>Move to:</span>
                      <input
                        type="time"
                        value={preponeTime}
                        onChange={(e) => setPreponeTime(e.target.value)}
                      />
                      <button onClick={() => {
                        if (preponeTime) {
                          const [h, m] = preponeTime.split(':').map(Number)
                          scheduler.preponeTask(item.taskId, (h || 0) * 60 + (m || 0), selectedDay)
                          setShowPrepone(null)
                          setPreponeTime('')
                        }
                      }} style={{ fontSize: 11 }}>move</button>
                      <button onClick={() => { setShowPrepone(null); setPreponeTime('') }} style={{ fontSize: 11 }}>cancel</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AdhocTaskForm({
  day,
  onAdd,
  onCancel,
}: {
  day: number
  onAdd: (task: AdhocTask) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [weight, setWeight] = useState(100)

  return (
    <div style={{ border: '1px solid #999', padding: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value) || 0)} style={{ width: 50 }} />
        <span style={{ fontSize: 12 }}>min</span>
        <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} style={{ width: 50 }} />
        <span style={{ fontSize: 12 }}>weight</span>
        <button onClick={() => {
          if (title && startTime) {
            const [h, m] = startTime.split(':').map(Number)
            onAdd({ id: crypto.randomUUID(), title, durationMinutes: duration, startTime: (h || 0) * 60 + (m || 0), day, weight })
          }
        }}>Add</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function toTimeStr(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export default Dashboard
