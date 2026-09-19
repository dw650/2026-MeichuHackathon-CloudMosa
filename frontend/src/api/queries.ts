/** One TanStack Query hook per endpoint (docs/04 §6). Screens use these, never fetch. */

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { apiGet } from './client'
import type {
  SchemaAreasOut,
  SchemaCompareOut,
  SchemaCountriesOut,
  SchemaCropsOut,
  SchemaHealthOut,
  SchemaIntlPricesOut,
  SchemaIntlSeriesOut,
  SchemaLocateOut,
  SchemaMarketOut,
  SchemaMarketsOut,
  SchemaNewsItemDetailOut,
  SchemaNewsOut,
  SchemaPricesOut,
  SchemaQuoteOut,
} from './schema'

export type PriceType = 'wholesale' | 'retail'
export type Country = SchemaCountriesOut['countries'][number]
/** A tile of the home grid (docs/02 §5.2); crops carry its `id` as their `category`. */
export type Category = Country['categories'][number]
export type Area = SchemaAreasOut['areas'][number]
export type Crop = SchemaCropsOut['crops'][number]
export type PriceItem = SchemaPricesOut['items'][number]
export type Quote = SchemaQuoteOut
export type Compare = SchemaCompareOut
export type CompareRow = SchemaCompareOut['rows'][number]
export type Markets = SchemaMarketsOut
export type MarketRow = SchemaMarketsOut['rows'][number]
export type Market = SchemaMarketOut
export type NewsList = SchemaNewsOut
export type NewsItem = SchemaNewsOut['items'][number]
export type NewsItemDetail = SchemaNewsItemDetailOut
export type Staleness = PriceItem['staleness']
export type Change = NonNullable<PriceItem['change']>
export type IntlPrices = SchemaIntlPricesOut
export type IntlItem = SchemaIntlPricesOut['items'][number]
export type IntlSeries = SchemaIntlSeriesOut

// The catalog barely changes; keep it longer than prices.
const CATALOG_STALE_MS = 60 * 60 * 1000

export const queryKeys = {
  countries: ['countries'] as const,
  areas: (country: string) => ['areas', country] as const,
  crops: (country: string) => ['crops', country] as const,
  prices: (p: PricesParams) =>
    ['prices', p.country, p.area, p.type, p.crops?.join(',') ?? '*'] as const,
  quote: (p: QuoteParams) => ['quote', p.country, p.area, p.crop, p.type, p.days ?? 30] as const,
  compare: (p: CompareParams) => ['compare', p.country, p.area, p.crop, p.type] as const,
  markets: (p: MarketsParams) => ['markets', p.country, p.area, p.crop] as const,
  market: (p: MarketParams) => ['market', p.country, p.crop, p.market] as const,
  intl: (country: string) => ['intl', country] as const,
  intlSeries: (country: string, series: string) => ['intl', country, series] as const,
  news: (p: NewsParams) => ['news', p.country, p.area] as const,
  newsItem: (id: number) => ['newsItem', id] as const,
  locate: ['locate'] as const,
  health: ['health'] as const,
}

export function useCountries() {
  return useQuery({
    queryKey: queryKeys.countries,
    queryFn: ({ signal }) => apiGet<SchemaCountriesOut>('/countries', {}, { signal }),
    staleTime: CATALOG_STALE_MS,
  })
}

export function useAreas(country: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.areas(country ?? ''),
    queryFn: ({ signal }) => apiGet<SchemaAreasOut>(`/countries/${country}/areas`, {}, { signal }),
    enabled: !!country,
    placeholderData: undefined,
  })
}

export function useCrops(country: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.crops(country ?? ''),
    queryFn: ({ signal }) => apiGet<SchemaCropsOut>(`/countries/${country}/crops`, {}, { signal }),
    enabled: !!country,
    staleTime: CATALOG_STALE_MS,
    placeholderData: undefined,
  })
}

export interface PricesParams {
  country: string
  area: string
  type: PriceType
  crops?: string[]
}

export function usePrices(p: PricesParams | null) {
  return useQuery({
    queryKey: p ? queryKeys.prices(p) : ['prices', 'off'],
    queryFn: ({ signal }) =>
      apiGet<SchemaPricesOut>(
        '/prices',
        { country: p!.country, area: p!.area, type: p!.type, crops: p!.crops?.join(',') },
        { signal },
      ),
    enabled: !!p,
  })
}

