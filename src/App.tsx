import { useState } from 'react'
import AnchorPanel from './components/AnchorPanel'
import DayPlanner from './components/DayPlanner'
import TaskPanel from './components/TaskPanel'
import BlockPanel from './components/BlockPanel'
import RoutinePanel from './components/RoutinePanel'

const managePanels = [
  'Tasks',
  'Blocks',
  'Routines',
  'Anchors',
  'Day Planner',
  'Obligations',
  'Recovery Plans',
  'Events',
  'Rot',
] as const

type ManagePanel = (typeof managePanels)[number]

function App() {
  const [tab, setTab] = useState<'dashboard' | 'manage'>('manage')
  const [activePanel, setActivePanel] = useState<ManagePanel>('Anchors')

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100">
      {/* Top Tab Bar */}
      <nav className="flex border-b border-gray-300 dark:border-gray-700">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex-1 py-4 text-center font-medium ${
            tab === 'dashboard' ? 'border-b-2 border-gray-900 dark:border-white' : ''
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setTab('manage')}
          className={`flex-1 py-4 text-center font-medium ${
            tab === 'manage' ? 'border-b-2 border-gray-900 dark:border-white' : ''
          }`}
        >
          Manage
        </button>
      </nav>

      {/* Content */}
      <main className="p-4 md:p-6 max-w-3xl mx-auto w-full">
        {tab === 'dashboard' && <p>Dashboard (coming soon)</p>}
        {tab === 'manage' && (
          <div>
            {/* Sub-panel tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {managePanels.map((panel) => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    activePanel === panel
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {panel}
                </button>
              ))}
            </div>

            {activePanel === 'Anchors' && <AnchorPanel />}
            {activePanel === 'Day Planner' && <DayPlanner />}
            {activePanel === 'Tasks' && <TaskPanel />}
            {activePanel === 'Blocks' && <BlockPanel />}
            {activePanel === 'Routines' && <RoutinePanel />}
            {!['Anchors', 'Day Planner', 'Tasks', 'Blocks', 'Routines'].includes(activePanel) && (
              <p>Hello World - {activePanel}</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
