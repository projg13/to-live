import { useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { snapshotToGitHub, restoreFromGitHub } from '../backup'

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

  const isSettingsComplete = githubOwner.trim() !== '' && githubRepo.trim() !== '' && githubToken.trim() !== ''

  const handleBackup = async () => {
    if (!isSettingsComplete) return
    setLoading(true)
    setStatus(null)
    try {
      await snapshotToGitHub()
      setStatus({ type: 'success', message: 'Backup successfully uploaded to GitHub!' })
    } catch (err: any) {
      console.error(err)
      setStatus({ type: 'error', message: `Backup failed: ${err.message || err}` })
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!isSettingsComplete) return
    setLoading(true)
    setStatus(null)
    try {
      await restoreFromGitHub()
      // Note: page will reload on success, so we only handle failures here
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
        <p className="text-xs text-slate-400">Configure your repository to backup and restore app states.</p>
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
              Last backup: {new Date(lastSnapshotAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-slate-500 italic">Last backup: never</span>
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
            title={!isSettingsComplete ? "Complete settings first" : "Upload local state to GitHub repository"}
          >
            {loading ? 'Processing...' : 'Backup now'}
          </button>

          <button
            onClick={handleRestore}
            disabled={!isSettingsComplete || loading}
            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer select-none border ${
              isSettingsComplete && !loading
                ? 'border-cyan-500 text-cyan-400 hover:bg-cyan-950/20 active:scale-95'
                : 'border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title={!isSettingsComplete ? "Complete settings first" : "Restore state from state.json on GitHub"}
          >
            Restore
          </button>
        </div>

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
