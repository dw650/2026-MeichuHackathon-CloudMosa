import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NewsCard } from './NewsCard'

const base = {
  title: '芭樂盛產 屏東產地價格回落',
  titleLang: 'zh-TW',
  meta: '芭樂 · 今天',
  source: '示範資料',
}

describe('NewsCard', () => {
  it('shows the title with its key cap, the summary and the meta line', () => {
    const { container } = render(
      <NewsCard
        {...base}
        focusId="news:2"
        keyCap={2}
        summary="屏東芭樂進入盛產期。"
        summaryLang="zh-TW"
      />,
    )
    const card = container.firstElementChild
    expect(card).toHaveAttribute('data-focus-id', 'news:2')
    expect(card).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('2').tagName).toBe('KBD')
    expect(screen.getByText('屏東芭樂進入盛產期。')).toHaveAttribute('lang', 'zh-TW')
    expect(screen.getByText('芭樂 · 今天')).toBeInTheDocument()
    expect(screen.getByText('示範資料')).toBeInTheDocument()
    expect(screen.getByText(base.title, { exact: false })).toHaveAttribute('lang', 'zh-TW')
  })

  it('leaves the summary out when there is none, and is not focusable without an id', () => {
    const { container } = render(<NewsCard {...base} summary={null} />)
    expect(container.querySelectorAll('span[lang]')).toHaveLength(1)
    expect(container.firstElementChild).not.toHaveAttribute('tabindex')
    expect(container.querySelector('kbd')).toBeNull()
  })
})
