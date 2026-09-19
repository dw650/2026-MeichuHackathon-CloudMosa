import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Sheet, type SheetItem } from './Sheet'

const rows = (count: number): SheetItem[] =>
  Array.from({ length: count }, (_, i) => ({ focusId: `row:${i}`, label: `Row ${i}` }))

describe('Sheet', () => {
  it('is a dialog named by its title', () => {
    render(<Sheet title="排序方式" items={rows(2)} />)
    expect(screen.getByRole('dialog', { name: '排序方式' })).toBeInTheDocument()
  })

  it('makes every row a focus target', () => {
    const { container } = render(<Sheet title="選單" items={rows(3)} />)
    const targets = container.querySelectorAll('[data-focus-id]')
    expect(Array.from(targets, (row) => row.getAttribute('data-focus-id'))).toEqual([
      'row:0',
      'row:1',
      'row:2',
    ])
    for (const row of Array.from(targets)) expect(row).toHaveAttribute('tabindex', '-1')
  })

  it('numbers the first nine rows with key caps 1–9', () => {
    const { container } = render(<Sheet title="選單" items={rows(10)} />)
    const keys = Array.from(container.querySelectorAll('kbd'), (key) => key.textContent)
    expect(keys).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('checks the option now in use', () => {
    const { container } = render(
      <Sheet
        title="排序方式"
        items={[
          { focusId: 'sort:priceDesc', label: '價格 高→低', icon: 'sort', current: true },
          { focusId: 'sort:priceAsc', label: '價格 低→高', icon: 'sort' },
        ]}
      />,
    )
    const [current, other] = Array.from(container.querySelectorAll('[data-focus-id]'))
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(other).not.toHaveAttribute('aria-current')
    // The icon of each row, plus one check mark.
    expect(container.querySelectorAll('svg')).toHaveLength(3)
  })
})
