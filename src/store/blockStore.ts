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
  getBlocksForAnchor: (anchorId: string) => Block[]
}

const e = (taskId: string, order: number, mandatory = true, bg = false): BlockEntry => ({
  taskId, order, isBackground: bg, mandatory,
})

export const useBlockStore = create<BlockStore>()(
  persist(
    (set, get) => ({
      blocks: [
        // === Morning block (Mon/Wed - Gym day) ===
        {
          id: 'block-morning-gym',
          name: 'Morning (Gym)',
          anchorId: 'anchor-wake',
          entries: [
            e('t-brush', 0),
            e('t-protein-am', 1),
            e('t-gym', 2),
            e('t-heater-relax', 3),
            e('t-bath', 4),
            e('t-sandhi-am', 5),
            e('t-cook', 6),
            e('t-eat-am', 7),
            e('t-change', 8),
            e('t-walk-office', 9),
          ],
          expectedDurationMinutes: 180,
          overflowBehavior: 'drop',
          blockStickiness: 60,
        },
        // === Morning block (Tue/Thu - Study day) ===
        {
          id: 'block-morning-study',
          name: 'Morning (Study)',
          anchorId: 'anchor-wake',
          entries: [
            e('t-brush', 0),
            e('t-protein-am', 1),
            e('t-study', 2),
            e('t-heater-relax', 3),
            e('t-bath', 4),
            e('t-sandhi-am', 5),
            e('t-cook', 6),
            e('t-eat-am', 7),
            e('t-change', 8),
            e('t-walk-office', 9),
          ],
          expectedDurationMinutes: 180,
          overflowBehavior: 'drop',
          blockStickiness: 60,
        },
        // === Morning block (Friday - Work early then football) ===
        {
          id: 'block-morning-fri',
          name: 'Morning (Friday)',
          anchorId: 'anchor-wake',
          entries: [
            e('t-brush', 0),
            e('t-protein-am', 1),
            e('t-heater-relax', 2),
            e('t-bath', 3),
            e('t-sandhi-am', 4),
            e('t-cook', 5),
            e('t-eat-am', 6),
            e('t-change', 7),
            e('t-walk-office', 8),
          ],
          expectedDurationMinutes: 165,
          overflowBehavior: 'drop',
          blockStickiness: 60,
        },
        // === Friday afternoon block ===
        {
          id: 'block-fri-afternoon',
          name: 'Friday Afternoon',
          anchorId: 'anchor-work-end',
          entries: [
            e('t-football', 0),
            e('t-bath-fri', 1),
            e('t-eat-fri', 2),
            e('t-work-fri-eve', 3),
          ],
          expectedDurationMinutes: 270,
          overflowBehavior: 'push',
          blockStickiness: 80,
        },
        // === Morning block (Saturday - Read + Oil bath + Groceries) ===
        {
          id: 'block-morning-sat',
          name: 'Morning (Saturday)',
          anchorId: 'anchor-wake',
          entries: [
            e('t-brush', 0),
            e('t-protein-am', 1),
            e('t-read', 2),
            e('t-heater-relax', 3),
            e('t-oil-bath', 4),
            e('t-sandhi-am', 5),
            e('t-groceries-sat', 6),
            e('t-cook', 7),
            e('t-eat-am', 8),
          ],
          expectedDurationMinutes: 330,
          overflowBehavior: 'drop',
          blockStickiness: 50,
        },
        // === Morning block (Sunday - Read + Bath/Groom + Groceries) ===
        {
          id: 'block-morning-sun',
          name: 'Morning (Sunday)',
          anchorId: 'anchor-wake',
          entries: [
            e('t-brush', 0),
            e('t-protein-am', 1),
            e('t-read', 2),
            e('t-heater-relax', 3),
            e('t-bath-groom', 4),
            e('t-sandhi-am', 5),
            e('t-cook', 6),
            e('t-eat-am', 7),
          ],
          expectedDurationMinutes: 300,
          overflowBehavior: 'drop',
          blockStickiness: 50,
        },
        // === Evening block (common) ===
        {
          id: 'block-evening',
          name: 'Evening Routine',
          anchorId: 'anchor-work-end',
          entries: [
            e('t-come-home', 0),
            e('t-protein-pm', 1),
            e('t-sandhi-pm', 2),
            e('t-dinner-prep', 3),
            e('t-eat-pm', 4),
            e('t-laundry-wash', 5),
            e('t-laundry-machine', 6, true, true), // background
            e('t-laundry-fold', 7),
            e('t-laundry-prep', 8, false),
            e('t-laundry-hang', 9),
            e('t-relax', 10, false),
          ],
          expectedDurationMinutes: 180,
          overflowBehavior: 'drop',
          blockStickiness: 50,
        },
        // === Sunday pre-evening (groceries before evening routine) ===
        {
          id: 'block-sun-pre-evening',
          name: 'Sunday Groceries',
          anchorId: 'anchor-work-end',
          entries: [
            e('t-groceries-sun', 0),
          ],
          expectedDurationMinutes: 45,
          overflowBehavior: 'push',
          blockStickiness: 60,
        },
      ],
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
      getBlocksForAnchor: (anchorId) => get().blocks.filter((b) => b.anchorId === anchorId),
    }),
    { name: 'to-live-blocks' }
  )
)
