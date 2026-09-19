import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettings } from '@/store/settings'
import { renderApp } from '@/test/renderApp'

type App = Awaited<ReturnType<typeof renderApp>>

const softKeys = (app: App) => [app.softKey('left'), app.softKey('center'), app.softKey('right')]
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-focus-id]'), (el) => el.getAttribute('data-focus-id'))

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
