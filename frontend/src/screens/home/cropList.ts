// Focus items of the crop price lists shared by home (關注) and the crop lists (docs/02 §5.2,
// §5.3, §6): the crop cards, and the 「重試」 card of a failed load or refresh in front of them.

import type { Crop } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { useSession } from '@/store/session'

import type { AreaPrices } from './useAreaPrices'

/** The connection-failed card (old data) and the retry exit (no data); OK retries. */
export const RETRY_ID = 'action:retry'

const CROP_PREFIX = 'crop:'

export const cropFocusId = (cropId: string) => CROP_PREFIX + cropId

/** The crop of a card's focus id; `null` for other items. */
export const cropOf = (focusId: string) =>
  focusId.startsWith(CROP_PREFIX) ? focusId.slice(CROP_PREFIX.length) : null

/** Focus ids in list order: nothing while loading, the retry card first after a failure. */
export function cropListIds(crops: readonly Crop[], prices: AreaPrices): string[] {
  if (prices.status === 'loading') return []
  if (prices.status === 'failed') return [RETRY_ID]
  const cards = crops.map((crop) => cropFocusId(crop.id))
  return prices.old ? [RETRY_ID, ...cards] : cards
}

/** Items in front of the crop cards, which have no digit key cap (`digitOffset`). */
export const leadingItems = (prices: AreaPrices) =>
  prices.status === 'failed' || prices.old ? 1 : 0

/** What OK does on the focused item, for the centre soft key. */
export function okAction(focusedId: string | null): 'retry' | 'open' | null {
  if (focusedId === null) return null
  return focusedId === RETRY_ID ? 'retry' : 'open'
}

/** Opens a crop's detail on its 行情 tab and records it in 「最近」 (F03). */
export function useOpenCrop(): (cropId: string) => void {
  const nav = useNav()
  const viewCrop = useSession((s) => s.viewCrop)
  return (cropId) => {
    viewCrop(cropId)
    nav.open(paths.crop(cropId, 'today'))
  }
}
