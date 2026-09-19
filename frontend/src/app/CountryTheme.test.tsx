import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'

import { AppProviders } from './providers'

describe('CountryTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettings.setState(useSettings.getInitialState(), true)
    delete document.documentElement.dataset.up
  })

  it('shows rises in red for Taiwan and in green for India', async () => {
    useSettings.setState({ country: 'TW' })
    const { unmount } = render(<AppProviders>ok</AppProviders>)
    await waitFor(() => expect(document.documentElement.dataset.up).toBe('neg'))
    unmount()
    useSettings.setState({ country: 'IN' })
    render(<AppProviders>ok</AppProviders>)
    await waitFor(() => expect(document.documentElement.dataset.up).toBe('pos'))
  })
})
