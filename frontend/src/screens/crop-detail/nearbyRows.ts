import type { Quote } from '@/api/queries'

/** The highest and lowest price around the viewed area, from the quote (docs/04 §6). */
export type Nearby = NonNullable<Quote['nearby']>
export type NearbyRow = Nearby['highest']
export type NearbySide = 'highest' | 'lowest'

export interface NearbySlot {
  focusId: string
  side: NearbySide
}

const SLOTS: readonly NearbySlot[] = [
  { focusId: 'nearby-high', side: 'highest' },
  { focusId: 'nearby-low', side: 'lowest' },
]

/**
 * The two rows in screen order: highest, then lowest, except that the viewed area's own row
 * (it is the highest or the lowest itself) always comes first. It takes no focus, so this
 * keeps the last row a selectable one: scrolling down to it shows everything above.
 */
export function nearbySlots(nearby: Nearby): NearbySlot[] {
  return [...SLOTS].sort((a, b) => Number(nearby[b.side].is_base) - Number(nearby[a.side].is_base))
}

export interface NearbyTarget {
  focusId: string
  areaId: string
}

/** The rows that open another area, in screen order; the viewed area's own row does not. */
export function nearbyTargets(nearby: Nearby | null | undefined): NearbyTarget[] {
  if (!nearby) return []
  return nearbySlots(nearby)
    .filter(({ side }) => !nearby[side].is_base)
    .map(({ focusId, side }) => ({ focusId, areaId: nearby[side].area_id }))
}
