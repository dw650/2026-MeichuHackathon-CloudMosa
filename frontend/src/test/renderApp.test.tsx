import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from './renderApp'

describe('renderApp', () => {
  it('renders a route with setup done and first-run setup when asked', async () => {
    const app = await renderApp('/about')
    expect(app.path()).toBe('/about')
    const setup = await renderApp('/', { country: null })
    expect(setup.path()).toBe('/setup/lang')
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
  })

  it('goes back through the given history', async () => {
    const app = await renderApp('/about', { history: ['/'] })
    await app.back()
    expect(app.path()).toBe('/')
  })
})
