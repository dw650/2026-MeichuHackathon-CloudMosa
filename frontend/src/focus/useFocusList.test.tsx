import { act, fireEvent, render, screen } from '@testing-library/react'
import { createContext, StrictMode, useContext, useRef } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider, useSearchParams } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeys } from '@/keys/useKeys'
import { selectFocusId, useSession } from '@/store/session'
import { column, stubLayout } from '@/test/layout'

import { useFocusList, type FocusListOptions } from './useFocusList'

type Options = Omit<FocusListOptions, 'root'>

const CROPS = ['crop:a', 'crop:b', 'crop:c', 'crop:d', 'crop:e']
const MENU = ['menu:refresh', 'menu:settings']

const press = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key })
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.focusId

function Items({ ids }: { ids: readonly string[] }) {
  return ids.map((id) => (
    <div key={id} data-focus-id={id} tabIndex={-1}>
      {id}
    </div>
  ))
}

/** A screen as the real ones are built: info bar above the list, one useKeys call. */
function List({ ids, options }: { ids: readonly string[]; options?: Options }) {
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(ids, { ...options, root })
  useKeys(list.keys)
  return (
    <main style={{ overflowY: 'auto' }}>
      <p>info bar</p>
      <div ref={root}>
        <Items ids={ids} />
      </div>
      <output>{list.focusedId}</output>
    </main>
  )
}

function renderList(ids: readonly string[], options?: Options) {
  const view = render(
    <MemoryRouter>
      <List ids={ids} options={options} />
    </MemoryRouter>,
  )
  const setIds = (next: readonly string[]) =>
    view.rerender(
      <MemoryRouter>
        <List ids={next} options={options} />
      </MemoryRouter>,
    )
  // 100px visible; 40px of info bar and tabs, then items 30px tall, 4px apart:
  // a 40–70, b 74–104, c 108–138, d 142–172, e 176–206.
  const content = screen.getByRole('main')
  stubLayout(content, 100, column(ids, 40, 30, 4))
  return { content, setIds }
}

// Screens and panels in a real router, with the list data coming from outside like a query.
const Ids = createContext<readonly string[]>([])

function Menu() {
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(MENU, { root })
  useKeys(list.keys, { layer: 'overlay' })
  return (
    <div role="dialog" ref={root}>
      <Items ids={MENU} />
    </div>
  )
}

function Screen({ options }: { options?: Options }) {
  const ids = useContext(Ids)
  const [params] = useSearchParams()
  const sheet = params.has('sheet')
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(ids, { ...options, root, active: !sheet })
  useKeys(list.keys)
  return (
    <>
      <main style={{ overflowY: 'auto' }}>
        <div ref={root}>
          <Items ids={ids} />
        </div>
      </main>
      {sheet && <Menu />}
    </>
  )
}

function renderApp(ids: readonly string[], options?: Options) {
  const router = createMemoryRouter([
    { path: '/', element: <Screen options={options} /> },
    { path: '/other', element: <p>other screen</p> },
  ])
  const app = (list: readonly string[]) => (
    <StrictMode>
      <Ids.Provider value={list}>
        <RouterProvider router={router} />
      </Ids.Provider>
    </StrictMode>
  )
  const view = render(app(ids))
  return {
    router,
    setIds: (next: readonly string[]) => view.rerender(app(next)),
    go: (to: string) => act(() => router.navigate(to)),
    back: () => act(() => router.navigate(-1)),
    remembered: () => selectFocusId(router.state.location.key)(useSession.getState()),
  }
}

beforeEach(() => {
  useSession.setState(useSession.getInitialState(), true)
  localStorage.clear()
})

