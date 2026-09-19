/**
 * msw handlers serving real API responses saved as fixtures (backend/tests/dump_api_fixtures.py).
 * Requests without an exact fixture fall back to the closest one with its ids patched, so screen
 * tests can use any crop or area; use `server.use(...)` for errors and special cases.
 */
import { http, HttpResponse } from 'msw'

type Json = Record<string, unknown>

const files = import.meta.glob<Json>('../fixtures/*.json', { eager: true, import: 'default' })
const fixtures: Record<string, Json> = Object.fromEntries(
  Object.entries(files).map(([path, data]) => [
    path.replace(/^.*\//, '').replace(/\.json$/, ''),
    data,
  ]),
)

const DEFAULT_AREA: Record<string, string> = { IN: 'nashik', TW: 'taipei' }
const SHOWCASE_CROP: Record<string, string> = { IN: 'onion', TW: 'cabbage' }
const SHOWCASE_MARKET: Record<string, string> = { IN: 'lasalgaon', TW: 'tp1' }

function name(path: string, params: Record<string, string>): string {
  const base = path.replace(/^\//, '').replaceAll('/', '_')
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}-${params[k]}`)
    .join('_')
  return query ? `${base}__${query}` : base
}

function clone(data: Json): Json {
  return structuredClone(data)
}

function find(path: string, params: Record<string, string>): Json | undefined {
  const data = fixtures[name(path, params)]
  return data ? clone(data) : undefined
}

function notFound(code: string): Response {
  return HttpResponse.json({ error: { code, message: code, request_id: 'msw' } }, { status: 404 })
}

function queryOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams
}

export const handlers = [
  http.get('*/api/v1/health', () => HttpResponse.json(find('/health', {}))),
  http.get('*/api/v1/countries', () => HttpResponse.json(find('/countries', {}))),

  http.get('*/api/v1/countries/:cc/:kind', ({ params }) => {
    const data = find(`/countries/${String(params.cc)}/${String(params.kind)}`, {})
    return data ? HttpResponse.json(data) : notFound('country_not_found')
  }),

  http.get('*/api/v1/prices', ({ request }) => {
    const q = queryOf(request)
    const country = q.get('country') ?? ''
    const area = q.get('area') ?? ''
    const type = q.get('type') ?? 'wholesale'
    const exact = find('/prices', { area, country, type })
    const data = exact ?? find('/prices', { area: DEFAULT_AREA[country] ?? '', country, type })
    if (!data) return notFound('area_not_found')
    data.area_id = area
    const crops = q.get('crops')
    if (crops) {
      const items = data.items as Json[]
      data.items = crops
        .split(',')
        .map((id) => items.find((i) => i.crop_id === id))
        .filter((i): i is Json => i !== undefined)
    }
    return HttpResponse.json(data)
  }),

  http.get('*/api/v1/crops/:crop/quote', ({ request, params }) => {
    const q = queryOf(request)
    const country = q.get('country') ?? ''
    const area = q.get('area') ?? ''
    const type = q.get('type') ?? 'wholesale'
    const days = q.get('days') ?? '30'
    const crop = String(params.crop)
    const exact =
      find(`/crops/${crop}/quote`, { area, country, days, type }) ??
      find(`/crops/${crop}/quote`, { area, country, days: '30', type })
    const data =
      exact ??
      find(`/crops/${SHOWCASE_CROP[country] ?? ''}/quote`, {
        area: DEFAULT_AREA[country] ?? '',
        country,
        days: '30',
        type,
      })
    if (!data) return notFound('crop_not_found')
    Object.assign(data, { crop_id: crop, area_id: area })
    data.series = (data.series as Json[]).slice(-Number(days))
    // Nearby prices belong to the fixture's own crop and area: none for a borrowed one.
    if (!exact) data.nearby = null
    return HttpResponse.json(data)
  }),

  http.get('*/api/v1/crops/:crop/compare', ({ request, params }) => {
    const q = queryOf(request)
    const country = q.get('country') ?? ''
    const crop = String(params.crop)
    const base = { area: DEFAULT_AREA[country] ?? '', country, type: q.get('type') ?? 'wholesale' }
    const data =
      find(`/crops/${crop}/compare`, base) ??
      find(`/crops/${SHOWCASE_CROP[country] ?? ''}/compare`, { ...base, type: 'wholesale' })
    if (!data) return notFound('crop_not_found')
    Object.assign(data, { crop_id: crop, type: base.type })
    return HttpResponse.json(data)
  }),

  http.get('*/api/v1/crops/:crop/markets', ({ request, params }) => {
    const q = queryOf(request)
    const country = q.get('country') ?? ''
    const crop = String(params.crop)
    const base = { area: DEFAULT_AREA[country] ?? '', country }
    const data =
      find(`/crops/${crop}/markets`, base) ??
      find(`/crops/${SHOWCASE_CROP[country] ?? ''}/markets`, base)
    if (!data) return notFound('crop_not_found')
    data.crop_id = crop
    return HttpResponse.json(data)
  }),

  http.get('*/api/v1/crops/:crop/markets/:market', ({ request, params }) => {
    const country = queryOf(request).get('country') ?? ''
    const crop = String(params.crop)
    const market = String(params.market)
    const data =
      find(`/crops/${crop}/markets/${market}`, { country }) ??
      find(`/crops/${SHOWCASE_CROP[country] ?? ''}/markets/${SHOWCASE_MARKET[country] ?? ''}`, {
        country,
      })
    if (!data) return notFound('market_not_found')
    Object.assign(data, { crop_id: crop, market_id: market })
    return HttpResponse.json(data)
  }),

  http.get('*/api/v1/intl', ({ request }) => {
    const data = find('/intl', { country: queryOf(request).get('country') ?? '' })
    return data ? HttpResponse.json(data) : notFound('country_not_found')
  }),

  http.get('*/api/v1/intl/:series', ({ request, params }) => {
    const country = queryOf(request).get('country') ?? ''
    const data = find(`/intl/${String(params.series)}`, { country })
    if (data) return HttpResponse.json(data)
    return notFound(find('/intl', { country }) ? 'series_not_found' : 'country_not_found')
  }),

  http.get('*/api/v1/locate', () => HttpResponse.json(find('/locate', {}))),
]
