const hours = Array.from({ length: 18 }, (_, i) => i + 5) // 5 AM to 10 PM

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function Timetable() {
  const now = new Date()
  const currentHour = now.getHours()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Today</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {hours.map((hour) => (
          <div
            key={hour}
            className={`flex items-stretch border-t border-gray-200 dark:border-gray-700 ${
              hour === currentHour ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            {/* Time label */}
            <div className="w-16 shrink-0 py-3 pr-3 text-right text-xs text-gray-400 dark:text-gray-500 font-mono">
              {formatHour(hour)}
            </div>

            {/* Slot area */}
            <div className="flex-1 min-h-[3rem] py-2 pl-3 border-l border-gray-300 dark:border-gray-600">
              {hour === currentHour && (
                <div className="text-xs text-blue-500 font-medium">-- now --</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Timetable
