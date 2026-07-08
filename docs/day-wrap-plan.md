# Day Wrap: Post-Midnight Continuity — Future Plan

> Saved for future implementation. No active pain — manual reset works fine for now.

## Core Concept

A "day" runs from first anchor (Wake) to first anchor, not midnight to midnight. The existing overflow system (`overflowCutoff = 1440 + nextFirstAnchor`) already supports task placement past midnight. The gap is: after midnight, the app treats it as a new day when it shouldn't.

## Approach: "Start Today" Button

1. **New field**: `lastActiveDate: string` — the calendar date of the current day-0
2. **After midnight, before "Start Today"**: pass `baseDate = lastActiveDate` (yesterday) and `currentTimeMinutes = 1440 + clockMinutes` to the resolver. Schedule stays on yesterday's extended timeline.
3. **"Start Today" button**: Sets `lastActiveDate = today`, cleans stale ephemeral state (doneItems, confirmedAnchors, committedTasks, lastDoneAt), triggers fresh resolve.
4. **markDone/markDoneAt in post-midnight zone**: use `1440 + clockMinutes` for correct timeline position.
5. **Resolver**: Completely unchanged — already supports > 1440 minutes.

## Two Phases

### Phase 1: Safe part (~90 lines, low risk)
- `lastActiveDate` + day transition detection
- Post-midnight time adjustment (1440 + clock)
- "Start Today" button + stale state cleanup
- Adhoc "past midnight" toggle (if ever needed)
- **Does NOT modify the resolver**

### Phase 2: Cross-day anchor push (~40 lines, medium risk)
- Sleep starting at 11 PM and ending at 7 AM pushes tomorrow's Wake forward
- Requires making the resolve loop sequential (day 0 overflow → day 1 anchor shift)
- Changes the core algorithm — implement separately, easy to revert independently

## Files Touched
- `schedulerStore.ts` — `lastActiveDate` field, resolve() transition detection, clearSchedule reset
- `Dashboard.tsx` — "Start Today" banner, baseDate/currentTimeMinutes adjustment, markDone time adjustment
- No migration needed (new field defaults to `''`)
