import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { createQueryClient } from '@/api/queryClient'
import { useSettings } from '@/store/settings'

import { usePriceFormat } from './usePriceFormat'
import { useCountryData } from './useCountryData'
import { areaLabel, useText } from './useText'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient({ retry: false })}>
      {children}
    </QueryClientProvider>
  )
}

function chooseIndia() {
  useSettings.getState().chooseCountry('IN', {
    default_area_id: 'nashik',
    default_recent_area_ids: ['nashik'],
    default_watch: ['onion'],
    default_price_type: 'wholesale',
  })
  useSettings.getState().chooseArea('nashik')
}

describe('screen kit', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettings.setState(useSettings.getInitialState(), true)
    chooseIndia()
  })

  it('loads the chosen country with its areas and crops', async () => {
    const { result } = renderHook(() => useCountryData(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.country?.currency).toBe('INR')
    expect(result.current.areas).toHaveLength(64)
    expect(result.current.myArea?.id).toBe('nashik')
    expect(result.current.crop('onion')?.category).toBe('veg')
  })

  it('formats per-kg prices in the default unit of the price type', async () => {
    const { result } = renderHook(() => usePriceFormat(), { wrapper })
    await waitFor(() => expect(result.current.unitLabel).not.toBe(''))
    expect(result.current.unit.id).toBe('qtl')
    expect(result.current.price(23.95)).toBe('2,395')
    expect(result.current.price(1234.5)).toBe('1,23,450')
    expect(result.current.price(null)).toBe('—')
    expect(result.current.diff(0.95)).toBe('+95')
  })

  it('follows the unit chosen in the settings and the retail default', async () => {
    useSettings.getState().setUnit('wholesale', 'kg')
    const { result } = renderHook(() => ({ w: usePriceFormat(), r: usePriceFormat('retail') }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.w.unitLabel).not.toBe(''))
    expect(result.current.w.price(23.95)).toBe('24.0')
    expect(result.current.r.unit.id).toBe('kg')
  })

  it('builds area labels with the country suffix', async () => {
    const { result } = renderHook(() => ({ text: useText(), data: useCountryData() }), { wrapper })
    await waitFor(() => expect(result.current.data.country).toBeDefined())
    const { text, data } = result.current
    expect(areaLabel(data.myArea, data.country, 'zh-TW')).toBe('Nashik 縣')
    expect(areaLabel(data.myArea, data.country, 'en')).toBe('Nashik district')
    expect(text.pick({ 'zh-TW': '洋蔥', en: 'Onion' })).toMatch(/洋蔥|Onion/)
  })
})
