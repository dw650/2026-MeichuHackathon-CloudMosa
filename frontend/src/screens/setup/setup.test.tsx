import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettings } from '@/store/settings'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

type App = Awaited<ReturnType<typeof renderApp>>

const softKeys = (app: App) => [app.softKey('left'), app.softKey('center'), app.softKey('right')]
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-focus-id]'), (el) => el.getAttribute('data-focus-id'))

/** The network cannot tell where the phone is. */
const noGuess = () =>
  server.use(http.get('*/api/v1/locate', () => HttpResponse.json({ country: null, area_id: null })))

beforeEach(() => {
  // jsdom says en-US; these tests use a phone set to Chinese.
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-TW')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('language screen', () => {
  it('lists the phone language first, marks हिन्दी and ends with More', async () => {
    const app = await renderApp('/setup/lang', { country: null })
    expect(screen.getByRole('heading')).toHaveTextContent('Language・語言')
    expect(screen.getByRole('img', { name: '第 1 步，共 3 步' })).toBeInTheDocument()
    expect(rowIds()).toEqual(['zh-TW', 'en', 'hi', 'more'])
    expect(app.focusedId()).toBe('zh-TW')
    expect(screen.getByText('手機語言')).toBeInTheDocument()
    expect(screen.getByText('→ English・尚未提供')).toBeInTheDocument()
    expect(softKeys(app)).toEqual(['', '選取', '離開'])
    app.press('ArrowDown')
    expect(app.focusedId()).toBe('en')
  })

  it('opens the other languages from More', async () => {
    const app = await renderApp('/setup/lang', { country: null })
    app.press('4')
    expect(app.path()).toBe('/setup/langs?depth=1')
    expect(screen.getByRole('heading')).toHaveTextContent('More・其他')
  })

  it('opens the next screen once when two OK presses arrive together', async () => {
    const app = await renderApp('/setup/lang', { country: null })
    ;['ArrowDown', 'ArrowDown', 'ArrowDown'].forEach((key) => app.press(key))
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })
    })
    expect(app.path()).toBe('/setup/langs?depth=1')
    await app.back()
    expect(app.path()).toBe('/setup/lang')
  })
})

describe('other languages screen', () => {
  it('turns pages with ◀ ▶ and moves on with the chosen language', async () => {
    const app = await renderApp('/setup/langs?depth=1', {
      country: null,
      history: ['/setup/lang'],
    })
    expect(screen.getByText(/第 1／2 頁/)).toBeInTheDocument()
    expect(rowIds()).toEqual(['bn', 'mr', 'vi', 'sw'])
    expect(screen.getAllByText('→ English・尚未提供')).toHaveLength(4)
    expect(softKeys(app)).toEqual(['', '選取', '返回'])
    app.press('ArrowRight')
    expect(app.path()).toBe('/setup/langs?depth=1&page=2')
    expect(rowIds()).toEqual(['ur', 'ta', 'te', 'id'])
    expect(app.focusedId()).toBe('ur')
    app.press('ArrowRight')
    expect(app.path()).toBe('/setup/langs?depth=1&page=2')
    app.press('ArrowDown')
    app.press('Enter')
    expect(useSettings.getState().language).toBe('ta')
    expect(app.path()).toBe('/setup/locate?depth=2')
  })
})

describe('location check screen', () => {
  it('asks about the guessed area; 2 opens the country list', async () => {
    const app = await renderApp('/setup/locate?depth=1', {
      country: null,
      history: ['/setup/lang'],
    })
    expect(await screen.findByText('你在 Nashik 縣 附近嗎？')).toBeInTheDocument()
    expect(screen.getByText('Maharashtra · 印度')).toBeInTheDocument()
    expect(screen.getByText('依網路位置推測（不用 GPS，也不保存）')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '第 2 步，共 3 步' })).toBeInTheDocument()
    expect(app.focusedId()).toBe('yes')
    expect(softKeys(app)).toEqual(['', '選取', '返回'])
    app.press('2')
    expect(app.path()).toBe('/setup/country?depth=2')
  })

  it('speaks the chosen language', async () => {
    await renderApp('/setup/locate?depth=1', { country: null, lang: 'en' })
    expect(await screen.findByText('Are you near Nashik district?')).toBeInTheDocument()
    expect(screen.getByText('Maharashtra · India')).toBeInTheDocument()
  })

  it('gives way to the country list when there is no guess', async () => {
    noGuess()
    const app = await renderApp('/setup/locate?depth=1', { country: null })
    await waitFor(() => expect(app.path()).toBe('/setup/country?depth=1'))
  })
})

