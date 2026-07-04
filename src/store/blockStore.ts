import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block, BlockEntry } from '../types/block'

interface BlockStore {
  blocks: Block[]
  addBlock: (block: Block) => void
  updateBlock: (id: string, updates: Partial<Block>) => void
  deleteBlock: (id: string) => void
  addEntry: (blockId: string, entry: BlockEntry) => void
  removeEntry: (blockId: string, taskId: string) => void
  reorderEntry: (blockId: string, taskId: string, newOrder: number) => void

}

export const useBlockStore = create<BlockStore>()(
  persist(
    (set) => ({
      blocks: [],
      addBlock: (block) =>
        set((state) => ({ blocks: [...state.blocks, block] })),
      updateBlock: (id, updates) =>
        set((state) => ({ blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),
      deleteBlock: (id) =>
        set((state) => ({ blocks: state.blocks.filter((b) => b.id !== id) })),
      addEntry: (blockId, entry) =>
        set((state) => ({ blocks: state.blocks.map((b) => b.id === blockId ? { ...b, entries: [...b.entries, entry] } : b) })),
      removeEntry: (blockId, taskId) =>
        set((state) => ({ blocks: state.blocks.map((b) => b.id === blockId ? { ...b, entries: b.entries.filter((e) => e.taskId !== taskId) } : b) })),
      reorderEntry: (blockId, taskId, newOrder) =>
        set((state) => ({ blocks: state.blocks.map((b) => { if (b.id !== blockId) return b; return { ...b, entries: b.entries.map((e) => e.taskId === taskId ? { ...e, order: newOrder } : e) } }) })),

    }),
    { name: 'to-live-blocks', version: 2 }
  )
)