describe('useFocusList', () => {
  it('starts a new screen on the first item, with real DOM focus', () => {
    renderList(CROPS)
    expect(focused()).toBe('crop:a')
    expect(screen.getByRole('status')).toHaveTextContent('crop:a')
  })

  it('moves with ↑ ↓ and stops at both ends of the list', () => {
    renderList(CROPS.slice(0, 3))
    press('ArrowUp')
    expect(focused()).toBe('crop:a')
    for (let i = 0; i < 4; i += 1) press('ArrowDown')
    expect(focused()).toBe('crop:c')
    press('ArrowUp')
    expect(focused()).toBe('crop:b')
    expect(screen.getByRole('status')).toHaveTextContent('crop:b')
  })

  it('activates the focused item with OK', () => {
    const onActivate = vi.fn()
    renderList(CROPS, { onActivate })
    press('ArrowDown')
    press('Enter')
    expect(onActivate).toHaveBeenCalledExactlyOnceWith('crop:b')
  })

  it('opens the item showing key cap N with digit N; other digits do nothing', () => {
    const onActivate = vi.fn()
    renderList(CROPS.slice(0, 3), { onActivate })
    press('3')
    expect(onActivate).toHaveBeenCalledExactlyOnceWith('crop:c')
    expect(focused()).toBe('crop:c')
    press('4')
    press('9')
    press('0')
    expect(onActivate).toHaveBeenCalledOnce()
    expect(focused()).toBe('crop:c')
  })

  it('skips leading items without a key cap, like the connection-failed card', () => {
    const onActivate = vi.fn()
    renderList(['alert:offline', 'crop:a', 'crop:b'], { onActivate, digitOffset: 1 })
    expect(focused()).toBe('alert:offline')
    press('1')
    expect(onActivate).toHaveBeenLastCalledWith('crop:a')
    press('2')
    expect(onActivate).toHaveBeenLastCalledWith('crop:b')
    press('3')
    press('0')
    expect(onActivate).toHaveBeenCalledTimes(2)
  })

  it('scrolls the focused item into view at once, with a 6px margin', () => {
    const { content } = renderList(CROPS)
    press('ArrowDown')
    expect(content.scrollTop).toBe(104 + 6 - 100)
    for (let i = 0; i < 3; i += 1) press('ArrowDown')
    expect(content.scrollTop).toBe(206 + 6 - 100)
    press('ArrowUp')
    expect(content.scrollTop).toBe(206 + 6 - 100)
    press('ArrowUp')
    expect(content.scrollTop).toBe(108 - 6)
    press('ArrowUp')
    expect(content.scrollTop).toBe(74 - 6)
  })

  it('scrolls to the very top when the first item gets the focus and fits', () => {
    const { content } = renderList(CROPS)
    for (let i = 0; i < 4; i += 1) press('ArrowDown')
    for (let i = 0; i < 4; i += 1) press('ArrowUp')
    expect(focused()).toBe('crop:a')
    expect(content.scrollTop).toBe(0)
  })

  it('scrolls by 60% of the visible height with ↑ ↓ when nothing can be selected', () => {
    const onActivate = vi.fn()
    const { content } = renderList([], { onActivate })
    press('ArrowDown')
    expect(content.scrollTop).toBe(60)
    press('ArrowDown')
    expect(content.scrollTop).toBe(120)
    press('ArrowUp')
    expect(content.scrollTop).toBe(60)
    press('Enter')
    press('1')
    expect(onActivate).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps the focused item when the list changes, or the item now in its place', () => {
    const { setIds } = renderList(CROPS)
    press('ArrowDown')
    press('ArrowDown')
    setIds(['crop:x', ...CROPS])
    expect(focused()).toBe('crop:c')
    setIds(['crop:x', 'crop:a', 'crop:b', 'crop:d'])
    expect(focused()).toBe('crop:d')
    setIds(['crop:a', 'crop:b'])
    expect(focused()).toBe('crop:b')
  })

  it('restores the remembered item once the list arrives after loading', () => {
    // MemoryRouter's first history entry has the key "default".
    useSession.getState().rememberFocus('default', 'crop:c')
    const { setIds } = renderList([])
    setIds(CROPS)
    expect(focused()).toBe('crop:c')
  })

  it('remembers each history entry’s focus and restores it by id on return', async () => {
    const { setIds, go, back, remembered } = renderApp(CROPS)
    press('ArrowDown')
    expect(remembered()).toBe('crop:b')
    await go('/other')
    setIds(['crop:x', 'crop:y', ...CROPS])
    await back()
    expect(focused()).toBe('crop:b')
  })

  it('falls back to the first item when the remembered one is gone', async () => {
    const { setIds, go, back } = renderApp(CROPS)
    press('ArrowDown')
    await go('/other')
    setIds(['crop:x', 'crop:a'])
    await back()
    expect(focused()).toBe('crop:x')
  })

  it('remembers an item opened with a digit before leaving the screen', async () => {
    let leave = () => {}
    const { router, back } = renderApp(CROPS, { onActivate: () => leave() })
    leave = () => void router.navigate('/other')
    await act(async () => {
      press('4')
    })
    expect(screen.getByText('other screen')).toBeInTheDocument()
    await back()
    expect(focused()).toBe('crop:d')
  })

  it('starts another history entry of the same screen on its first item', async () => {
    const { go, back } = renderApp(CROPS)
    press('ArrowDown')
    press('ArrowDown')
    await go('/?area=pune')
    expect(focused()).toBe('crop:a')
    press('ArrowDown')
    await back()
    expect(focused()).toBe('crop:c')
  })

  it('leaves the focus to an open panel, then focuses the same item again', async () => {
    const { setIds, go, back } = renderApp(CROPS)
    press('ArrowDown')
    await go('/?sheet=menu')
    expect(focused()).toBe('menu:refresh')
    setIds(['crop:x', ...CROPS])
    expect(focused()).toBe('menu:refresh')
    press('ArrowDown')
    expect(focused()).toBe('menu:settings')
    await back()
    expect(focused()).toBe('crop:b')
    press('ArrowDown')
    expect(focused()).toBe('crop:c')
  })
})
