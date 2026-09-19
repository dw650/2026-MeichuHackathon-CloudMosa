/** URL builders for every screen (docs/04 §4.3). Screens link with these, never by hand. */

export type HomeTab = 'watch' | 'all'
export type DetailTab = 'trend' | 'today' | 'compare'
export type SheetName = 'menu' | 'area' | 'sort'
export type SetupStep = 'lang' | 'langs' | 'locate' | 'country' | 'area'
/** Which area the area list changes: my area (home, crop lists) or the one being viewed. */
export type AreasFor = 'home' | 'view'

export const HOME_TABS: readonly HomeTab[] = ['watch', 'all']
export const DETAIL_TABS: readonly DetailTab[] = ['trend', 'today', 'compare']

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

export const paths = {
  home: (tab: HomeTab = 'watch') => (tab === 'watch' ? '/' : `/?tab=${tab}`),
  category: (catId: string) => `/cat/${catId}`,
  crop: (cropId: string, tab: DetailTab = 'today', area?: string) =>
    withQuery(`/crop/${cropId}/${tab}`, { area }),
  markets: (cropId: string, area?: string) => withQuery(`/crop/${cropId}/markets`, { area }),
  market: (cropId: string, marketId: string, area?: string) =>
    withQuery(`/crop/${cropId}/markets/${marketId}`, { area }),
  areas: (forWhat: AreasFor = 'home') => `/areas?for=${forWhat}`,
  watch: () => '/watch',
  settings: () => '/settings',
  settingsItem: (item: string) => `/settings/${item}`,
  about: () => '/about',
  intl: () => '/intl',
  intlSeries: (seriesId: string) => `/intl/${seriesId}`,
  setup: (step: SetupStep) => `/setup/${step}`,
}

/** The same path without `?sheet=` (a panel is never restored or recorded). */
export function withoutSheet(path: string): string {
  const [pathname = '/', search = ''] = path.split('?', 2)
  const query = new URLSearchParams(search)
  query.delete('sheet')
  const text = query.toString()
  return text ? `${pathname}?${text}` : pathname
}

/** The same path with one query parameter set (or removed when `value` is undefined). */
export function withParam(path: string, key: string, value: string | undefined): string {
  const [pathname = '/', search = ''] = path.split('?', 2)
  const query = new URLSearchParams(search)
  if (value === undefined) query.delete(key)
  else query.set(key, value)
  const text = query.toString()
  return text ? `${pathname}?${text}` : pathname
}
