import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { mainLanguages } from '@/i18n'
import { useSettings } from '@/store/settings'
import { renderApp } from '@/test/renderApp'

const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) => [
  app.softKey('left'),
  app.softKey('center'),
  app.softKey('right'),
]

/** Each row's name and value, as `name|value`. */
const rows = () =>
  Array.from(document.querySelectorAll('main [data-focus-id]'), (row) =>
    Array.from(row.querySelectorAll('span'))
      .filter((span) => span.children.length === 0 && span.textContent)
      .map((span) => span.textContent)
      .join('|'),
  )

describe('SettingsScreen', () => {
  it('shows the six settings with their values, plus Demo in demo builds; OK cycles a unit', async () => {
    const app = await renderApp('/settings', { history: ['/'] })
    await screen.findByText('₹/公擔')
    expect(screen.getByRole('heading')).toHaveTextContent('設定')
    expect(rows()).toEqual([
      '語言|繁體中文',
      '國家|印度',
      '我的地區|Nashik 縣',
      '顯示幣別|當地',
      '批發單位|₹/公擔',
      '零售單位|₹/公斤',
      'Demo|關',
    ])
    expect(app.focusedId()).toBe('language')
    expect(softKeys(app)).toEqual(['', '切換', '返回'])

    app.press('5')
    expect(useSettings.getState().units.wholesale).toBe('kg')
    expect(rows()[4]).toBe('批發單位|₹/公斤')
    app.press('Enter')
    expect(useSettings.getState().units.wholesale).toBe('qtl')
    app.press('ArrowDown')
    app.press('Enter')
    expect(useSettings.getState().units.retail).toBe('qtl')
    expect(app.path()).toBe('/settings')
  })

  it('opens the country and area pickers', async () => {
    const app = await renderApp('/settings', { history: ['/'] })
    await screen.findByText('₹/公擔')
    app.press('2')
    expect(app.path()).toBe('/setup/country')
    await app.back()
    app.press('3')
    expect(app.path()).toBe('/areas?for=home')
    await app.back()
    expect(app.focusedId()).toBe('area')
  })

  it('chooses a language from the list, then goes back to the settings', async () => {
    const app = await renderApp('/settings', { history: ['/'] })
    await screen.findByText('₹/公擔')
    app.press('Enter')
    expect(app.path()).toBe('/settings/language')
    expect(softKeys(app)).toEqual(['', '選取', '返回'])
    const order = mainLanguages(navigator.language, 'IN').map((language) => language.id)
    // jsdom's phone language (en-US) first, then Hindi for India, then the others.
    expect(order).toEqual(['en', 'hi', 'zh-TW', 'ms'])
    expect(
      Array.from(document.querySelectorAll('main [data-focus-id]'), (row) =>
        row.getAttribute('data-focus-id'),
      ),
    ).toEqual(order)
    expect(screen.getByText('हिन्दी')).toBeInTheDocument()
    expect(screen.getByText('Bahasa Melayu')).toBeInTheDocument()
    expect(screen.queryByText(/尚未提供/)).toBeNull()

    app.press(String(order.indexOf('en') + 1))
    expect(useSettings.getState().language).toBe('en')
    expect(app.path()).toBe('/settings')
    expect(screen.getByRole('heading')).toHaveTextContent('Settings')
    expect(rows()[0]).toBe('Language|English')
    expect(app.focusedId()).toBe('language')
  })

  it('shows every price in one currency once 顯示幣別 is chosen, and says so once', async () => {
    const app = await renderApp('/settings', { history: ['/'] })
    await screen.findByText('₹/公擔')
    app.press('4')
    expect(app.path()).toBe('/settings/currency')
    expect(screen.getByText('當地幣別')).toBeInTheDocument()
    expect(app.focusedId()).toBe('local')

    app.press('5')
    expect(useSettings.getState().displayCurrency).toBe('USD')
    expect(app.path()).toBe('/settings')
    expect(rows()[3]).toBe('顯示幣別|US$')
    expect(app.focusedId()).toBe('currency')

    await app.back()
    // ₹23.95/kg at 95.989567 to the dollar is US$24.95 per quintal, the unit being kept.
    expect(await screen.findByText('24.95')).toBeInTheDocument()
    expect(screen.getByText('US$/公擔')).toBeInTheDocument()
    expect(screen.getAllByText('以 9/19 匯率換算')).toHaveLength(1)
    expect(screen.queryByText('₹/公擔')).toBeNull()
  })

  it('toggles the demo switches from the Demo row', async () => {
    const app = await renderApp('/settings', { history: ['/'] })
    await screen.findByText('₹/公擔')
    app.press('7')
    expect(app.path()).toBe('/settings/demo')
    expect(screen.getByRole('heading')).toHaveTextContent('Demo')
    expect(softKeys(app)).toEqual(['', '切換', '返回'])
    expect(screen.getByText('模擬 API 失敗')).toBeInTheDocument()

    app.press('Enter')
    expect(useSettings.getState().demo.fail).toBe(true)
    app.press('ArrowDown')
    app.press('Enter')
    expect(useSettings.getState().demo.stale).toBe(true)
    app.press('ArrowDown')
    const labels = ['印度 Nashik', '台灣 台北市', '馬來西亞 Kuala Lumpur', '推測不到', '自動']
    const locations = labels.map((label) => {
      app.press('Enter')
      return [useSettings.getState().demo.locate, screen.getByText(label).textContent]
    })
    expect(locations).toEqual([
      ['IN:nashik', '印度 Nashik'],
      ['TW:taipei', '台灣 台北市'],
      ['MY:kualalumpur', '馬來西亞 Kuala Lumpur'],
      ['none', '推測不到'],
      ['auto', '自動'],
    ])
    expect(screen.getAllByText('開')).toHaveLength(2)

    await app.back()
    expect(rows()[6]).toBe('Demo|開')
  })
})
