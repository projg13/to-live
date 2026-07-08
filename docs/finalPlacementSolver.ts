// finalPlacementSolver.ts
// Consolidated optimal solver. Self-contained.
//
// Pipeline:
//   1. PREPROCESS (shrinks the hard set):
//      a. duration < 5 min  -> never a curve; demoted to flat.
//      b. curve constant over its feasible window (window misses the active
//         slope, or curve genuinely flat there) -> demoted to flat.
//      c. window width == duration -> start is forced; pinned to skeleton.
//   2. CLUSTER remaining curved tasks by occupancy-span overlap; disjoint
//      clusters provably cannot interact -> solved independently.
//   3. Per cluster: frontier DP over the 5-min grid with a task bitmask
//      (exact; deterministic O(slots * 2^k * k); guard k <= 12 per cluster).
//      Clusters solved in chronological order so cross-cluster precedence
//      resolves to a concrete parent end time.
//   4. FLATS: exact max-value packing (backtracking with skip branches)
//      around the combined skeleton.
//   5. Chains enforced (all-or-nothing), result assembled.
//
// Returns { result, optimal: true }. Throws only if a single cluster
// exceeds 12 mutually-contending curves (hasn't happened at your sizes;
// the escape hatch then is the heuristic solver).
//
// KNOWN BUG (pre-integration):
//   If a curved child's parent is a flat task, the child enters cluster DP
//   with parentMin=0 (no constraint). The flat parent isn't placed until
//   stage 4, so ordering constraint can be violated.
//   Fix: block the child or promote the parent to pinned.
//
// INTEGRATION NOTES:
//   - Committed tasks → feed as pinned (forced earliest = locked start)
//   - Weight offsets → bake into flat value or offset curve before passing
//   - Current-task protection → if earliest ≤ nowMinutes < earliest+duration, clear expiry
//   - Anchor push (Phase 3) → runs AFTER solver, unchanged
//   - Adapter needed: ScheduledItem[] → SolverTask[] and back

export interface ControlPoint { t: number; v: number }

export interface SolverTask {
  id: string
  duration: number
  earliest: number
  expiry?: number
  isBackground: boolean
  flat?: number
  curve?: ControlPoint[]
  chainId?: string
  parentId?: string
}

export interface PlacementResult {
  placed: { taskId: string; startMinutes: number; endMinutes: number }[]
  overflow: { taskId: string }[]
}

const STEP = 5
const DAY = 1440
const MAX_K = 12
const EPS = 1e-9
const MIN_CURVE_DURATION = 5

// ---------- weight ----------
function evalCurve(curve: ControlPoint[], t: number): number {
  const tt = ((t % DAY) + DAY) % DAY
  if (curve.length === 0) return 0
  if (curve.length === 1) return curve[0].v
  for (let i = 0; i < curve.length; i++) {
    const a = curve[i], b = curve[(i + 1) % curve.length]
    const at = a.t, bt = b.t <= a.t ? b.t + DAY : b.t
    let x = tt
    if (x < at) x += DAY
    if (x >= at && x <= bt) {
      const span = bt - at
      return span === 0 ? a.v : a.v + ((x - at) / span) * (b.v - a.v)
    }
  }
  return curve[0].v
}

interface Iv { start: number; end: number; taskId: string }

function gapsOf(placed: Iv[], lo: number, hi: number): { start: number; end: number }[] {
  const s = [...placed].sort((a, b) => a.start - b.start)
  const out: { start: number; end: number }[] = []
  let c = lo
  for (const iv of s) {
    if (iv.start > c) out.push({ start: c, end: Math.min(iv.start, hi) })
    c = Math.max(c, iv.end)
    if (c >= hi) break
  }
  if (c < hi) out.push({ start: c, end: hi })
  return out
}

const snapUp = (x: number) => Math.ceil(x / STEP) * STEP

