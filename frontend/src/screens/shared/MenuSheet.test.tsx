import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useNav } from '@/app/navigation'
import { AppProviders } from '@/app/providers'
import { Shell } from '@/components/Shell/Shell'
import { useKeys } from '@/keys/useKeys'
import { resetApp } from '@/test/renderApp'
import { useSettings } from '@/store/settings'

import { MenuSheet, useMenuSheetSoftKeys } from './MenuSheet'

// A stand-in screen that uses the menu the way the real screens do: the left soft key opens
// it, Shell draws it as the overlay, and the sheet's soft keys replace the screen's own.
function Screen({ cropId }: { cropId?: string }) {
  const nav = useNav()
  const sheetKeys = useMenuSheetSoftKeys()
  useKeys({ onMenu: () => nav.openSheet('menu') })
  return (
    <Shell
      title="screen"
      softKeys={nav.sheet ? sheetKeys : { left: 'menu', right: 'back' }}
      overlay={nav.sheet === 'menu' ? <MenuSheet cropId={cropId} areaFor="view" /> : null}
    />
  )
}

async function renderMenu(path: string, cropId?: string) {
  const router = createMemoryRouter(
    [
      { path: '/crop/:cropId/:tab', element: <Screen cropId={cropId} /> },
      { path: '/', element: <Screen /> },
      { path: '*', element: <p>other screen</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  await act(async () => {})
  const press = (key: string) =>
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key })
    })
  return {
    router,
    press,
    path: () => router.state.location.pathname + router.state.location.search,
    focusedId: () => document.activeElement?.getAttribute('data-focus-id') ?? null,
    softKey: (slot: string) =>
      document.querySelector(`[data-softkey="${slot}"]`)?.textContent ?? '',
    labels: () =>
      Array.from(
        screen.getByRole('dialog').querySelectorAll('[data-focus-id]'),
        (row) => row.textContent,
      ),
  }
}

describe('MenuSheet', () => {
  beforeEach(() => resetApp())

  it('opens with the left soft key; on a detail screen it starts with the watch toggle', async () => {
    const menu = await renderMenu('/crop/onion/today', 'onion')
    menu.press('Escape')
    expect(menu.path()).toBe('/crop/onion/today?sheet=menu')
    expect(screen.getByRole('dialog', { name: '選單' })).toBeInTheDocument()
    expect(menu.labels()).toEqual([
      '1取消關注',
      '2換地區',
      '3編輯關注',
      '4重新整理',
      '5關於與資料說明',
      '6設定',
    ])
    expect(menu.focusedId()).toBe('watchToggle')
    expect([menu.softKey('left'), menu.softKey('center'), menu.softKey('right')]).toEqual([
      '',
      '選取',
      '關閉',
    ])

    // OK on 「取消關注」: onion leaves the watchlist and the menu closes.
    menu.press('Enter')
    expect(useSettings.getState().watchlist).not.toContain('onion')
    expect(menu.path()).toBe('/crop/onion/today')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('runs the N-th row with a digit and opens screens in place of the menu entry', async () => {
    const menu = await renderMenu('/')
    menu.press('Escape')
    expect(menu.focusedId()).toBe('area')
    menu.press('2')
    expect(menu.path()).toBe('/watch')
    // The menu's entry became the watchlist: back returns to the screen below it.
    await act(() => menu.router.navigate(-1))
    expect(menu.path()).toBe('/')

    menu.press('Escape')
    menu.press('5')
    expect(menu.path()).toBe('/settings')

    // 國際參考價 and 新聞 are not rows any more (they are on the home screen, docs/02 §5.2),
    // so the home menu ends at 5 設定 and a sixth digit does nothing.
    await act(() => menu.router.navigate(-1))
    menu.press('Escape')
    menu.press('6')
    expect(menu.path()).toBe('/?sheet=menu')
  })

  it('moves to the area sheet, and closes with the left soft key', async () => {
    const menu = await renderMenu('/')
    menu.press('Escape')
    menu.press('Enter')
    expect(menu.path()).toBe('/?sheet=area')

    await act(() => menu.router.navigate(-1))
    menu.press('Escape')
    menu.press('ArrowDown')
    menu.press('ArrowDown')
    expect(menu.focusedId()).toBe('refresh')
    menu.press('Escape')
    expect(menu.path()).toBe('/')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
