import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import { renderApp } from '@/test/renderApp'

const card = (id: string) => {
  const found = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)
  if (!found) throw new Error(`no item ${id}`)
  return found
}
const focusIds = () =>
  Array.from(document.querySelectorAll('[data-focus-id]')).map((e) =>
    e.getAttribute('data-focus-id'),
  )
const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) =>
  [app.softKey('left'), app.softKey('center'), app.softKey('right')] as const

describe('CropListScreen', () => {
  it('lists the crops of a category with my area and opens one', async () => {
    const app = await renderApp('/cat/veg', { history: ['/?tab=all'] })
    await screen.findByText('洋蔥')

    expect(screen.getByRole('heading', { name: '蔬菜' })).toBeInTheDocument()
    expect(screen.getByText('Nashik 縣')).toBeInTheDocument()
    expect(screen.getAllByText('批發').length).toBeGreaterThan(0)
    expect(focusIds()).toEqual(['crop:onion', 'crop:tomato', 'crop:potato'])
    expect(card('crop:onion')).toHaveTextContent('2,395')
    expect(card('crop:potato')).toHaveTextContent('本地種 · 昨天')
    expect(app.focusedId()).toBe('crop:onion')
    expect(softKeys(app)).toEqual(['選單', '開啟', '返回'])

    app.press('ArrowDown')
    expect(app.focusedId()).toBe('crop:tomato')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/crop/tomato/today'))
    expect(useSession.getState().recentCrops).toEqual(['tomato'])
  })

  it('lists every crop, with digit key caps on the first nine only', async () => {
    const app = await renderApp('/cat/all')
    await screen.findByText('大蒜')
    expect(screen.getByRole('heading', { name: '全部' })).toBeInTheDocument()
    expect(focusIds()).toHaveLength(10)
    expect(card('crop:banana').querySelector('kbd')).toHaveTextContent('9')
    expect(card('crop:garlic').querySelector('kbd')).toBeNull()
    app.press('9')
    await waitFor(() => expect(app.path()).toBe('/crop/banana/today'))
  })

  it('lists the recently viewed crops, newest first', async () => {
    const app = await renderApp('/cat/recent')
    act(() => {
      useSession.getState().viewCrop('garlic')
      useSession.getState().viewCrop('onion')
    })
    await screen.findByText('大蒜')
    expect(screen.getByRole('heading', { name: '最近' })).toBeInTheDocument()
    expect(focusIds()).toEqual(['crop:onion', 'crop:garlic'])
    expect(app.focusedId()).toBe('crop:onion')
  })

  it('says 無資料 for a category without crops', async () => {
    const app = await renderApp('/cat/oil')
    expect(await screen.findByText('無資料')).toBeInTheDocument()
    expect(focusIds()).toEqual([])
    expect(softKeys(app)).toEqual(['選單', '', '返回'])
  })

  it('switches wholesale ⇄ retail with * and opens the panels with # and the left soft key', async () => {
    const app = await renderApp('/cat/spice')
    await screen.findByText('青辣椒')
    app.press('*')
    expect(useSettings.getState().priceType).toBe('retail')
    await waitFor(() => expect(card('crop:chilli')).toHaveTextContent('尚無零售資料'))
    expect(card('crop:garlic')).toHaveTextContent('131.7')
    expect(screen.getByText('₹/公斤')).toBeInTheDocument()

    app.press('#')
    await waitFor(() => expect(app.path()).toBe('/cat/spice?sheet=area'))
    await app.back()
    app.press('Escape')
    await waitFor(() => expect(app.path()).toBe('/cat/spice?sheet=menu'))
  })

  it('goes home for an unknown category', async () => {
    const app = await renderApp('/cat/nothing')
    await waitFor(() => expect(app.path()).toBe('/'))
  })
})
