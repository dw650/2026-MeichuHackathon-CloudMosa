import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import { CropSvg } from './crops'
import { CROP_ICON_IDS, isCropIconId, UI_ICON_NAMES } from './names'
import { Logo, UiIcon } from './ui'

const markup = (ui: ReactElement) => render(ui).container.innerHTML

describe('CropSvg', () => {
  it('draws a different illustration for every crop (docs/03 §8)', () => {
    const drawn = CROP_ICON_IDS.map((id) => markup(<CropSvg id={id} />))
    expect(new Set(drawn).size).toBe(CROP_ICON_IDS.length)
  })

  it('has its own illustration for every crop of every country', () => {
    const catalogs = import.meta.glob<{ crops: { id: string }[] }>(
      '../test/fixtures/countries_*_crops.json',
      { eager: true, import: 'default' },
    )
    const ids = Object.values(catalogs).flatMap((catalog) => catalog.crops.map((c) => c.id))
    expect(ids).toContain('calamansi')
    expect(ids.filter((id) => !isCropIconId(id))).toEqual([])
  })

  it('falls back to the box for a crop without its own art', () => {
    expect(isCropIconId('durian')).toBe(false)
    expect(markup(<CropSvg id="durian" />)).toBe(markup(<CropSvg id="box" />))
  })

  it('ignores inherited object keys', () => {
    expect(isCropIconId('constructor')).toBe(false)
  })
})

describe('UiIcon', () => {
  it('draws every line icon in the text colour', () => {
    for (const name of UI_ICON_NAMES) {
      const svg = render(<UiIcon name={name} />).container.querySelector('svg')
      expect(svg).toHaveAttribute('stroke', 'currentColor')
      expect(svg?.childElementCount).toBeGreaterThan(0)
    }
  })

  it('renders the logo', () => {
    const svg = render(<Logo />).container.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox', '0 0 48 48')
  })
})