export interface QuoteParams {
  country: string
  area: string
  crop: string
  type: PriceType
  days?: 7 | 30
}

export function useQuote(p: QuoteParams | null) {
  return useQuery({
    queryKey: p ? queryKeys.quote(p) : ['quote', 'off'],
    queryFn: ({ signal }) =>
      apiGet<SchemaQuoteOut>(
        `/crops/${p!.crop}/quote`,
        { country: p!.country, area: p!.area, type: p!.type, days: p!.days ?? 30 },
        { signal },
      ),
    enabled: !!p,
  })
}

export interface CompareParams {
  country: string
  area: string
  crop: string
  type: PriceType
}

export function useCompare(p: CompareParams | null) {
  return useQuery({
    queryKey: p ? queryKeys.compare(p) : ['compare', 'off'],
    queryFn: ({ signal }) =>
      apiGet<SchemaCompareOut>(
        `/crops/${p!.crop}/compare`,
        { country: p!.country, area: p!.area, type: p!.type },
        { signal },
      ),
    enabled: !!p,
  })
}

export interface MarketsParams {
  country: string
  area: string
  crop: string
}

export function useMarkets(p: MarketsParams | null) {
  return useQuery({
    queryKey: p ? queryKeys.markets(p) : ['markets', 'off'],
    queryFn: ({ signal }) =>
      apiGet<SchemaMarketsOut>(
        `/crops/${p!.crop}/markets`,
        { country: p!.country, area: p!.area },
        { signal },
      ),
    enabled: !!p,
  })
}

export interface MarketParams {
  country: string
  crop: string
  market: string
}

export function useMarket(p: MarketParams | null) {
  return useQuery({
    queryKey: p ? queryKeys.market(p) : ['market', 'off'],
    queryFn: ({ signal }) =>
      apiGet<SchemaMarketOut>(
        `/crops/${p!.crop}/markets/${p!.market}`,
        { country: p!.country },
        {
          signal,
        },
      ),
    enabled: !!p,
  })
}

/** International reference prices (bonus B5): every series in the country's currency. */
export function useIntlPrices(country: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.intl(country ?? ''),
    queryFn: ({ signal }) => apiGet<SchemaIntlPricesOut>('/intl', { country }, { signal }),
    enabled: !!country,
  })
}

/** One international series with its 12 months (bonus B5). */
export function useIntlSeries(country: string | null | undefined, series: string) {
  return useQuery({
    queryKey: queryKeys.intlSeries(country ?? '', series),
    queryFn: ({ signal }) =>
      apiGet<SchemaIntlSeriesOut>(`/intl/${encodeURIComponent(series)}`, { country }, { signal }),
    enabled: !!country && !!series,
  })
}

export interface NewsParams {
  country: string
  /** My area: the list is of my country and names the areas its items mention. */
  area: string
}

/** The 新聞 list (docs/02 §5.9): up to 9 items, the newest first. */
export function useNews(p: NewsParams | null) {
  return useQuery({
    queryKey: p ? queryKeys.news(p) : ['news', 'off'],
    queryFn: ({ signal }) =>
      apiGet<SchemaNewsOut>('/news', { country: p!.country, area: p!.area }, { signal }),
    enabled: !!p,
  })
}

/** One news item for its detail screen. */
export function useNewsItem(id: number | null) {
  return useQuery({
    queryKey: id === null ? ['newsItem', 'off'] : queryKeys.newsItem(id),
    queryFn: ({ signal }) => apiGet<SchemaNewsItemDetailOut>(`/news/${id}`, {}, { signal }),
    enabled: id !== null,
  })
}

/** The IP-based guess (F17); asked once per setup, never cached across sessions. */
export function useLocate(enabled = true) {
  return useQuery({
    queryKey: queryKeys.locate,
    queryFn: ({ signal }) => apiGet<SchemaLocateOut>('/locate', {}, { signal }),
    enabled,
    staleTime: Infinity,
    placeholderData: undefined,
  })
}

/** The menu's "Refresh" and every "Retry": refetch what is on screen (no polling otherwise). */
export function useRefresh(): () => Promise<void> {
  const client = useQueryClient()
  return () => client.refetchQueries({ type: 'active' })
}

/** The running version (commit) for the About page; it only changes with a deploy. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiGet<SchemaHealthOut>('/health', {}, { signal }),
    staleTime: CATALOG_STALE_MS,
  })
}
