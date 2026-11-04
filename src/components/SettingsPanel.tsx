import { useState, useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useSchedulerStore } from '../store/schedulerStore'
import { resetAllStores, exportFullState, exportDefaults, importFullState, downloadJSON, loadJSONFile } from '../stateIO'
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

  const scheduler = useSchedulerStore()

  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  // Patch 0012: Direct Mobile/Browser GitHub Source Code Pusher state
  const [targetBranch, setTargetBranch] = useState('refactor/exact-fit-v0012')
  const [commitMessage, setCommitMessage] = useState(
    'feat: Exact-Fit Solver, Task Templates, Routine Slot UI & Live Simulator (Patches 0001-0012)'
  )
  const [pushingCode, setPushingCode] = useState(false)
  const [pushProgress, setPushProgress] = useState<string | null>(null)
  const [pushResult, setPushResult] = useState<{
    type: 'success' | 'error'
    message: string
    commitUrl?: string
    prUrl?: string
  } | null>(null)

  // Default owner/repo to projg13/to-live if blank so mobile users don't have to type them
  useEffect(() => {
    if (!githubOwner.trim()) setGithubOwner('projg13')
    if (!githubRepo.trim()) setGithubRepo('to-live')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSettingsComplete =
    githubOwner.trim() !== '' && githubRepo.trim() !== '' && githubToken.trim() !== ''

  useEffect(() => {
    if (isSettingsComplete) {
      startHourlyBackup()
    }
  }, [isSettingsComplete])

  const handlePushSourceCodeToGitHub = async () => {
    const owner = githubOwner.trim() || 'projg13'
    const repo = githubRepo.trim() || 'to-live'
    const token = githubToken.trim()
    const branch = targetBranch.trim() || 'refactor/exact-fit-v0012'
    if (!token) {
      setPushResult({
        type: 'error',
        message: 'Please paste your GitHub Personal Access Token (PAT) first.',
      })
      return
    }

    const rawSources: Record<string, string> | undefined = (window as any).__TO_LIVE_RAW_SOURCES__
    if (!rawSources || Object.keys(rawSources).length === 0) {
      setPushResult({
        type: 'error',
        message: 'Embedded source bundle not found in window.__TO_LIVE_RAW_SOURCES__.',
      })
      return
    }

    setPushingCode(true)
    setPushResult(null)
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    }
    const apiBase = `https://api.github.com/repos/${owner}/${repo}`

    try {
      // 1. Find default/base branch commit SHA (try targetBranch first, then main, then master)
      setPushProgress('Step 1/4: Fetching base branch commit from GitHub...')
      let baseCommitSha = ''
      let baseBranchUsed = 'main'
      for (const candidateBranch of [branch, 'main', 'master']) {
        const refRes = await fetch(`${apiBase}/git/ref/heads/${candidateBranch}`, { headers })
        if (refRes.ok) {
          const refJson = await refRes.json()
          baseCommitSha = refJson.object?.sha
          baseBranchUsed = candidateBranch
          if (baseCommitSha) break
        }
      }
      if (!baseCommitSha) {
        throw new Error(
          `Could not read base branch (main/master) on ${owner}/${repo}. Verify your token has Repo Contents write permission.`
        )
      }

      // Fetch base commit to get its tree SHA
      const commitRes = await fetch(`${apiBase}/git/commits/${baseCommitSha}`, { headers })
      if (!commitRes.ok) {
        throw new Error(`Failed to read base commit ${baseCommitSha}: HTTP ${commitRes.status}`)
      }
      const commitJson = await commitRes.json()
      const baseTreeSha = commitJson.tree?.sha

      // 2. Create a single Git Tree with all 24 refactored files
      const fileEntries = Object.entries(rawSources)
      setPushProgress(`Step 2/4: Uploading ${fileEntries.length} refactored source files to Git Tree...`)
      const treePayload = {
        base_tree: baseTreeSha,
        tree: fileEntries.map(([path, content]) => ({
          path,
          mode: '100644',
          type: 'blob',
          content,
        })),
      }
      const treeRes = await fetch(`${apiBase}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify(treePayload),
      })
      if (!treeRes.ok) {
        const errText = await treeRes.text()
        throw new Error(`Git Tree creation failed (${treeRes.status}): ${errText}`)
      }
      const newTree = await treeRes.json()

      // 3. Create the Git Commit
      setPushProgress('Step 3/4: Creating Git commit...')
      const newCommitRes = await fetch(`${apiBase}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: commitMessage.trim() || 'feat: apply Patches 0001-0012 refactor',
          tree: newTree.sha,
          parents: [baseCommitSha],
        }),
      })
      if (!newCommitRes.ok) {
        const errText = await newCommitRes.text()
        throw new Error(`Git Commit creation failed (${newCommitRes.status}): ${errText}`)
      }
      const newCommit = await newCommitRes.json()

      // 4. Update existing branch ref or create new branch ref
      setPushProgress(`Step 4/4: Updating branch refs/heads/${branch}...`)
      const checkTargetRef = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers })
      if (checkTargetRef.ok) {
        const patchRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sha: newCommit.sha, force: false }),
        })
        if (!patchRes.ok) {
          const errText = await patchRes.text()
          throw new Error(`Updating branch ${branch} failed (${patchRes.status}): ${errText}`)
        }
      } else {
        const createRefRes = await fetch(`${apiBase}/git/refs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ref: `refs/heads/${branch}`,
            sha: newCommit.sha,
          }),
        })
        if (!createRefRes.ok) {
          const errText = await createRefRes.text()
          throw new Error(`Creating branch ${branch} failed (${createRefRes.status}): ${errText}`)
        }
      }

      setPushProgress(null)
      const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`
      const prUrl =
        branch !== baseBranchUsed
          ? `https://github.com/${owner}/${repo}/compare/${baseBranchUsed}...${branch}?expand=1`
          : `https://github.com/${owner}/${repo}/tree/${branch}`
      setPushResult({
        type: 'success',
        message: `Pushed ${fileEntries.length} refactored files to ${owner}/${repo} on branch "${branch}" (commit ${newCommit.sha.slice(0, 7)})!`,
        commitUrl,
        prUrl,
      })
    } catch (err: any) {
      setPushProgress(null)
      setPushResult({
        type: 'error',
        message: err?.message || String(err),
      })
    } finally {
      setPushingCode(false)
    }
  }

  const handleBackup = async () => {
    if (!isSettingsComplete) return
    setLoading(true)
    setStatus(null)
    try {
      await snapshotToGitHub()
      setStatus({ type: 'success', message: 'Snapshot saved to GitHub!' })
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
    <div className="space-y-8">
      {/* Patch 0012: One-Click Push Refactored Source Code to GitHub (Mobile / No PC Needed) */}
      <div className="space-y-4">
        <div className="border-b border-cyan-800/50 pb-2">
          <h3 className="text-lg font-black tracking-wide text-cyan-400">
            🚀 Push Refactored Codebase to GitHub (No PC Required)
          </h3>
          <p className="text-xs text-slate-300">
            Directly commits all 24 refactored TypeScript/React files (Patches 0001–0012) from your browser/phone to your GitHub repository via the GitHub Git Trees API.
          </p>
        </div>

        <div className="bg-cyan-950/15 border border-cyan-800/40 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                GitHub Owner
              </label>
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="projg13"
                className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Repository Name
              </label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="to-live"
                className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                GitHub Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="Paste your GitHub token..."
                className="text-sm px-3.5 py-2 w-full bg-slate-950 border border-cyan-800/50 rounded-xl text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Target Branch (e.g. main or new branch)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  placeholder="refactor/exact-fit-v0012 or main"
                  className="text-sm px-3 py-2 flex-1 bg-slate-950 border border-amber-800/50 rounded-xl text-amber-300 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTargetBranch('main')}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                >
                  main
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Commit Message
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="text-xs px-3.5 py-2 w-full bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handlePushSourceCodeToGitHub}
              disabled={pushingCode || !githubToken.trim()}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                !pushingCode && githubToken.trim()
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/40 active:scale-95'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {pushingCode
                ? '⏳ Pushing 24 Refactored Files...'
                : `🚀 Push Refactored Code to ${githubOwner || 'projg13'}/${githubRepo || 'to-live'} (${targetBranch})`}
            </button>

            <button
              type="button"
              onClick={handleBackup}
              disabled={!isSettingsComplete || loading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                isSettingsComplete && !loading
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-700/50'
                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
              }`}
            >
              💾 Also Snapshot Migrated State JSON
            </button>
          </div>

          {pushProgress && (
            <div className="p-3 rounded-xl bg-slate-950 border border-cyan-800/40 text-xs font-mono text-cyan-300 animate-pulse">
              {pushProgress}
            </div>
          )}

          {pushResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                pushResult.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-700/50 text-rose-300'
              }`}
            >
              <div className="font-bold">{pushResult.message}</div>
              {pushResult.commitUrl && (
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href={pushResult.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    🔗 View Commit on GitHub →
                  </a>
                  {pushResult.prUrl && (
                    <a
                      href={pushResult.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold text-amber-300 hover:text-amber-200"
                    >
                      🔀 Open / Merge Pull Request on GitHub →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Schedule Controls */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="text-lg font-black tracking-wide text-slate-100">Schedule Controls</h3>
          <p className="text-xs text-slate-400">Reset schedule, toggle debug mode.</p>
        </div>
        <div className="flex flex-wrap gap-3 bg-slate-950/20 p-5 border border-slate-800/80 rounded-2xl">
          <button
            onClick={() => scheduler.clearSchedule()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-950/65 hover:bg-slate-900 text-rose-400 transition-all border border-slate-850 active:scale-95 cursor-pointer"
          >
            🗑️ Reset Schedule
          </button>
          <button
            onClick={() => scheduler.toggleDebug()}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border active:scale-95 cursor-pointer ${
              scheduler.debugMode
                ? 'bg-amber-950/30 text-amber-400 border-amber-800/40'
                : 'bg-slate-950/65 text-slate-500 border-slate-850 hover:bg-slate-900'
            }`}
          >
            🔍 {scheduler.debugMode ? 'Debug ON' : 'Debug OFF'}
          </button>
        </div>
      </div>

      {/* State Management */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="text-lg font-black tracking-wide text-slate-100">State Management</h3>
          <p className="text-xs text-slate-400">Export, import, or reset your app configuration.</p>
        </div>
        <div className="flex flex-wrap gap-3 bg-slate-950/20 p-5 border border-slate-800/80 rounded-2xl">
          <button
            onClick={() => {
              const snapshot = exportFullState()
              const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
              downloadJSON(snapshot, `to-live-state-${ts}.json`)
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-950/30 hover:bg-cyan-900/30 text-cyan-400 border border-cyan-800/30 transition-all active:scale-95 cursor-pointer"
          >
            📤 Export State
          </button>
          <button
            onClick={async () => {
              try {
                const snapshot = await loadJSONFile()
                importFullState(snapshot)
              } catch (err: any) {
                setStatus({ type: 'error', message: `Import failed: ${err.message}` })
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-950/30 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-800/30 transition-all active:scale-95 cursor-pointer"
          >
            📥 Import State
          </button>
          <button
            onClick={() => {
              const snapshot = exportDefaults()
              downloadJSON(snapshot, 'to-live-defaults.json')
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-950/65 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
          >
            💾 Save Defaults
          </button>
          <button
            onClick={async () => {
              try {
                const snapshot = await loadJSONFile()
                importFullState(snapshot)
              } catch (err: any) {
                setStatus({ type: 'error', message: `Load defaults failed: ${err.message}` })
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-950/65 hover:bg-slate-900 text-slate-400 border border-slate-850 transition-all active:scale-95 cursor-pointer"
          >
            📂 Load Defaults
          </button>
        </div>
      </div>

      {/* GitHub State Backup */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="text-lg font-black tracking-wide text-slate-100">GitHub State Backup (Hourly Snapshots)</h3>
          <p className="text-xs text-slate-400">Auto-saves every hour. Keeps 5 rotating restore points.</p>
        </div>

        <div className="space-y-4 max-w-md bg-slate-950/20 p-5 border border-slate-800/80 rounded-2xl">
          <div className="text-xs text-slate-500">
            {lastSnapshotAt ? (
              <span className="text-cyan-400 font-semibold">
                Last snapshot: {new Date(lastSnapshotAt).toLocaleString()}
              </span>
            ) : (
              <span className="text-slate-500 italic">Last snapshot: never</span>
            )}
          </div>

          <div className="flex gap-3 pt-1">
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
                      className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-amber-950/30 text-amber-400 border border-amber-800/30 hover:bg-amber-900/40 active:scale-95 transition-all cursor-pointer"
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

      {/* Factory Reset — double confirm */}
      <div className="space-y-4">
        <div className="border-b border-rose-900/40 pb-2">
          <h3 className="text-lg font-black tracking-wide text-rose-400">Danger Zone</h3>
          <p className="text-xs text-slate-400">Irreversible actions. Think twice.</p>
        </div>
        <div className="bg-rose-950/10 border border-rose-900/30 rounded-2xl p-5">
          {!confirmingReset ? (
            <button
              onClick={() => setConfirmingReset(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase text-rose-400 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 active:scale-95 transition-all cursor-pointer"
            >
              Factory Reset
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-rose-300 font-bold">
                ⚠️ This will clear ALL data and reload the app. This cannot be undone.
              </p>
              <p className="text-xs text-slate-400">
                Make sure you have a snapshot saved before proceeding.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => resetAllStores()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase text-white bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-md shadow-rose-950/30 transition-all cursor-pointer"
                >
                  Yes, Delete Everything
                </button>
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
