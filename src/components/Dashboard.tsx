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
import type { AdhocTask, AnchorConfirmation } from '../types/scheduler'
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
  const [showAnchorConfirm, setShowAnchorConfirm] = useState(false)

  const buildContext = (): ResolveContext => ({
    tasks: JSON.parse(JSON.stringify(tasks)), // deep copy
    anchors: JSON.parse(JSON.stringify(anchors)),
    blocks,
    routines,
    obligations,
    recoveryPlans,
    dayPlans,
    weekPlan: weekPlan.days,
    calendarEvents,
  })

  // Auto-resolve on mount and when dependencies change
  useEffect(() => {
    scheduler.resolve(buildContext())
  }, [tasks, anchors, blocks, routines, obligations, recoveryPlans, dayPlans, weekPlan, calendarEvents, scheduler.confirmedAnchors, scheduler.adhocTasks, scheduler.skippedTaskIds])

  const schedule = scheduler.schedule
  const daySchedule = schedule?.days[selectedDay]

  return (
    <div>
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
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{daySchedule.dayPlanName}</strong>
              <span style={{ fontSize: 12, marginLeft: 8 }}>{daySchedule.date}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAnchorConfirm(!showAnchorConfirm)}>
                Confirm Anchor
              </button>
              <button onClick={() => setShowAdhocForm(!showAdhocForm)}>
                + Ad-hoc Task
              </button>
            </div>
          </div>

          {/* Anchor confirmation */}
          {showAnchorConfirm && (
            <AnchorConfirmForm
              anchors={anchors}
              day={selectedDay}
              onConfirm={(conf) => {
                scheduler.confirmAnchor(conf)
                setShowAnchorConfirm(false)
              }}
              onCancel={() => setShowAnchorConfirm(false)}
            />
          )}

          {/* Adhoc task form */}
          {showAdhocForm && (
            <AdhocTaskForm
              day={selectedDay}
              onAdd={(task) => {
                scheduler.addAdhocTask(task)
                setShowAdhocForm(false)
              }}
              onCancel={() => setShowAdhocForm(false)}
            />
          )}

          {/* Timeline */}
          <div>
            {daySchedule.items.length === 0 && (
              <p style={{ fontSize: 12, fontStyle: 'italic' }}>No tasks scheduled.</p>
            )}
            {daySchedule.items.map((item, i) => (
              <div
                key={`${item.taskId}-${i}`}
                style={{
                  borderTop: '1px solid #ccc',
                  padding: '8px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingLeft: item.isBackground ? 20 : 0,
                  fontStyle: item.isBackground ? 'italic' : 'normal',
                  opacity: scheduler.skippedTaskIds.includes(item.taskId) ? 0.4 : 1,
                }}
              >
                <div>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, marginRight: 8 }}>
                    {formatTime(item.startMinutes)}–{formatTime(item.endMinutes)}
                  </span>
                  <span>{item.isBackground ? '~ ' : ''}{item.title}</span>
                  <span style={{ fontSize: 11, marginLeft: 8 }}>
                    [{item.source}] w:{Math.round(item.weight)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {!scheduler.skippedTaskIds.includes(item.taskId) && (
                    <button onClick={() => scheduler.skipTask(item.taskId)} style={{ fontSize: 11 }}>skip</button>
                  )}
                  {scheduler.skippedTaskIds.includes(item.taskId) && (
                    <button onClick={() => scheduler.unskipTask(item.taskId)} style={{ fontSize: 11 }}>unskip</button>
                  )}
                  {item.source === 'adhoc' && (
                    <button onClick={() => scheduler.removeAdhocTask(item.taskId)} style={{ fontSize: 11 }}>x</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Confirmed anchors for this day */}
          {daySchedule.confirmedAnchors.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12 }}>
              <strong>Confirmed:</strong>
              {daySchedule.confirmedAnchors.map((c, i) => {
                const anchor = anchors.find((a) => a.id === c.anchorId)
                return (
                  <span key={i} style={{ marginLeft: 8 }}>
                    {anchor?.name ?? c.anchorId} @ {formatTime(c.actualTime)}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function AnchorConfirmForm({
  anchors,
  day,
  onConfirm,
  onCancel,
}: {
  anchors: { id: string; name: string }[]
  day: number
  onConfirm: (conf: AnchorConfirmation) => void
  onCancel: () => void
}) {
  const [anchorId, setAnchorId] = useState('')
  const [time, setTime] = useState('')

  const fromTimeStr = (str: string) => {
    const [h, m] = str.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  return (
    <div style={{ border: '1px solid #999', padding: 8, marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={anchorId} onChange={(e) => setAnchorId(e.target.value)}>
          <option value="">-- anchor --</option>
          {anchors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <button onClick={() => {
          if (anchorId && time) onConfirm({ anchorId, actualTime: fromTimeStr(time), day })
        }}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
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

  const fromTimeStr = (str: string) => {
    const [h, m] = str.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

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
            onAdd({ id: crypto.randomUUID(), title, durationMinutes: duration, startTime: fromTimeStr(startTime), day, weight })
          }
        }}>Add</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default Dashboard
