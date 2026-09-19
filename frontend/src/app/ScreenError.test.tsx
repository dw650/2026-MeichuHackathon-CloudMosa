import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetApp } from '@/test/renderApp'

import { AppProviders } from './providers'
import { buildRoutes, SCREENS } from './routes'

function Broken(): never {
  throw new Error('boom')
}

describe('ScreenError', () => {
  beforeEach(() => {
    resetApp()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('replaces a crashed screen with an error box and a way home', async () => {
    const routes = buildRoutes({ ...SCREENS, about: Broken })
    const router = createMemoryRouter(routes, { initialEntries: ['/', '/about'], initialIndex: 1 })
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    )
    expect(await screen.findByText('這個畫面出了問題')).toBeInTheDocument()
    expect(document.activeElement).toHaveAttribute('data-focus-id', 'home')
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })
    })
    await act(async () => {})
    expect(router.state.location.pathname).toBe('/')
  })
})
