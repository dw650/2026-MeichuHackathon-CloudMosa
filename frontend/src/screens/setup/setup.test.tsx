import { screen, waitFor } from '@testing-library/react'
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
