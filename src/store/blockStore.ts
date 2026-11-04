import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Block, type BlockEntry, assertValidBlockDag } from '../types/block'

interface BlockStore {
  blocks: Block[]
  addBlock: (block: Block) => void
  updateBlock: (id: string, updates: Partial<Block>) => void
  deleteBlock: (id: string) => void
  addEntry: (blockId: string, entry: BlockEntry) => void
  updateEntry: (blockId: string, taskId: string, updates: Partial<BlockEntry>) => void
  removeEntry: (blockId: string, taskId: string) => void
  reorderEntry: (blockId: string, taskId: string, newOrder: number) => void
}

export const useBlockStore = create<BlockStore>()(
  persist(
    (set) => ({
      blocks: [],
      addBlock: (block) => {
        assertValidBlockDag(block.name, block.entries)
        set((state) => ({ blocks: [...state.blocks, block] }))
      },
      updateBlock: (id, updates) =>
        set((state) => ({
          blocks: state.blocks.map((b) => {
            if (b.id !== id) return b
            const next = { ...b, ...updates }
            assertValidBlockDag(next.name, next.entries)
            return next
          }),
        })),
      deleteBlock: (id) =>
        set((state) => ({ blocks: state.blocks.filter((b) => b.id !== id) })),
      addEntry: (blockId, entry) =>
        set((state) => ({
          blocks: state.blocks.map((b) => {
            if (b.id !== blockId) return b
            const nextEntries = [...b.entries, entry]
            assertValidBlockDag(b.name, nextEntries)
            return { ...b, entries: nextEntries }
          }),
        })),
      updateEntry: (blockId, taskId, updates) =>
        set((state) => ({
          blocks: state.blocks.map((b) => {
            if (b.id !== blockId) return b
            const nextEntries = b.entries.map((e) => (e.taskId === taskId ? { ...e, ...updates } : e))
            assertValidBlockDag(b.name, nextEntries)
            return { ...b, entries: nextEntries }
          }),
        })),
      removeEntry: (blockId, taskId) =>
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === blockId
              ? {
                  ...b,
                  entries: b.entries
                    .filter((e) => e.taskId !== taskId)
                    .map((e) =>
                      e.requires ? { ...e, requires: e.requires.filter((r) => r !== taskId) } : e
                    ),
                }
              : b
          ),
        })),
      reorderEntry: (blockId, taskId, newOrder) =>
        set((state) => ({
          blocks: state.blocks.map((b) => {
            if (b.id !== blockId) return b
            return {
              ...b,
              entries: b.entries.map((e) => (e.taskId === taskId ? { ...e, order: newOrder } : e)),
            }
          }),
        })),
    }),
    { name: 'to-live-blocks', version: 2 }
  )
)
