import { useState } from 'react'
import AnchorPanel from './components/AnchorPanel'
import AdhocPanel from './components/AdhocPanel'
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
import MenuPanel from './components/MenuPanel'

interface ManageItem {
  id: string
  label: string
  icon: string
  category: 'core' | 'schedule' | 'resilience'
}

const manageItems: ManageItem[] = [
  // Building Blocks
  { id: 'Anchors', label: 'Anchors', icon: '🎯', category: 'core' },
  { id: 'Blocks', label: 'Blocks', icon: '⏱️', category: 'core' },
  { id: 'Tasks', label: 'Tasks', icon: '⚡', category: 'core' },
  { id: 'Routines', label: 'Routines', icon: '🔄', category: 'core' },
  // Schedules & Events
  { id: 'Day Planner', label: 'Day Planner', icon: '📅', category: 'schedule' },
  { id: 'Obligations', label: 'Obligations', icon: '📋', category: 'schedule' },
  { id: 'Events', label: 'Events', icon: '🗓️', category: 'schedule' },
  { id: 'Ad Hoc', label: 'Ad Hoc', icon: '⏳', category: 'schedule' },
  // System & Resilience
  { id: 'Recovery Plans', label: 'Recovery Plans', icon: '🛡️', category: 'resilience' },
  { id: 'Rot', label: 'Rot Track', icon: '🍂', category: 'resilience' },
  { id: 'Settings', label: 'Settings', icon: '⚙️', category: 'resilience' },
]

type ManagePanel = (typeof manageItems)[number]['id']

function App() {
  const [tab, setTab] = useState<'dashboard' | 'manage' | 'menu'>('dashboard')
  const [activePanel, setActivePanel] = useState<ManagePanel>('Anchors')

  const categories = [
    { key: 'core', title: 'Building Blocks' },
    { key: 'schedule', title: 'Schedules & Events' },
    { key: 'resilience', title: 'Resilience & System' },
  ] as const

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans pb-12 transition-colors duration-300">
      {/* Top Segmented Controls */}
      <header className="border-b border-slate-900/80 bg-[#0b0f19]/85 backdrop-blur-xl sticky top-0 z-30 px-4 py-3 shadow-sm shadow-slate-950/40">
        <nav className="flex justify-center p-1 bg-slate-950/90 rounded-2xl max-w-lg mx-auto border border-slate-800/80 shadow-inner">
          <button
            onClick={() => setTab('dashboard')}
            className={`flex-1 py-2 px-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
              tab === 'dashboard'
                ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-750'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <span>📊</span> Dashboard
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`flex-1 py-2 px-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
              tab === 'manage'
                ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-750'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <span>🎛️</span> Manage
          </button>
          <button
            onClick={() => setTab('menu')}
            className={`flex-1 py-2 px-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
              tab === 'menu'
                ? 'bg-slate-900 text-cyan-400 shadow-md shadow-cyan-950/40 border border-slate-750'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <span>🥗</span> Menu
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full text-base">
        {tab === 'dashboard' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Dashboard />
          </div>
        )}

        {tab === 'manage' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Mobile Scrollable Horizontal Bar (Single row, never wraps) */}
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar p-1.5 bg-slate-950/80 rounded-2xl border border-slate-850">
              {manageItems.map((item) => {
                const isActive = activePanel === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePanel(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Desktop 2-Column Sidebar Layout */}
            <div className="md:grid md:grid-cols-[210px_1fr] gap-6 items-start">
              {/* Left Sidebar Navigation */}
              <aside className="hidden md:flex flex-col gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-3xl p-3.5 sticky top-20 shadow-lg shadow-slate-950/20">
                {categories.map((cat) => (
                  <div key={cat.key} className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2.5 block">
                      {cat.title}
                    </span>
                    <div className="space-y-0.5">
                      {manageItems
                        .filter((item) => item.category === cat.key)
                        .map((item) => {
                          const isActive = activePanel === item.id
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActivePanel(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer relative ${
                                isActive
                                  ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-800/50 shadow-sm shadow-cyan-950/30'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
                              }`}
                            >
                              <span className="text-sm">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-auto shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                              )}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </aside>

              {/* Main Panel View Card */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-950/20 min-w-0">
                {activePanel === 'Anchors' && <AnchorPanel />}
                {activePanel === 'Ad Hoc' && <AdhocPanel />}
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
          </div>
        )}

        {tab === 'menu' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <MenuPanel />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
