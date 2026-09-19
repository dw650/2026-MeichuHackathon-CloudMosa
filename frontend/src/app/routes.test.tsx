import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'

import { startEntries } from './navigation'
import { paths } from './paths'
import { buildRoutes, SCREEN_NAMES, type ScreenMap } from './routes'

// Route tests use stand-ins, so they keep working when real screens replace the placeholders.
function stub(name: string) {
  return function Stub() {
    return <p data-testid={`screen-${name}`}>{name}</p>
  }
}
const stubs = {} as ScreenMap
for (const name of SCREEN_NAMES) stubs[name] = stub(name)
const routes = buildRoutes(stubs)

function resetStores(setupDone: boolean) {
  localStorage.clear()
  useSettings.setState(useSettings.getInitialState(), true)
  useSession.setState(useSession.getInitialState(), true)
  if (setupDone) {
    useSettings.getState().chooseCountry('IN', {
      default_area_id: 'nashik',
      default_recent_area_ids: ['nashik', 'pune', 'ahmednagar'],
      default_watch: ['onion'],
    })
    useSettings.getState().chooseArea('nashik')
  }
}

function renderAt(entries: string[], index = entries.length - 1) {
  const router = createMemoryRouter(routes, { initialEntries: entries, initialIndex: index })
  const actions: string[] = []
  router.subscribe((state) => actions.push(state.historyAction))
  render(<RouterProvider router={router} />)
  return { router, actions }
}

const where = (router: ReturnType<typeof createMemoryRouter>) =>
  router.state.location.pathname + router.state.location.search

describe('route table', () => {
  beforeEach(() => resetStores(true))
  afterEach(() => localStorage.clear())

  it.each([
    [paths.home(), 'home'],
    [paths.home('all'), 'home'],
    [paths.category('veg'), 'crop-list'],
    [paths.crop('onion', 'today'), 'crop-detail'],
    [paths.crop('onion', 'trend', 'pune'), 'crop-detail'],
    [paths.markets('onion', 'pune'), 'markets'],
    [paths.market('onion', 'lasalgaon'), 'market'],
    [paths.areas('home'), 'areas'],
    [paths.watch(), 'watch'],
    [paths.settings(), 'settings'],
    [paths.settingsItem('language'), 'settings-item'],
    [paths.about(), 'about'],
    [paths.intl(), 'intl'],
    [paths.intlSeries('rice'), 'intl-series'],
    [paths.news(), 'news'],
    [paths.newsItem(12), 'news-item'],
    [paths.setup('lang'), 'setup-lang'],
    [paths.setup('langs'), 'setup-langs'],
    [paths.setup('locate'), 'setup-locate'],
    [paths.setup('country'), 'setup-country'],
    [paths.setup('area'), 'setup-area'],
  ])('%s renders the %s screen', async (path, name) => {
    renderAt([path])
    expect(await screen.findByTestId(`screen-${name}`)).toBeInTheDocument()
  })

  it('sends unknown paths home', async () => {
    const { router } = renderAt(['/nope/nowhere'])
    await screen.findByTestId('screen-home')
    expect(where(router)).toBe('/')
  })

  it('sends an unknown detail tab to the today tab', async () => {
    const { router } = renderAt(['/crop/onion/prices'])
    await screen.findByTestId('screen-crop-detail')
    expect(where(router)).toBe('/crop/onion/today')
  })

  it('starts first-run setup until an area is chosen', async () => {
    resetStores(false)
    const { router } = renderAt(['/crop/onion/today'])
    await screen.findByTestId('screen-setup-lang')
    expect(where(router)).toBe('/setup/lang')
  })

  it('records the last location without the sheet parameter', async () => {
    const { router } = renderAt(['/crop/onion/today?area=pune&sheet=menu'])
    await screen.findByTestId('screen-crop-detail')
    expect(useSession.getState().lastLocation).toEqual({
      path: '/crop/onion/today?area=pune',
      key: router.state.location.key,
    })
  })
})

describe('startEntries', () => {
  beforeEach(() => resetStores(true))

  it('puts home under the last screen so the back key returns home', () => {
    useSession.getState().rememberLocation('/crop/onion/compare?area=pune', 'k1')
    expect(startEntries('/')).toEqual({ entries: ['/', '/crop/onion/compare?area=pune'], index: 1 })
  })

  it('opens home directly when the last screen was home or nothing is stored', () => {
    expect(startEntries('/')).toEqual({ entries: ['/'], index: 0 })
    useSession.getState().rememberLocation('/?tab=all', 'k1')
    expect(startEntries('/')).toEqual({ entries: ['/?tab=all'], index: 0 })
  })

  it('does not restore setup, debug or sheet state', () => {
    useSession.getState().rememberLocation('/setup/country', 'k1')
    expect(startEntries('/')).toEqual({ entries: ['/'], index: 0 })
    useSession.getState().rememberLocation('/debug/keys', 'k2')
    expect(startEntries('/')).toEqual({ entries: ['/'], index: 0 })
    useSession.getState().rememberLocation('/watch?sheet=menu', 'k3')
    expect(startEntries('/')).toEqual({ entries: ['/', '/watch'], index: 1 })
  })

  it('keeps an explicit start URL (other than home) as it is', () => {
    useSession.getState().rememberLocation('/watch', 'k1')
    expect(startEntries('/about')).toEqual({ entries: ['/about'], index: 0 })
  })

  it('does not restore before setup is done', () => {
    resetStores(false)
    useSession.getState().rememberLocation('/watch', 'k1')
    expect(startEntries('/')).toEqual({ entries: ['/'], index: 0 })
  })

  it('restores into a working history: back from the restored screen is home', async () => {
    useSession.getState().rememberLocation('/crop/onion/compare?area=pune', 'k1')
    const { entries, index } = startEntries('/')
    const { router } = renderAt(entries, index)
    await screen.findByTestId('screen-crop-detail')
    await act(() => router.navigate(-1))
    expect(where(router)).toBe('/')
    expect(await screen.findByTestId('screen-home')).toBeInTheDocument()
  })
})
