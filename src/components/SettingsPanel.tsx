import { useState, useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { snapshotToGitHub, listSnapshots, restoreFromSnapshot, restoreFromGitHub, startHourlyBackup, type SnapshotEntry } from '../backup'

function SettingsPanel() {
  const {
    githubOwner,
    githubRepo,
    githubToken,
    lastSnapshotAt,
    setGithubOwner,
    setGithubRepo,
    setGithubToken,
  } = useSettingsStore()

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)

  const isSettingsComplete = githubOwner.trim() !== '' && githubRepo.trim() !== '' && githubToken.trim() !== ''

  // Start hourly backup when settings are complete
  useEffect(() => {
    if (isSettingsComplete) {
      startHourlyBackup()
    }
  }, [isSettingsComplete])

  const handleBackup = async () => {
    if (!isSettingsComplete) return
    setLoading(true)
    setStatus(null)
    try {
      await snapshotToGitHub()
      setStatus({ type: 'success', message: 'Snapshot saved to GitHub!' })
      // Refresh snapshot list
      loadSnapshotList()
    } catch (err: any) {
      console.error(err)
      setStatus({ type: 'error', message: `Backup failed: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  const loadSnapshotList = async () => {
    if (!isSettingsComplete) return
    setLoadingSnapshots(true)
    try {
      const list = await listSnapshots()
      setSnapshots(list)
    } catch (err) {
      console.error('Failed to load snapshots:', err)
    } finally {
      setLoadingSnapshots(false)
    }
  }

  const handleRestore = async (filename: string) => {
    if (!isSettingsComplete) return
    setLoading(true)
    setStatus(null)
    try {
      await restoreFromSnapshot(filename)
    } catch (err: any) {
      console.error(err)
      setStatus({ type: 'error', message: `Restore failed: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  const handleLegacyRestore = async () => {
    if (!isSettingsComplete) return
    setLoading(true)
    setStatus(null)
    try {
      await restoreFromGitHub()
    } catch (err: any) {
      console.error(err)
      setStatus({ type: 'error', message: `Restore failed: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-2">
        <h3 className="text-lg font-black tracking-wide text-slate-100">GitHub State Backup</h3>
        <p className="text-xs text-slate-400">Auto-saves every hour. Keeps 5 rotating restore points.</p>
      </div>

      <div className="space-y-4 max-w-md bg-slate-950/20 p-5 border border-slate-800/80 rounded-2xl">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            GitHub Username/Owner
          </label>
          <input
            type="text"
            value={githubOwner}
            onChange={(e) => setGithubOwner(e.target.value)}
            placeholder="e.g. projg13"
            className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            GitHub Repository Name
          </label>
          <input
            type="text"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            placeholder="e.g. to-live"
            className="text-sm px-3.5 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            GitHub Personal Access Token (PAT)
          </label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            className="text-sm px-3.5 py-2 w-full bg-slate-955 border border-slate-800 rounded-xl text-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-500 border-t border-slate-850 pt-3">
          {lastSnapshotAt ? (
            <span className="text-cyan-400 font-semibold">
              Last snapshot: {new Date(lastSnapshotAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-500 italic">Last snapshot: never</span>
          )}
        </div>

        {!isSettingsComplete && (
          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider animate-pulse">
            ⚠️ Fill in Owner, Repo, and Token to enable backup/restore
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleBackup}
            disabled={!isSettingsComplete || loading}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer select-none ${
              isSettingsComplete && !loading
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-955 shadow-md shadow-cyan-950/20 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
            title="Save a snapshot now"
          >
            {loading ? 'Processing...' : 'Snapshot now'}
          </button>

          <button
            onClick={loadSnapshotList}
            disabled={!isSettingsComplete || loadingSnapshots}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer select-none border ${
              isSettingsComplete && !loadingSnapshots
                ? 'border-cyan-500 text-cyan-400 hover:bg-cyan-950/20 active:scale-95'
                : 'border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title="Load available restore points"
          >
            {loadingSnapshots ? 'Loading...' : 'Restore points'}
          </button>
        </div>

        {/* Restore Points List */}
        {snapshots.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Restore Points ({snapshots.length}/5)
            </div>
            {snapshots.map((snap) => {
              const age = Date.now() - new Date(snap.timestamp).getTime()
              const hoursAgo = Math.floor(age / (1000 * 60 * 60))
              const minsAgo = Math.floor(age / (1000 * 60))
              const timeAgo = hoursAgo > 0 ? `${hoursAgo}h ago` : `${minsAgo}m ago`

              return (
                <div
                  key={snap.slot}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-cyan-800/40 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md">
                        #{snap.slot}
                      </span>
                      <span className="text-xs font-semibold text-slate-300 truncate">
                        {new Date(snap.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 ml-7">
                      {timeAgo} · {snap.filename}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(snap.filename)}
                    disabled={loading}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-amber-950/30 text-amber-400 border border-amber-800/30 hover:bg-amber-900/40 active:scale-95 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                  >
                    Restore
                  </button>
                </div>
              )
            })}

            {/* Legacy restore fallback */}
            <button
              onClick={handleLegacyRestore}
              disabled={!isSettingsComplete || loading}
              className="w-full text-[10px] text-slate-500 hover:text-slate-300 py-1 cursor-pointer transition-colors"
            >
              ↩ Restore from legacy state.json
            </button>
          </div>
        )}

        {status && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs border ${
              status.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                : 'bg-rose-950/30 border-rose-800/40 text-rose-450'
            }`}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel
