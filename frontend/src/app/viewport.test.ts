import { describe, expect, it } from 'vitest'

import { syncViewportHeight } from './viewport'

describe('syncViewportHeight', () => {
  it('writes innerHeight to --app-h and follows resizes', () => {
    const root = document.documentElement
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 320 })
    const stop = syncViewportHeight(window)
    expect(root.style.getPropertyValue('--app-h')).toBe('320px')

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 160 })
    window.dispatchEvent(new Event('resize'))
    expect(root.style.getPropertyValue('--app-h')).toBe('160px')

    stop()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 })
    window.dispatchEvent(new Event('resize'))
    expect(root.style.getPropertyValue('--app-h')).toBe('160px')
  })
})
