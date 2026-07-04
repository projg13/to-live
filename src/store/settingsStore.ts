import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  githubOwner: string
  githubRepo: string
  githubToken: string
  lastSnapshotAt: string
  setGithubOwner: (owner: string) => void
  setGithubRepo: (repo: string) => void
  setGithubToken: (token: string) => void
  setLastSnapshotAt: (time: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      githubOwner: '',
      githubRepo: '',
      githubToken: '',
      lastSnapshotAt: '',
      setGithubOwner: (githubOwner) => set({ githubOwner }),
      setGithubRepo: (githubRepo) => set({ githubRepo }),
      setGithubToken: (githubToken) => set({ githubToken }),
      setLastSnapshotAt: (lastSnapshotAt) => set({ lastSnapshotAt }),
    }),
    { name: 'to-live-settings' }
  )
)
