import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Block, BlockEntry, OverflowBehavior } from '../types/block'

interface BlockStore {
  blocks: Block[]
  addBlock: (block: Block) => void
  updateBlock: (id: string, updates: Partial<Block>) => void
  deleteBlock: (id: string) => void
  addEntry: (blockId: string, entry: BlockEntry) => void
  removeEntry: (blockId: string, taskId: string) => void
  reorderEntry: (blockId: string, taskId: string, newOrder: number) => void
  getBlocksForAnchor: (anchorId: string) => Block[]
}

export const useBlockStore = create<BlockStore>()(
  persist(
    (set, get) => ({
      blocks: [
        // Morning block: brush, laundry interleaved, bath, breakfast
        // Scenario: wake at 6 → full block. Wake at 8, leave at 9 → drops optional (laundry, breakfast)
        // If user starts laundry anyway → unload/hang become sticky for evening
        {
          id: 'block-morning',
          name: 'Morning Routine',
          anchorId: 'anchor-wake',
          entries: [
            { taskId: 'task-brush', order: 0, isBackground: false, mandatory: true },
            { taskId: 'task-laundry-load', order: 1, isBackground: false, mandatory: false },
            { taskId: 'task-laundry-run', order: 2, isBackground: true, mandatory: false },
            { taskId: 'task-bath', order: 3, isBackground: false, mandatory: true },
            { taskId: 'task-breakfast', order: 4, isBackground: false, mandatory: false },
            { taskId: 'task-laundry-unload', order: 5, isBackground: false, mandatory: false },
            { taskId: 'task-hang-clothes', order: 6, isBackground: false, mandatory: false },
          ],
          expectedDurationMinutes: 90,
          overflowBehavior: 'drop',
          blockStickiness: 60,
          expiresAfterMinutes: 180,
        },
        // Evening cook: prep → stove (ghost) → read while waiting → plate
        {
          id: 'block-evening-cook',
          name: 'Evening Cook',
          anchorId: 'anchor-wake',
          entries: [
            { taskId: 'task-cook-prep', order: 0, isBackground: false, mandatory: true },
            { taskId: 'task-cook-cooking', order: 1, isBackground: true, mandatory: true },
            { taskId: 'task-read-book', order: 2, isBackground: false, mandatory: false },
            { taskId: 'task-cook-plate', order: 3, isBackground: false, mandatory: true },
          ],
          expectedDurationMinutes: 40,
          overflowBehavior: 'push',
          blockStickiness: 70,
        },
      ],
      addBlock: (block) =>
        set((state) => ({ blocks: [...state.blocks, block] })),
      updateBlock: (id, updates) =>
        set((state) => ({
          blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        })),
      deleteBlock: (id) =>
        set((state) => ({ blocks: state.blocks.filter((b) => b.id !== id) })),
      addEntry: (blockId, entry) =>
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === blockId ? { ...b, entries: [...b.entries, entry] } : b
          ),
        })),
      removeEntry: (blockId, taskId) =>
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === blockId
              ? { ...b, entries: b.entries.filter((e) => e.taskId !== taskId) }
              : b
          ),
        })),
      reorderEntry: (blockId, taskId, newOrder) =>
        set((state) => ({
          blocks: state.blocks.map((b) => {
            if (b.id !== blockId) return b
            return { ...b, entries: b.entries.map((e) => e.taskId === taskId ? { ...e, order: newOrder } : e) }
          }),
        })),
      getBlocksForAnchor: (anchorId) =>
        get().blocks.filter((b) => b.anchorId === anchorId),
    }),
    { name: 'to-live-blocks' }
  )
)
