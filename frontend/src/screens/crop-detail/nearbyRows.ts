import type { Quote } from '@/api/queries'

/** The highest and lowest price around the viewed area, from the quote (docs/04 §6). */
export type Nearby = NonNullable<Quote['nearby']>
export type NearbyRow = Nearby['highest']

/** The two nearby rows in screen order: focus id and where the row is in `nearby`. */
export const NEARBY_SIDES = [
  { focusId: 'nearby-high', side: 'highest' },
  { focusId: 'nearby-low', side: 'lowest' },
] as const

export interface NearbyTarget {
  focusId: string
  areaId: string
}

/**
 * The nearby rows that open another area, in screen order. The viewed area's own row (it is
 * the highest or the lowest itself) has nothing to open.
 */
export function nearbyTargets(nearby: Nearby | null | undefined): NearbyTarget[] {
  if (!nearby) return []
  return NEARBY_SIDES.filter(({ side }) => !nearby[side].is_base).map(({ focusId, side }) => ({
    focusId,
    areaId: nearby[side].area_id,
  }))
}
