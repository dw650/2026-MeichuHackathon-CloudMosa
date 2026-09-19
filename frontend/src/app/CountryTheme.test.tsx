import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useRiseColor } from '@/components/rise'
import { useSettings } from '@/store/settings'

import { AppProviders } from './providers'

function RiseProbe() {
  return <p data-testid="rise">{useRiseColor('up')}</p>
}

describe('CountryTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettings.setState(useSettings.getInitialState(), true)
  })

  it('shows rises in red for Taiwan', async () => {
    useSettings.setState({ country: 'TW' })
    render(
      <AppProviders>
        <RiseProbe />
      </AppProviders>,
    )
    await waitFor(() => expect(screen.getByTestId('rise')).toHaveTextContent('neg'))
  })

  it('shows rises in green for India', async () => {
    useSettings.setState({ country: 'IN' })
    render(
      <AppProviders>
        <RiseProbe />
      </AppProviders>,
    )
    await waitFor(() => expect(screen.getByTestId('rise')).toHaveTextContent('pos'))
  })
})
