import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { ApiError } from '@/api/client'
import { type PriceItem, usePrices, useRefresh } from '@/api/queries'
import { paths } from '@/app/paths'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useSettings } from '@/store/settings'

/** F12 states of a crop price list (docs/02 §6). */
export type PricesStatus = 'loading' | 'failed' | 'ready'

export interface AreaPrices {
  status: PricesStatus
  /** A refresh failed: the prices shown are the last good ones (「舊」). */
  old: boolean
  /** When the prices shown were fetched (ISO 8601), for 「先顯示 HH:mm 的資料」. */
  fetchedAt: string | null
  /** The country's today from the latest response, for the info bar date. */
  today: string | null
  /** The price of a crop; `undefined` when the response has none. */
  item(cropId: string): PriceItem | undefined
  /** 「重試」: fetches what is on screen again. */
  retry(): void
}

/**
 * Prices of my area for the chosen price type, for home and the crop lists (docs/02 §5.2,
 * §5.3). `crops` limits the request (the watchlist; an empty list asks nothing); `'all'` asks
 * for every crop, one response shared by all the crop lists.
 *
 * Another query's data (the previous price type or area) is never shown in between: the list
 * shows its skeleton until its own prices arrive. After a failed refresh the last good prices
 * stay, marked `old`; with nothing to show the status is `failed`.
 */
export function useAreaPrices(crops: readonly string[] | 'all'): AreaPrices {
  const country = useSettings((s) => s.country)
  const area = useSettings((s) => s.areaId)
  const type = useSettings((s) => s.priceType)
  const catalog = useCountryData()
  const refresh = useRefresh()
  const none = crops !== 'all' && crops.length === 0
  const query = usePrices(
    country && area && !none
      ? { country, area, type, crops: crops === 'all' ? undefined : [...crops] }
      : null,
  )
  const data = query.isPlaceholderData ? undefined : query.data
  const catalogReady = catalog.crops.length > 0

  // My area no longer exists (docs/04 §6.1): pick another one instead of a dead end.
  const navigate = useNavigate()
  const areaGone = query.error instanceof ApiError && query.error.code === 'area_not_found'
  useEffect(() => {
    if (areaGone) void navigate(paths.areas('home'), { replace: true })
  }, [areaGone, navigate])

  let status: PricesStatus
  if (catalogReady && (data || none)) status = 'ready'
  else if (query.isFetching || catalog.isLoading) status = 'loading'
  else if (query.isError || catalog.error) status = 'failed'
  else status = 'loading'

  const items = new Map((data?.items ?? []).map((item) => [item.crop_id, item]))
  return {
    status,
    old: status === 'ready' && query.isError,
    fetchedAt: data?.fetched_at ?? null,
    today: query.data?.today ?? null,
    item: (cropId) => items.get(cropId),
    retry: () => void refresh(),
  }
}
