import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/msw/server'

import { createQueryClient, shouldRetry } from './queryClient'
import {
  useAreas,
  useCompare,
  useCountries,
  useCrops,
  useLocate,
  useMarket,
  useMarkets,
  usePrices,
  useQuote,
} from './queries'
import { ApiError } from './client'

function wrapper() {
  const client = createQueryClient({ retry: false })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, Wrapper }
}

describe('query hooks', () => {
  it('load every endpoint from the fixtures', async () => {
    const { Wrapper } = wrapper()
    const { result } = renderHook(
      () => ({
        countries: useCountries(),
        areas: useAreas('IN'),
        crops: useCrops('TW'),
        prices: usePrices({ country: 'IN', area: 'nashik', type: 'wholesale', crops: ['onion'] }),
        quote: useQuote({ country: 'IN', area: 'nashik', crop: 'onion', type: 'wholesale' }),
        compare: useCompare({ country: 'IN', area: 'nashik', crop: 'onion', type: 'wholesale' }),
        markets: useMarkets({ country: 'IN', area: 'nashik', crop: 'onion' }),
        market: useMarket({ country: 'IN', crop: 'onion', market: 'lasalgaon' }),
        locate: useLocate(),
      }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(Object.values(result.current).every((q) => q.isSuccess)).toBe(true))
    const r = result.current
    expect(r.countries.data?.countries.map((c) => c.code)).toEqual(['IN', 'TW'])
    expect(r.areas.data?.areas).toHaveLength(11)
    expect(r.crops.data?.crops).toHaveLength(10)
    expect(r.prices.data?.items.map((i) => i.crop_id)).toEqual(['onion'])
    expect(r.quote.data?.series).toHaveLength(30)
    expect(r.compare.data?.rows).toHaveLength(11)
    expect(r.markets.data?.rows).toHaveLength(10)
    expect(r.market.data?.market_id).toBe('lasalgaon')
    expect(r.locate.data).toEqual({ country: 'IN', area_id: 'nashik' })
  })

  it('do not run without their required parameters', () => {
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useAreas(null), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('keep the previous data when a refetch fails with 503', async () => {
    const { client, Wrapper } = wrapper()
    const params = { country: 'IN', area: 'nashik', type: 'wholesale' as const }
    const { result } = renderHook(() => usePrices(params), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const before = result.current.data
    server.use(
      http.get('*/api/v1/prices', () =>
        HttpResponse.json(
          { error: { code: 'demo_failure', message: 'x', request_id: 'r' } },
          { status: 503 },
        ),
      ),
    )
    await act(() => client.refetchQueries())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBe(before)
    expect(result.current.error).toMatchObject({ code: 'demo_failure' })
  })

  it('keep showing the old area while the new one loads', async () => {
    const { Wrapper } = wrapper()
    const { result, rerender } = renderHook(
      ({ area }: { area: string }) => usePrices({ country: 'IN', area, type: 'wholesale' }),
      { wrapper: Wrapper, initialProps: { area: 'nashik' } },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ area: 'pune' })
    expect(result.current.data?.area_id).toBe('nashik')
    expect(result.current.isPlaceholderData).toBe(true)
    await waitFor(() => expect(result.current.data?.area_id).toBe('pune'))
  })
})

describe('shouldRetry', () => {
  it('retries a connection problem once, but never a timeout or a 4xx', () => {
    expect(shouldRetry(0, new ApiError('upstream_unavailable', 503))).toBe(true)
    expect(shouldRetry(1, new ApiError('upstream_unavailable', 503))).toBe(false)
    expect(shouldRetry(0, new ApiError('network', 0))).toBe(true)
    expect(shouldRetry(0, new ApiError('timeout', 0))).toBe(false)
    expect(shouldRetry(0, new ApiError('area_not_found', 404))).toBe(false)
    expect(shouldRetry(0, new ApiError('invalid_param', 400))).toBe(false)
  })
})
