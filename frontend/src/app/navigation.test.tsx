import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'

import { type Nav, useApplyPendingReplace, useNav } from './navigation'

let nav: Nav

function keepNav(value: Nav) {
  nav = value
}

function Probe({ onNav = keepNav }: { onNav?: (value: Nav) => void }) {
  onNav(useNav())
  useApplyPendingReplace()
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function setup(path: string) {
  const routes = [{ path: '*', Component: Probe }]
  const router = createMemoryRouter(routes, { initialEntries: ['/start', path], initialIndex: 1 })
  const actions: string[] = []
  router.subscribe((state) => actions.push(state.historyAction))
  render(<RouterProvider router={router} />)
  return { router, actions }
}

const where = () => screen.getByTestId('where').textContent

describe('useNav', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettings.setState(useSettings.getInitialState(), true)
  })

  it('opens a sheet with one push and closes it with back', async () => {
    const { actions } = setup('/crop/onion/today?area=pune')
    await act(() => nav.openSheet('menu'))
    expect(where()).toBe('/crop/onion/today?area=pune&sheet=menu')
    expect(nav.sheet).toBe('menu')
    await act(() => nav.closeSheet())
    expect(where()).toBe('/crop/onion/today?area=pune')
    expect(actions).toEqual(['PUSH', 'POP'])
  })

  it('does not stack a second sheet entry when one is already open', async () => {
    const { actions } = setup('/?sheet=menu')
    await act(() => nav.openSheet('area'))
    expect(where()).toBe('/?sheet=area')
    expect(actions).toEqual(['REPLACE'])
  })

  it('replaces the sheet entry when a sheet item opens another screen', async () => {
    const { actions } = setup('/?sheet=menu')
    await act(() => nav.leaveSheet('/settings'))
    expect(where()).toBe('/settings')
    expect(actions).toEqual(['REPLACE'])
  })

  it('switches tabs without adding history', async () => {
    const { router, actions } = setup('/crop/onion/today?area=pune')
    await act(() => nav.switchTab('/crop/onion/trend?area=pune'))
    expect(where()).toBe('/crop/onion/trend?area=pune')
    expect(actions).toEqual(['REPLACE'])
    await act(() => router.navigate(-1))
    expect(where()).toBe('/start')
  })

  it('opens screens with a push and goes back with a pop', async () => {
    const { actions } = setup('/')
    await act(() => nav.open('/about'))
    expect(where()).toBe('/about')
    await act(() => nav.back())
    expect(where()).toBe('/')
    expect(actions).toEqual(['PUSH', 'POP'])
  })

  it('closing a sheet that was restored without history falls back to removing the parameter', async () => {
    const routes = [{ path: '*', Component: Probe }]
    const router = createMemoryRouter(routes, { initialEntries: ['/watch?sheet=menu'] })
    render(<RouterProvider router={router} />)
    await act(() => nav.closeSheet())
    expect(where()).toBe('/watch')
  })

  it('closes a sheet and then changes the screen below without adding history', async () => {
    const routes = [{ path: '*', Component: Probe }]
    const router = createMemoryRouter(routes, {
      initialEntries: [
        '/start',
        '/crop/onion/today?area=nashik',
        '/crop/onion/today?area=nashik&sheet=area',
      ],
      initialIndex: 2,
    })
    const actions: string[] = []
    router.subscribe((state) => actions.push(state.historyAction))
    render(<RouterProvider router={router} />)
    await act(() => nav.closeSheetAndReplace('/crop/onion/today?area=pune'))
    expect(where()).toBe('/crop/onion/today?area=pune')
    expect(actions).toEqual(['POP', 'REPLACE'])
    await act(() => router.navigate(-1))
    expect(where()).toBe('/start')
  })

  it('goes back several entries and replaces the one it lands on', async () => {
    const routes = [{ path: '*', Component: Probe }]
    const router = createMemoryRouter(routes, {
      initialEntries: ['/setup/lang', '/setup/country', '/setup/area'],
      initialIndex: 2,
    })
    render(<RouterProvider router={router} />)
    await act(() => nav.backAndReplace('/', 2))
    expect(where()).toBe('/')
    expect(router.state.historyAction).toBe('REPLACE')
    await act(() => nav.backAndReplace('/about', 0))
    expect(where()).toBe('/about')
  })
})
