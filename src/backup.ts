import { useSettingsStore } from './store/settingsStore'

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

export async function snapshotToGitHub(): Promise<void> {
  const settings = useSettingsStore.getState()
  const { githubOwner, githubRepo, githubToken, setLastSnapshotAt } = settings

  if (!githubOwner || !githubRepo || !githubToken) {
    // Silently skip if settings are incomplete
    return
  }

  const json = serializeAppState()
  // Unicode-safe base64 of the JSON
  const content = btoa(unescape(encodeURIComponent(json)))

  const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/state.json`
  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  }

  // GET the same URL first to check if file exists and get SHA
  let sha: string | undefined = undefined
  try {
    const getRes = await fetch(url, { headers })
    if (getRes.status === 200) {
      const getJson = await getRes.json()
      sha = getJson.sha
    } else if (getRes.status !== 404) {
      throw new Error(`GET failed with status code: ${getRes.status}`)
    }
  } catch (error) {
    console.error('GET check failed:', error)
    throw error
  }

  const timestamp = new Date().toISOString()
  const putBody = {
    message: `snapshot ${timestamp}`,
    content,
    ...(sha ? { sha } : {})
  }

  const putRes = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody)
  })

  if (putRes.ok || putRes.status === 200 || putRes.status === 201) {
    setLastSnapshotAt(timestamp)
  } else {
    throw new Error(`PUT failed with status code: ${putRes.status}`)
  }
}

export async function restoreFromGitHub(): Promise<void> {
  const settings = useSettingsStore.getState()
  const { githubOwner, githubRepo, githubToken } = settings

  if (!githubOwner || !githubRepo || !githubToken) {
    throw new Error('Incomplete GitHub settings')
  }

  if (!confirm('Overwrite local state with this backup? The app will reload.')) {
    return
  }

  const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/state.json`
  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github+json'
  }

  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`GET failed with status code: ${res.status}`)
  }

  const resJson = await res.json()
  const cleanContent = resJson.content.replace(/\r?\n|\r/g, '')
  const decodedJson = decodeURIComponent(escape(atob(cleanContent)))

  restoreAppState(decodedJson)
}