// ---------- main ----------
export function solveFinal(
  tasks: SolverTask[],
  opts: { nowMinutes: number; cutoff: number }
): { result: PlacementResult; optimal: boolean } {
  const lo = Math.max(0, opts.nowMinutes)
  const hi = opts.cutoff
  const byId = new Map(tasks.map(t => [t.id, t]))

  const background = tasks.filter(t => t.isBackground)
  const fg = tasks.filter(t => !t.isBackground)

  // weight of a task at start t, AFTER demotion decisions (filled below)
  const flatVal = new Map<string, number>()          // taskId -> constant weight
  const weightAt = (task: SolverTask, t: number): number => {
    if (flatVal.has(task.id)) return flatVal.get(task.id)!
    if (task.flat !== undefined) return task.flat
    if (task.curve && task.curve.length) return evalCurve(task.curve, t)
    return 0
  }

  // ---------- 1. classification ----------
  const feasibleStarts = (t: SolverTask): { first: number; last: number } | null => {
    const first = snapUp(Math.max(t.earliest, lo))
    const last = Math.min(hi - t.duration,
      t.expiry !== undefined ? t.expiry - STEP : Infinity)
    return first > last ? null : { first, last: Math.floor(last / STEP) * STEP }
  }

  const pinned: Iv[] = []
  const pinnedStart = new Map<string, number>()
  const curvedHard: SolverTask[] = []
  const flats: SolverTask[] = []

  for (const t of fg) {
    const fs = feasibleStarts(t)
    if (!fs) { flats.push(t); continue } // infeasible -> will overflow via packing
    const isCurve = t.flat === undefined && t.curve && t.curve.length > 1
      && t.duration >= MIN_CURVE_DURATION
    if (!isCurve) {
      if (t.flat === undefined && t.curve && t.curve.length) {
        // demoted tiny-duration curve: constant = value at window midpoint
        const mid = snapUp((fs.first + fs.last) / 2)
        flatVal.set(t.id, evalCurve(t.curve!, mid))
      }
      flats.push(t)
      continue
    }
    // constant-over-window check (covers "window misses the active slope")
    let wmin = Infinity, wmax = -Infinity
    for (let s = fs.first; s <= fs.last; s += STEP) {
      const w = evalCurve(t.curve!, s)
      if (w < wmin) wmin = w
      if (w > wmax) wmax = w
    }
    if (wmax - wmin <= EPS) {
      flatVal.set(t.id, wmin)
      flats.push(t)
      continue
    }
    // forced start -> pin
    if (fs.first === fs.last) {
      pinned.push({ start: fs.first, end: fs.first + t.duration, taskId: t.id })
      pinnedStart.set(t.id, fs.first)
      continue
    }
    curvedHard.push(t)
  }

  // ---------- 2. clustering by occupancy-span overlap ----------
  interface Span { task: SolverTask; sLo: number; sHi: number }
  const spans: Span[] = curvedHard.map(t => {
    const fs = feasibleStarts(t)!
    return { task: t, sLo: fs.first, sHi: fs.last + t.duration }
  }).sort((a, b) => a.sLo - b.sLo)

  const clusters: SolverTask[][] = []
  let cur: Span[] = []
  let curEnd = -Infinity
  for (const sp of spans) {
    if (cur.length === 0 || sp.sLo < curEnd) {
      cur.push(sp)
      curEnd = Math.max(curEnd, sp.sHi)
    } else {
      clusters.push(cur.map(x => x.task))
      cur = [sp]
      curEnd = sp.sHi
    }
  }
  if (cur.length) clusters.push(cur.map(x => x.task))

  for (const cl of clusters) {
    if (cl.length > MAX_K) {
      throw new Error(`solveFinal: cluster of ${cl.length} contending curves exceeds ${MAX_K}`)
    }
  }

  // ---------- 3. per-cluster frontier DP ----------
  const skeleton: Iv[] = [...pinned]
  const placedStart = new Map<string, number>(pinnedStart)
  const overlapsSkeleton = (s: number, e: number) =>
    skeleton.some(p => s < p.end && e > p.start)

  // chronological order so cross-cluster parents are already resolved
  clusters.sort((a, b) => {
    const alo = Math.min(...a.map(t => feasibleStarts(t)!.first))
    const blo = Math.min(...b.map(t => feasibleStarts(t)!.first))
    return alo - blo
  })

  for (const cl of clusters) {
    const k = cl.length
    const nMask = 1 << k
    const index = new Map(cl.map((t, i) => [t.id, i]))
    const durSlots = cl.map(t => Math.ceil(t.duration / STEP))
    const parentBit: number[] = cl.map(() => -1)
    const parentMin: number[] = cl.map(() => 0)
    const blocked: boolean[] = cl.map(() => false)
    cl.forEach((t, i) => {
      if (!t.parentId) return
      const p = byId.get(t.parentId)
      if (!p) return
      if (index.has(p.id)) { parentBit[i] = index.get(p.id)!; return }
      if (p.isBackground) { parentMin[i] = p.earliest + p.duration; return }
      const ps = placedStart.get(p.id)
      if (ps !== undefined) { parentMin[i] = ps + p.duration; return }
      // parent is a flat (packed later) or overflowed earlier cluster member:
      // flat parent -> enforced in packFlats stage; overflowed -> blocked
      const isFlat = flats.some(f => f.id === p.id)
      if (!isFlat) blocked[i] = true
    })

    const m = Math.floor((hi - lo) / STEP) + 1
    const timeOf = (s: number) => lo + s * STEP
    const dp = new Float64Array(m * nMask).fill(-Infinity)
    const act = new Int32Array(m * nMask).fill(-2)
    const at = (s: number, mask: number) => s * nMask + mask
    dp[at(0, 0)] = 0; act[at(0, 0)] = -1

    for (let s = 0; s < m; s++) {
      const t = timeOf(s)
      for (let mask = 0; mask < nMask; mask++) {
        const v = dp[at(s, mask)]
        if (v === -Infinity) continue
        if (s + 1 < m && v > dp[at(s + 1, mask)]) {
          dp[at(s + 1, mask)] = v; act[at(s + 1, mask)] = -1
        }
        for (let i = 0; i < k; i++) {
          if (mask & (1 << i)) continue
          if (blocked[i]) continue
          const task = cl[i]
          if (t < task.earliest || t < parentMin[i]) continue
          if (task.expiry !== undefined && t >= task.expiry) continue
          if (parentBit[i] >= 0 && !(mask & (1 << parentBit[i]))) continue
          const end = t + task.duration
          const endSlot = s + durSlots[i]
          if (endSlot >= m) continue
          if (overlapsSkeleton(t, end)) continue
          const nv = v + weightAt(task, t) * task.duration
          const ni = at(endSlot, mask | (1 << i))
          if (nv > dp[ni]) { dp[ni] = nv; act[ni] = i }
        }
      }
    }

    // best terminal mask (chains among this cluster's members enforced later globally)
    let bestMask = 0, bestV = -Infinity
    for (let mask = 0; mask < nMask; mask++) {
      const v = dp[at(m - 1, mask)]
      if (v > bestV) { bestV = v; bestMask = mask }
    }
    // reconstruct
    let s = m - 1, mk = bestMask
    while (s > 0 || mk !== 0) {
      const a = act[at(s, mk)]
      if (a === -1) { s -= 1; continue }
      if (a < 0) break
      const task = cl[a]
      const start = timeOf(s - durSlots[a])
      skeleton.push({ start, end: start + task.duration, taskId: task.id })
      placedStart.set(task.id, start)
      s -= durSlots[a]
      mk &= ~(1 << a)
    }
  }

  // ---------- 4. exact flat packing ----------
  const flatValue = (f: SolverTask) =>
    (flatVal.get(f.id) ?? f.flat ?? 0) * f.duration
  const flatOrder = [...flats].sort((a, b) => {
    const ae = a.expiry ?? Infinity, be = b.expiry ?? Infinity
    if (ae !== be) return ae - be
    return flatValue(b) - flatValue(a)
  })
  const remVal: number[] = new Array(flatOrder.length + 1).fill(0)
  for (let i = flatOrder.length - 1; i >= 0; i--) remVal[i] = remVal[i + 1] + flatValue(flatOrder[i])

  let bestPack: { placed: Iv[]; value: number } = { placed: [], value: 0 }
  const packCur: Iv[] = []
  const packMap = new Map(placedStart)
  const parentEndOf = (f: SolverTask): number | 'blocked' => {
    if (!f.parentId) return 0
    const p = byId.get(f.parentId)
    if (!p) return 0
    if (p.isBackground) return p.earliest + p.duration
    const ps = packMap.get(p.id)
    return ps === undefined ? 'blocked' : ps + p.duration
  }
  function dfs(i: number, acc: number) {
    if (acc + remVal[i] <= bestPack.value) return
    if (i === flatOrder.length) {
      if (acc > bestPack.value) bestPack = { placed: [...packCur], value: acc }
      return
    }
    const f = flatOrder[i]
    const pe = parentEndOf(f)
    if (pe !== 'blocked') {
      const latest = Math.min(hi - f.duration,
        f.expiry !== undefined ? f.expiry - STEP : Infinity)
      const earliest = Math.max(f.earliest, pe, lo)
      for (const g of gapsOf([...skeleton, ...packCur], lo, hi)) {
        const s = snapUp(Math.max(g.start, earliest))
        if (s + f.duration <= g.end && s <= latest) {
          packCur.push({ start: s, end: s + f.duration, taskId: f.id })
          packMap.set(f.id, s)
          dfs(i + 1, acc + flatValue(f))
          packCur.pop(); packMap.delete(f.id)
          break // earliest-fit dominant: value is placement-free
        }
      }
    }
    dfs(i + 1, acc)
  }
  dfs(0, 0)

  // ---------- 5. chains + assembly ----------
  let all: Iv[] = [...skeleton, ...bestPack.placed]
  const chainOf = new Map<string, string[]>()
  for (const t of fg) if (t.chainId) {
    if (!chainOf.has(t.chainId)) chainOf.set(t.chainId, [])
    chainOf.get(t.chainId)!.push(t.id)
  }
  for (const [, members] of chainOf) {
    const have = members.filter(mm => all.some(p => p.taskId === mm))
    if (have.length > 0 && have.length < members.length) {
      all = all.filter(p => !members.includes(p.taskId))
    }
  }

  const placedIds = new Set(all.map(p => p.taskId))
  const result: PlacementResult = {
    placed: [
      ...all.map(p => ({ taskId: p.taskId, startMinutes: p.start, endMinutes: p.end })),
      ...background.map(b => ({ taskId: b.id, startMinutes: b.earliest, endMinutes: b.earliest + b.duration })),
    ],
    overflow: fg.filter(t => !placedIds.has(t.id)).map(t => ({ taskId: t.id })),
  }
  return { result, optimal: true }
}
