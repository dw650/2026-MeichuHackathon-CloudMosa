import { byDistance, type LatLon } from '@/lib/geo'

export interface AreaOrder<T> {
  /** 最近使用: the current area first, then the other recent ones. */
  recent: T[]
  /** 全部地區: every other area, nearest first from `from`. */
  rest: T[]
}

/**
 * Order of the area list (docs/02 §5.6): the current area and the recent ones, then the rest by
 * straight-line distance from `fromId` (my area). Ids missing from `areas` are skipped.
 */
export function orderAreas<T extends LatLon & { id: string }>(
  areas: readonly T[],
  currentId: string | null,
  recentIds: readonly string[],
  fromId: string | null,
): AreaOrder<T> {
  const byId = new Map(areas.map((a) => [a.id, a]))
  const recentSet = new Set<string>()
  const recent: T[] = []
  for (const id of [currentId, ...recentIds]) {
    const area = id === null ? undefined : byId.get(id)
    if (area && !recentSet.has(area.id)) {
      recentSet.add(area.id)
      recent.push(area)
    }
  }
  const others = areas.filter((a) => !recentSet.has(a.id))
  const from = (fromId === null ? undefined : byId.get(fromId)) ?? recent[0]
  return { recent, rest: from ? byDistance(others, from) : others }
}
