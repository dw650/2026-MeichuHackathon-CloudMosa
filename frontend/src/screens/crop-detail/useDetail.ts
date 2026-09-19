// Route, keys and data shared by the three tabs of the crop detail screen (F04, docs/02 §5.4).

import { useLocation, useParams } from 'react-router'

import { errorKind } from '@/api/client'
import { type Crop, type PriceType, type Quote, useQuote, useRefresh } from '@/api/queries'
import { type Nav, useNav } from '@/app/navigation'
import { DETAIL_TABS, type DetailTab, paths, withoutSheet, withParam } from '@/app/paths'
import type { Tone } from '@/components/categories'
import type { KeyHandlers } from '@/keys/keyScope'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useSettings } from '@/store/settings'

/** Sort orders of the compare tab, in the order of the sort panel (keys 1–4). */
export const SORTS = ['price_desc', 'price_asc', 'distance_asc', 'distance_desc'] as const
export type SortId = (typeof SORTS)[number]
/** Price high → low; it is left out of the URL. */
export const DEFAULT_SORT: SortId = 'price_desc'

export type Days = 7 | 30

export interface Detail {
  cropId: string
  crop: Crop | undefined
  /** The crop category's tone (tile and chart colour). */
  tone: Tone
  tab: DetailTab
  country: string
  /** The viewed area: `?area=`, else my area. Viewing never changes my area. */
  areaId: string
  /** The viewed area's name with the country suffix, e.g. 「Nashik 縣」. */
  areaName: string
  type: PriceType
  /** Range of the trend tab (`?days=30`, else 7). */
  days: Days
  /** Order of the compare tab (`?sort=`, else price high → low). */
  sort: SortId
  nav: Nav
  /** Another tab of this screen; the area, range and order stay (tabs replace the entry). */
  tabUrl(tab: DetailTab): string
  /** This screen's URL, without a panel, with the range or the order changed. */
  urlWith(key: 'days' | 'sort', value: string | undefined): string
  /** Keys every tab has: ◀ ▶ tabs, `*` wholesale ⇄ retail, left soft key menu (docs/02 §4). */
  keys: KeyHandlers
}

const isSort = (value: string | null): value is SortId =>
  value !== null && (SORTS as readonly string[]).includes(value)

export function useDetail(): Detail {
  const { cropId = '', tab: tabParam = '' } = useParams()
  const tab: DetailTab = DETAIL_TABS.includes(tabParam as DetailTab)
    ? (tabParam as DetailTab)
    : 'today'
  const location = useLocation()
  const nav = useNav()
  const { lang } = useText()
  const catalog = useCountryData()
  const country = useSettings((s) => s.country) ?? ''
  const myAreaId = useSettings((s) => s.areaId) ?? ''
  const type = useSettings((s) => s.priceType)
  const togglePriceType = useSettings((s) => s.togglePriceType)

  const query = new URLSearchParams(location.search)
  const areaId = query.get('area') || myAreaId
  const sortParam = query.get('sort')
  const here = withoutSheet(location.pathname + location.search)
  query.delete('sheet')
  const rest = query.toString()

  const tabUrl = (to: DetailTab) => paths.crop(cropId, to) + (rest ? `?${rest}` : '')
  const step = (by: 1 | -1) => {
    const next = DETAIL_TABS[DETAIL_TABS.indexOf(tab) + by]
    if (next) nav.switchTab(tabUrl(next))
  }

  return {
    cropId,
    crop: catalog.crop(cropId),
    tone: catalog.toneOf(catalog.crop(cropId)?.category),
    tab,
    country,
    areaId,
    areaName: areaLabel(catalog.area(areaId), catalog.country, lang),
    type,
    days: query.get('days') === '30' ? 30 : 7,
    sort: isSort(sortParam) ? sortParam : DEFAULT_SORT,
    nav,
    tabUrl,
    urlWith: (key, value) => withParam(here, key, value),
    keys: {
      onLeft: () => step(-1),
      onRight: () => step(1),
      onStar: () => {
        togglePriceType()
        // A fresh history entry, so the focus starts again on the first item (docs/02 §4).
        nav.switchTab(here)
      },
      onMenu: () => nav.openSheet('menu'),
    },
  }
}

/** Quote of the viewed area as a tab shows it. */
export interface QuoteView {
  /** Only data of this crop, area and price type (never another one's while loading). */
  data: Quote | undefined
  error: Error | null
  /** 重試: fetches what is on screen again. */
  refresh(): void
}

/** The quote for this tab: 30 days of series, or the chosen range on the trend tab. */
export function useDetailQuote(detail: Detail): QuoteView {
  const { country, areaId, cropId, type } = detail
  const days = detail.tab === 'trend' ? detail.days : 30
  const query = useQuote(
    country && areaId ? { country, area: areaId, crop: cropId, type, days } : null,
  )
  const refresh = useRefresh()
  const shown = query.data
  // Kept from the previous key while loading: fine for another range, not for another area.
  const usable =
    shown &&
    (!query.isPlaceholderData ||
      (shown.type === type && shown.area_id === areaId && shown.crop_id === cropId))
  return { data: usable ? shown : undefined, error: query.error, refresh: () => void refresh() }
}

/** Where a tab stands with its data. */
export type Stage = 'loading' | 'failed' | 'ready'

export function stageOf(data: unknown, error: unknown): Stage {
  if (data !== undefined) return 'ready'
  return error ? 'failed' : 'loading'
}

/** A crop or area that does not exist (docs/04 §6.1): the screen gives up and goes home. */
export function isMissing(error: unknown): boolean {
  return !!error && errorKind(error) !== 'unavailable'
}

/** Focus ids of the exits that the states offer. */
export const RETRY = 'retry'
export const WHOLESALE = 'wholesale'

export type NoRetailReason = 'no_retail_crop' | 'no_retail_area'

/** No retail price because the crop or the area has no retail reports (docs/06 §3.3). */
export function isNoRetail(reason: string | null | undefined): reason is NoRetailReason {
  return reason === 'no_retail_crop' || reason === 'no_retail_area'
}
