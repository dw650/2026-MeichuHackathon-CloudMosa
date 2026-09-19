import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrendChart, type TrendPoint } from './TrendChart'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** Days from Sunday on; `null` is a day without a price, `'closed'` a market holiday. */
const week = (values: (number | null | 'closed')[]): TrendPoint[] =>
  values.map((value, i) => ({
    value: value === 'closed' ? null : value,
    label: WEEKDAYS[i % 7] ?? '',
    closed: value === 'closed',
  }))

/** Thirty days labelled `9/1`…`9/30`. */
const month = (value: (i: number) => number | null): TrendPoint[] =>
  Array.from({ length: 30 }, (_, i) => ({ value: value(i), label: `9/${i + 1}` }))

function renderChart(points: TrendPoint[]) {
  const { container } = render(
    <TrendChart
      points={points}
      tone="green"
      formatValue={(v) => `$${v.toFixed(1)}`}
      closedLabel="休"
    />,
  )
  const large = container.querySelector<SVGSVGElement>('svg.large')
  const small = container.querySelector<SVGSVGElement>('svg.small')
  if (!large || !small) throw new Error('both chart sizes are drawn')
  const texts = (svg: SVGSVGElement, selector = 'text') =>
    Array.from(svg.querySelectorAll(selector), (t) => t.textContent)
  return { container, large, small, texts }
}

describe('TrendChart', () => {
  it('draws one unbroken line when every day has a price', () => {
    const { large, small } = renderChart(week([10, 11, 12, 11, 13, 14, 15]))
    expect(large.querySelectorAll('path.line')).toHaveLength(1)
    expect(small.querySelectorAll('path.line')).toHaveLength(1)
    expect(large.querySelectorAll('.band')).toHaveLength(0)
  })

  it('breaks the line at a day without a price and marks that day with a light band', () => {
    const { large, small } = renderChart(week([10, 12, null, 11, 13, 14, 15]))
    const lines = Array.from(large.querySelectorAll('path.line'), (p) => p.getAttribute('d') ?? '')
    expect(lines).toHaveLength(2)
    // Separate segments: each starts with its own move-to, and none bridges the gap.
    expect(lines.map((d) => d.match(/[ML]/g)?.join(''))).toEqual(['ML', 'MLLL'])
    expect(large.querySelectorAll('.band')).toHaveLength(1)
    expect(small.querySelectorAll('path.line')).toHaveLength(2)
  })

  it('fills the area under each segment but never across the gap', () => {
    const { large } = renderChart(week([10, null, 12, 11, null, 13, 15]))
    // Segments [10], [12, 11], [13, 15]: a lone point has no area.
    expect(large.querySelectorAll('path.line')).toHaveLength(3)
    expect(large.querySelectorAll('path.area')).toHaveLength(2)
  })

  it('labels every day of the 7-day chart and marks market holidays as closed', () => {
    const { large, texts } = renderChart(week([10, 12, 'closed', 11, 13, 14, 15]))
    expect(texts(large, 'text.tick')).toEqual(['日', '一', '休', '三', '四', '五', '六'])
    expect(texts(large, 'text.closed')).toEqual(['休'])
  })

  it('labels the 30-day chart at days 1, 8, 15, 22 and 30 only', () => {
    const { large, texts } = renderChart(month((i) => (i % 7 === 3 ? null : 20 + (i % 5))))
    expect(texts(large, 'text.tick')).toEqual(['9/1', '9/8', '9/15', '9/22', '9/30'])
    expect(large.querySelectorAll('path.line').length).toBeGreaterThan(1)
  })

  it('writes the latest price next to its point and three reference values on the right', () => {
    const { large, texts } = renderChart(week([10, 12, null, 11, 13, 14, 15]))
    expect(texts(large, 'text.value')).toEqual(['$15.0'])
    expect(large.querySelectorAll('circle.now')).toHaveLength(1)
    expect(texts(large, 'text.reference')).toEqual(['$15.0', '$12.5', '$10.0'])
    expect(large.querySelectorAll('line.grid')).toHaveLength(3)
  })

  it('writes no text at all on 128×160', () => {
    const { small } = renderChart(week([10, 12, null, 11, 13, 14, 15]))
    expect(small.querySelectorAll('text, line')).toHaveLength(0)
    expect(small.querySelectorAll('circle.now')).toHaveLength(1)
  })

  it('marks the latest day that has a price when today has none', () => {
    const { large, texts } = renderChart(week([10, 12, 11, 13, 14, 15, 'closed']))
    expect(texts(large, 'text.value')).toEqual(['$15.0'])
    expect(texts(large, 'text.closed')).toEqual(['休'])
  })

  it('draws only the bands when no day has a price', () => {
    const { large } = renderChart(week([null, null, null]))
    expect(large.querySelectorAll('path, circle, text.value')).toHaveLength(0)
    expect(large.querySelectorAll('.band')).toHaveLength(3)
  })

  it('draws a single reference line when the price never moved', () => {
    const { large, texts } = renderChart(week([12, 12, 12]))
    expect(texts(large, 'text.reference')).toEqual(['$12.0'])
  })
})

describe('TrendChart days without data', () => {
  it('keeps the weekday of a day that is only missing data (not a holiday)', () => {
    const { large, texts } = renderChart(week([10, 12, null, 11, null, 'closed', null]))
    expect(texts(large, 'text.tick')).toEqual(['日', '一', '二', '三', '四', '休', '六'])
    expect(texts(large, 'text.closed')).toEqual(['休'])
  })
})
