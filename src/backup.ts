import { useSettingsStore } from './store/settingsStore'

const MAX_SNAPSHOTS = 5

// Serialize the full app state (all keys starting with 'to-live-')
export function serializeAppState(): string {
  const backupData: Record<string, string | null> = {}
  const keys = [
    'to-live-anchors',
    'to-live-blocks',
    'to-live-obligations',
    'to-live-planner',
    'to-live-recovery',
    'to-live-rot',
    'to-live-routines',
    'to-live-scheduler',
    'to-live-tasks',
    'to-live-settings'
  ]
  for (const key of keys) {
    const val = localStorage.getItem(key)
    if (val !== null) {
      backupData[key] = val
    }
  }
  return JSON.stringify(backupData)
}

// Restore app state and reload
export function restoreAppState(json: string) {
  const backupData = JSON.parse(json)
  for (const [key, value] of Object.entries(backupData)) {
    if (key.startsWith('to-live-') && typeof value === 'string') {
      localStorage.setItem(key, value)
    }
  }
  window.location.reload()
}

// --- GitHub helpers ---

function getGitHubHeaders() {
  const { githubToken } = useSettingsStore.getState()
  return {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  }
}

function getRepoUrl() {
  const { githubOwner, githubRepo } = useSettingsStore.getState()
  return `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents`
}

function isConfigured(): boolean {
  const { githubOwner, githubRepo, githubToken } = useSettingsStore.getState()
  return !!(githubOwner && githubRepo && githubToken)
}

// Get file SHA (needed for updates)
async function getFileSha(path: string): Promise<string | undefined> {
  const res = await fetch(`${getRepoUrl()}/${path}`, { headers: getGitHubHeaders() })
  if (res.status === 200) {
    const json = await res.json()
    return json.sha
  }
  return undefined
}

// Put file to GitHub
async function putFile(path: string, content: string, message: string): Promise<void> {
  const sha = await getFileSha(path)
  const encoded = btoa(unescape(encodeURIComponent(content)))
  const res = await fetch(`${getRepoUrl()}/${path}`, {
    method: 'PUT',
    headers: getGitHubHeaders(),
    body: JSON.stringify({
      message,
      content: encoded,
      ...(sha ? { sha } : {})
    })
  })
  if (!res.ok) {
    throw new Error(`PUT ${path} failed: ${res.status}`)
  }
}

// Get file content from GitHub
async function getFileContent(path: string): Promise<string> {
  const res = await fetch(`${getRepoUrl()}/${path}`, { headers: getGitHubHeaders() })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  const json = await res.json()
  const clean = json.content.replace(/\r?\n|\r/g, '')
  return decodeURIComponent(escape(atob(clean)))
}

// --- Snapshot manifest ---

export interface SnapshotEntry {
  slot: number        // 1-5
  filename: string    // state_1.json
  timestamp: string   // ISO string
  label: string       // human-readable
}

interface Manifest {
  snapshots: SnapshotEntry[]
  nextSlot: number    // which slot to write next (1-5, wraps)
}

const MANIFEST_FILE = 'backup_manifest.json'

async function getManifest(): Promise<Manifest> {
  try {
    const content = await getFileContent(MANIFEST_FILE)
    return JSON.parse(content)
  } catch {
    return { snapshots: [], nextSlot: 1 }
  }
}

async function saveManifest(manifest: Manifest): Promise<void> {
  await putFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'update backup manifest')
}

// --- Public API ---

/** Save a snapshot to the next rotating slot */
export async function snapshotToGitHub(): Promise<void> {
  if (!isConfigured()) return

  const manifest = await getManifest()
  const slot = manifest.nextSlot
  const filename = `state_${slot}.json`
  const timestamp = new Date().toISOString()
  const label = new Date().toLocaleString()

  const json = serializeAppState()
  await putFile(filename, json, `snapshot ${timestamp} (slot ${slot})`)

  // Update manifest: replace or add entry for this slot
  const existing = manifest.snapshots.findIndex((s) => s.slot === slot)
  const entry: SnapshotEntry = { slot, filename, timestamp, label }
  if (existing >= 0) {
    manifest.snapshots[existing] = entry
  } else {
    manifest.snapshots.push(entry)
  }

  // Advance to next slot (1-based, wraps at MAX_SNAPSHOTS)
  manifest.nextSlot = (slot % MAX_SNAPSHOTS) + 1

  await saveManifest(manifest)

  useSettingsStore.getState().setLastSnapshotAt(timestamp)
}

/** List available restore points (newest first) */
export async function listSnapshots(): Promise<SnapshotEntry[]> {
  if (!isConfigured()) return []
  const manifest = await getManifest()
  // Sort by timestamp descending (newest first)
  return [...manifest.snapshots].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/** Restore from a specific snapshot slot */
export async function restoreFromSnapshot(filename: string): Promise<void> {
  if (!isConfigured()) throw new Error('Incomplete GitHub settings')
  if (!confirm(`Restore from ${filename}? This will overwrite your local state and reload.`)) return

  const json = await getFileContent(filename)
  restoreAppState(json)
}

/** Legacy: restore from state.json (backward compat) */
export async function restoreFromGitHub(): Promise<void> {
  if (!isConfigured()) throw new Error('Incomplete GitHub settings')
  if (!confirm('Overwrite local state with this backup? The app will reload.')) return

  const json = await getFileContent('state.json')
  restoreAppState(json)
}

// --- Hourly auto-backup ---

let _hourlyTimer: ReturnType<typeof setInterval> | null = null

export function startHourlyBackup(): void {
  if (_hourlyTimer) return // already running
  const HOUR = 60 * 60 * 1000
  _hourlyTimer = setInterval(() => {
    snapshotToGitHub().catch((err) => {
      console.error('[Hourly backup] failed:', err)
    })
  }, HOUR)
  console.log('[Backup] Hourly auto-backup started')
}

export function stopHourlyBackup(): void {
  if (_hourlyTimer) {
    clearInterval(_hourlyTimer)
    _hourlyTimer = null
    console.log('[Backup] Hourly auto-backup stopped')
  }
}
