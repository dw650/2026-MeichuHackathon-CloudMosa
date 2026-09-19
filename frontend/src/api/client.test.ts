import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw/server'

import { ApiError, apiGet, errorKind, setRequestHeaders } from './client'

afterEach(() => {
  vi.useRealTimers()
  setRequestHeaders(() => ({}))
})

describe('apiGet', () => {
  it('returns the JSON body of a successful response', async () => {
    const body = await apiGet<{ countries: unknown[] }>('/countries')
    expect(body.countries).toHaveLength(3)
  })

  it('sends query parameters and skips undefined ones', async () => {
    let seen = ''
    server.use(
      http.get('*/api/v1/prices', ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({ items: [] })
      }),
    )
    await apiGet('/prices', { country: 'IN', area: 'nashik', crops: undefined })
    expect(seen).toBe('?country=IN&area=nashik')
  })

  it('turns the error body into an ApiError with its code and request id', async () => {
    server.use(
      http.get('*/api/v1/countries/XX/areas', () =>
        HttpResponse.json(
          { error: { code: 'country_not_found', message: 'nope', request_id: 'r1' } },
          { status: 404 },
        ),
      ),
    )
    const error = await apiGet('/countries/XX/areas').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'country_not_found', status: 404, requestId: 'r1' })
  })

  it.each([
    [500, 'internal'],
    [503, 'upstream_unavailable'],
    [400, 'invalid_param'],
    [404, 'not_found'],
    [418, 'http_error'],
  ])('maps a %i without an error body to %s', async (status, code) => {
    server.use(http.get('*/api/v1/countries', () => new HttpResponse('oops', { status })))
    await expect(apiGet('/countries')).rejects.toMatchObject({ code, status })
  })

  it('reports a network failure', async () => {
    server.use(http.get('*/api/v1/countries', () => HttpResponse.error()))
    await expect(apiGet('/countries')).rejects.toMatchObject({ code: 'network' })
  })

  it('gives up after 10 seconds', async () => {
    vi.useFakeTimers()
    const never: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
      })
    const pending = apiGet('/countries', {}, { fetchImpl: never }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(9_999)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toMatchObject({ code: 'timeout' })
  })

  it('stops when the caller cancels', async () => {
    const controller = new AbortController()
    const never: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
      })
    const pending = apiGet('/countries', {}, { fetchImpl: never, signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
  })

  it('adds the registered demo headers to every request', async () => {
    let fail: string | null = null
    server.use(
      http.get('*/api/v1/countries', ({ request }) => {
        fail = request.headers.get('X-Demo-Fail')
        return HttpResponse.json({ countries: [] })
      }),
    )
    setRequestHeaders(() => ({ 'X-Demo-Fail': '1' }))
    await apiGet('/countries')
    expect(fail).toBe('1')
  })
})

describe('errorKind', () => {
  it.each([
    ['area_not_found', 'not_found'],
    ['crop_not_found', 'not_found'],
    ['country_not_found', 'not_found'],
    ['market_not_found', 'not_found'],
    ['invalid_param', 'bad_request'],
    ['demo_failure', 'unavailable'],
    ['upstream_unavailable', 'unavailable'],
    ['timeout', 'unavailable'],
    ['network', 'unavailable'],
    ['internal', 'unavailable'],
  ])('%s is %s', (code, kind) => {
    expect(errorKind(new ApiError(code, 0))).toBe(kind)
  })

  it('treats unknown errors as unavailable', () => {
    expect(errorKind(new Error('boom'))).toBe('unavailable')
  })
})
