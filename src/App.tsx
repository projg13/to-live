import { useState } from 'react'
import AnchorPanel from './components/AnchorPanel'
import Dashboard from './components/Dashboard'
import TaskPanel from './components/TaskPanel'
import BlockPanel from './components/BlockPanel'
import RoutinePanel from './components/RoutinePanel'
import ObligationPanel from './components/ObligationPanel'
import DayPlannerPanel from './components/DayPlannerPanel'
import EventPanel from './components/EventPanel'
import RecoveryPanel from './components/RecoveryPanel'
import RotPanel from './components/RotPanel'
import SettingsPanel from './components/SettingsPanel'
import { resetAllStores } from './stateIO'

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
  'Settings',
] as const

type ManagePanel = (typeof managePanels)[number]

function App() {
  const [tab, setTab] = useState<'dashboard' | 'manage'>('manage')
  const [activePanel, setActivePanel] = useState<ManagePanel>('Anchors')

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans pb-10 transition-colors duration-300">
      {/* Top Segmented Controls */}
      <header className="border-b border-slate-900/60 bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <nav className="flex justify-center p-1 bg-slate-950/90 rounded-2xl max-w-sm mx-auto border border-slate-800/80 shadow-inner">
          <button
            onClick={() => setTab('dashboard')}
            className={`flex-1 py-1.5 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95 ${
              tab === 'dashboard'
                ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`flex-1 py-1.5 text-center text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95 ${
              tab === 'manage'
                ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manage
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full text-base">
        {tab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Dashboard />
          </div>
        )}
        {tab === 'manage' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Sub-panel tabs */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-900/60">
              {managePanels.map((panel) => {
                const isActive = activePanel === panel
                return (
                  <button
                    key={panel}
                    onClick={() => setActivePanel(panel)}
                    className={`px-4 py-2 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all shadow-sm border cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 border-transparent text-white shadow-lg shadow-purple-950/40'
                        : 'bg-slate-950/60 text-slate-400 border-slate-900 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    {panel}
                  </button>
                )
              })}
            </div>

            {/* Panel views in a themed slate card */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-950/20">
              {activePanel === 'Anchors' && <AnchorPanel />}
              {activePanel === 'Day Planner' && <DayPlannerPanel />}
              {activePanel === 'Tasks' && <TaskPanel />}
              {activePanel === 'Blocks' && <BlockPanel />}
              {activePanel === 'Routines' && <RoutinePanel />}
              {activePanel === 'Obligations' && <ObligationPanel />}
              {activePanel === 'Events' && <EventPanel />}
              {activePanel === 'Recovery Plans' && <RecoveryPanel />}
              {activePanel === 'Rot' && <RotPanel />}
              {activePanel === 'Settings' && <SettingsPanel />}
            </div>
          </div>
        )}
      </main>

      {/* Factory reset */}
      <footer className="mt-8 border-t border-slate-900/60 pt-6 text-center">
        <button
          onClick={() => {
            if (confirm('Clear ALL data and reload? This cannot be undone.')) {
              resetAllStores()
            }
          }}
          className="px-5 py-2.5 rounded-2xl text-xs font-bold tracking-wider uppercase text-white bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-md shadow-rose-950/30 border border-transparent transition-all cursor-pointer"
        >
          Factory Reset
        </button>
      </footer>
    </div>
  )
}

export default App
