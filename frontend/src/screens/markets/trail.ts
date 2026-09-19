// How far back the crop detail lies below the market screens. A market's retail exit
// 「看 {地區} 的零售價」 returns to that detail and replaces its entry, so no history is added
// (docs/02 §5.5, docs/04 §4.3). Only entries opened during this run know their depth; a
// restored or reloaded screen does not, and its exit replaces its own entry instead.

import { NavigationType } from 'react-router'

/** Per history entry (`location.key`): entries below it that belong to detail → markets → market. */
const depths = new Map<string, number>()
/** The markets list entry seen last, whose depth a replaced entry (another area) inherits. */
let lastListKey: string | null = null
/** Depth of the markets list that is opening a market right now. */
let opening: number | null = null

/** The markets list shows at entry `key` (not a panel entry) after a navigation of `action`. */
export function listShown(key: string, action: NavigationType): void {
  // Only the crop detail pushes the markets list.
  if (action === NavigationType.Push) depths.set(key, 1)
  else if (action === NavigationType.Replace && lastListKey !== null && !depths.has(key)) {
    depths.set(key, depths.get(lastListKey) ?? 0)
  }
  lastListKey = key
}

/** The markets list at entry `listKey` is about to open a market. */
export function openingMarket(listKey: string): void {
  opening = depths.get(listKey) ?? 0
}

/** A market shows at entry `key` after a navigation of `action`. */
export function marketShown(key: string, action: NavigationType): void {
  if (action === NavigationType.Push && opening !== null) depths.set(key, opening + 1)
  opening = null
}

/** Entries to go back before replacing: 0 replaces the entry `key` itself. */
export function stepsBack(key: string): number {
  return depths.get(key) ?? 0
}
