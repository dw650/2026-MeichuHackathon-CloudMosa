import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'
import { renderApp } from '@/test/renderApp'

describe('WatchScreen', () => {
  it('lists every crop of the country with a check box; OK toggles the focused crop', async () => {
    const app = await renderApp('/watch', { history: ['/'] })
    expect(await screen.findByText('洋蔥')).toBeInTheDocument()
    expect(screen.getByRole('heading')).toHaveTextContent('編輯關注')
    expect(document.querySelectorAll('[data-focus-id]')).toHaveLength(21)
    expect([app.softKey('left'), app.softKey('center'), app.softKey('right')]).toEqual([
      '',
      '切換',
      '返回',
    ])

    expect(app.focusedId()).toBe('onion')
    app.press('Enter')
    expect(useSettings.getState().watchlist).not.toContain('onion')
    app.press('Enter')
    // Watching again adds the crop at the end of the list.
    expect(useSettings.getState().watchlist.at(-1)).toBe('onion')

    // No key caps on this list, so digits do nothing.
    const before = useSettings.getState().watchlist
    app.press('3')
    expect(useSettings.getState().watchlist).toEqual(before)
    expect(app.path()).toBe('/watch')
  })

  it('watches an unwatched crop further down and saves it at once', async () => {
    const app = await renderApp('/watch', { history: ['/'] })
    await screen.findByText('葡萄')
    for (let i = 0; i < 7; i += 1) app.press('ArrowDown')
    expect(app.focusedId()).toBe('grapes')
    app.press('Enter')
    expect(useSettings.getState().watchlist.at(-1)).toBe('grapes')
    expect(localStorage.getItem('agriprice.settings')).toContain('grapes')
    await app.back()
    expect(app.path()).toBe('/')
  })
})