describe('country screen', () => {
  it('lists each country with its coverage and goes back after a change once set up', async () => {
    const app = await renderApp('/setup/country', { history: ['/areas?for=home'] })
    expect(await screen.findByText('台灣')).toBeInTheDocument()
    expect(rowIds()).toEqual(['IN', 'TW', 'MY'])
    expect(screen.getByText('6 個邦、11 個縣')).toBeInTheDocument()
    expect(screen.getByText('馬來西亞')).toBeInTheDocument()
    expect(screen.getByText('11 個州與直轄區')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /步/ })).toBeNull()
    expect(app.focusedId()).toBe('IN')
    expect(softKeys(app)).toEqual(['', '選取', '返回'])
    app.press('ArrowDown')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/areas?for=home'))
    expect(useSettings.getState()).toMatchObject({ country: 'TW', areaId: 'taipei' })
  })

  it('sets up Malaysia with 3: Kuala Lumpur first, its watchlist and RM prices', async () => {
    const app = await renderApp('/setup/country?depth=1', {
      country: null,
      lang: 'en',
      history: ['/setup/lang'],
    })
    expect(await screen.findByText('Malaysia')).toBeInTheDocument()
    app.press('3')
    expect(app.path()).toBe('/setup/area?depth=2')
    expect(await screen.findByText('Kuala Lumpur')).toBeInTheDocument()
    expect(rowIds()[0]).toBe('kualalumpur')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/'))
    expect(useSettings.getState()).toMatchObject({
      country: 'MY',
      areaId: 'kualalumpur',
      watchlist: ['tomato', 'cabbage', 'chilli', 'onion', 'cucumber', 'bokchoy', 'garlic'],
    })
    expect(await screen.findByText('RM/kg')).toBeInTheDocument()
  })

  it('offers a retry when the countries cannot be loaded', async () => {
    const error = { error: { code: 'invalid_param', message: 'x', request_id: 't' } }
    server.use(
      http.get('*/api/v1/countries', () => HttpResponse.json(error, { status: 400 }), {
        once: true,
      }),
    )
    const app = await renderApp('/setup/country?depth=1', {
      country: null,
      history: ['/setup/lang'],
    })
    expect(await screen.findByText('連線失敗')).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(app.softKey('center')).toBe('重試')
    app.press('Enter')
    expect(await screen.findByText('台灣')).toBeInTheDocument()
    expect(app.focusedId()).toBe('IN')
    expect(app.softKey('center')).toBe('選取')
  })
})

describe('first-run setup', () => {
  it('language, then yes to the guessed area: home, with nothing behind it', async () => {
    const app = await renderApp('/setup/lang', { country: null })
    app.press('Enter')
    expect(app.path()).toBe('/setup/locate?depth=1')
    expect(await screen.findByText('你在 Nashik 縣 附近嗎？')).toBeInTheDocument()
    app.press('1')
    await waitFor(() => expect(app.path()).toBe('/'))
    expect(useSettings.getState()).toMatchObject({
      language: 'zh-TW',
      country: 'IN',
      areaId: 'nashik',
      setupDone: true,
      watchlist: ['onion', 'tomato', 'potato', 'chilli', 'soybean', 'maize', 'wheat'],
    })
    await app.back()
    expect(app.path()).toBe('/')
  })

  it('without a guess: language, country, area nearest first, then home', async () => {
    noGuess()
    const app = await renderApp('/setup/lang', { country: null })
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/setup/country?depth=1'))
    expect(await screen.findByText('台灣')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '第 2 步，共 3 步' })).toBeInTheDocument()
    app.press('2')
    expect(app.path()).toBe('/setup/area?depth=2')
    expect(await screen.findByText('台北市')).toBeInTheDocument()
    expect(screen.getByRole('heading')).toHaveTextContent('你的地區')
    expect(screen.getByRole('img', { name: '第 3 步，共 3 步' })).toBeInTheDocument()
    expect(rowIds().slice(0, 5)).toEqual(['taipei', 'newtaipei', 'taoyuan', 'yilan', 'hualien'])
    expect(screen.getByText('北部 · 直線 11 km')).toBeInTheDocument()
    expect(screen.getByText('3 天前')).toBeInTheDocument()
    expect(screen.getByText('無資料')).toBeInTheDocument()
    expect(app.focusedId()).toBe('taipei')
    expect(softKeys(app)).toEqual(['', '選取', '返回'])
    app.press('2')
    await waitFor(() => expect(app.path()).toBe('/'))
    expect(useSettings.getState()).toMatchObject({
      country: 'TW',
      areaId: 'newtaipei',
      setupDone: true,
      watchlist: ['cabbage', 'bokchoy', 'banana', 'sweetpotato', 'scallion', 'cauliflower'],
    })
    await app.back()
    expect(app.path()).toBe('/')
  })

  it('asks for a country before the area', async () => {
    const app = await renderApp('/setup/area?depth=1', { country: null, history: ['/setup/lang'] })
    await waitFor(() => expect(app.path()).toBe('/setup/country?depth=1'))
  })
})
