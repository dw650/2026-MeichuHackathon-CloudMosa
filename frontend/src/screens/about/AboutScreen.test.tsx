import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/renderApp'

describe('AboutScreen', () => {
  it('shows the notes, the data source and the credits, with nothing to select', async () => {
    const app = await renderApp('/about', { history: ['/'] })
    expect(
      await screen.findByText('Agmarknet（印度農業部，data.gov.in，GODL-India）'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading')).toHaveTextContent('關於與資料說明')
    for (const text of [
      '地區價＝該地區各市場代表價的中位數，並標出市場數。',
      '附近最高、最低＝直線 150 km 內，和這裡同一個交易日有價格的所有地區。',
      '批發和零售的差額不是利潤，還包含運費、損耗、包裝等成本。',
      '新聞：Google 新聞搜尋到的農產品價格新聞，保留 7 天。摘要由 AI 依原文寫成，可能有誤；讀不到原文時只顯示標題。',
      '資料來源',
      '本 App 不會向你要錢、密碼或驗證碼。',
      'IP Geolocation by DB-IP（CC BY 4.0）',
      '國際參考價：世界銀行 Pink Sheet（CC BY 4.0），匯率 Rates By Exchange Rate API',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    // The running commit, so the team can tell which version is deployed.
    expect(await screen.findByText('版本 dev')).toBeInTheDocument()
    expect(document.querySelector('[data-focus-id]')).toBeNull()
    expect([app.softKey('left'), app.softKey('center'), app.softKey('right')]).toEqual([
      '',
      '',
      '返回',
    ])

    // ↑ ↓ scroll the page; OK and the digits do nothing.
    app.press('ArrowDown')
    app.press('Enter')
    app.press('1')
    expect(app.path()).toBe('/about')
    await app.back()
    expect(app.path()).toBe('/')
  })

  it('names the data source of the chosen country, in English too', async () => {
    await renderApp('/about', { country: 'TW', lang: 'en' })
    expect(await screen.findByText('MOA wholesale prices (Govt)')).toBeInTheDocument()
    expect(screen.getByRole('heading')).toHaveTextContent('About & data')
    expect(screen.getByText('We never ask for money, PINs or codes.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Highest and lowest nearby = every area within 150 km (straight line) priced on the same trading day as here.',
      ),
    ).toBeInTheDocument()
  })
})
