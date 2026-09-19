import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { createQueryClient } from '@/api/queryClient'
import { setLanguage } from '@/i18n'
import countries from '@/test/fixtures/countries.json'
import crops from '@/test/fixtures/countries_TW_crops.json'
import { server } from '@/test/msw/server'
import { useSettings } from '@/store/settings'

import { useEstimate } from './useEstimate'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  )
}

/** Taiwan on a wholesale-only source: retail is estimated and carries a ratio per crop. */
function serveEstimatedRetail() {
  const ratios: Record<string, number> = { cabbage: 1.7, bokchoy: 1.8, rice: 1.3 }
  server.use(
    http.get('*/api/v1/countries', () =>
      HttpResponse.json({
        countries: countries.countries.map((c) =>
          c.code === 'TW' ? { ...c, estimated_price_types: ['retail'] } : c,
        ),
      }),
    ),
    http.get('*/api/v1/countries/TW/crops', () =>
      HttpResponse.json({
        country: 'TW',
        crops: crops.crops.map((c) => ({ ...c, estimate_ratio: ratios[c.id] ?? 1.6 })),
      }),
    ),
  )
}

async function estimate() {
  const { result } = renderHook(() => useEstimate(), { wrapper })
  await waitFor(() => expect(result.current.typeLabel('wholesale')).toBe('批發'))
  return result
}

describe('useEstimate', () => {
  beforeEach(() => {
    localStorage.clear()
    setLanguage('zh-TW')
    useSettings.setState(useSettings.getInitialState(), true)
    useSettings.getState().chooseCountry('TW', {
      default_area_id: 'taipei',
      default_recent_area_ids: ['taipei'],
      default_watch: ['cabbage'],
      default_price_type: 'wholesale',
    })
    useSettings.getState().chooseArea('taipei')
  })

  it('says nothing while every price type comes from a source', async () => {
    const result = await estimate()
    expect(result.current.isEstimated('retail')).toBe(false)
    expect(result.current.typeLabel('retail')).toBe('零售')
    expect(result.current.note('retail', 'cabbage')).toBeNull()
  })

  it('marks the estimated price type in the tag on every screen', async () => {
    serveEstimatedRetail()
    const result = await estimate()
    await waitFor(() => expect(result.current.isEstimated('retail')).toBe(true))
    expect(result.current.typeLabel('retail')).toBe('≈零售')
    // The type the source really reports keeps its plain tag.
    expect(result.current.isEstimated('wholesale')).toBe(false)
    expect(result.current.typeLabel('wholesale')).toBe('批發')
  })

  it('names the ratio of the crop on screen and the direction', async () => {
    serveEstimatedRetail()
    const result = await estimate()
    await waitFor(() => expect(result.current.note('retail', 'cabbage')).not.toBeNull())
    expect(result.current.note('retail', 'cabbage')).toBe('零售價由批發價 ×1.7 推估，僅供參考')
    expect(result.current.note('retail', 'bokchoy')).toBe('零售價由批發價 ×1.8 推估，僅供參考')
  })

  it('leaves the ratio out when the screen shows many crops', async () => {
    serveEstimatedRetail()
    const result = await estimate()
    await waitFor(() => expect(result.current.note('retail')).not.toBeNull())
    expect(result.current.note('retail')).toBe('零售價由批發價推估，僅供參考')
  })

  it('never labels the price type the source reports', async () => {
    serveEstimatedRetail()
    const result = await estimate()
    await waitFor(() => expect(result.current.isEstimated('retail')).toBe(true))
    expect(result.current.note('wholesale', 'cabbage')).toBeNull()
  })
})
