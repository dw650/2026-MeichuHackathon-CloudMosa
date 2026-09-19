import { beforeEach, describe, expect, it } from 'vitest'

import { column, stubLayout } from '@/test/layout'

import { findItem, keepInView, scrollPage, scrollParent } from './dom'

const IDS = ['crop:a', 'crop:b', 'crop:c', 'crop:d', 'crop:e']

function element(tag: string, parent: HTMLElement, style?: string): HTMLElement {
  const el = document.createElement(tag)
  if (style) el.setAttribute('style', style)
  parent.append(el)
  return el
}

/** A content area 100px tall: 40px of info bar and tabs, then items 30px tall, 4px apart. */
function content() {
  const container = element('main', document.body, 'overflow-y: auto')
  element('p', container).textContent = 'info bar'
  const list = element('div', container)
  const items = IDS.map((id) => {
    const item = element('div', list)
    item.dataset.focusId = id
    item.tabIndex = -1
    return item
  })
  // a 40–70, b 74–104, c 108–138, d 142–172, e 176–206
  stubLayout(container, 100, column(IDS, 40, 30, 4))
  return { container, list, items }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('findItem', () => {
  it('finds an item by its data-focus-id inside the root only', () => {
    const { list, items } = content()
    expect(findItem(list, 'crop:c')).toBe(items[2])
    expect(findItem(list, 'crop:x')).toBeNull()
    const other = element('div', document.body)
    expect(findItem(other, 'crop:c')).toBeNull()
  })
})

describe('scrollParent', () => {
  it('is the element itself or its nearest ancestor that scrolls vertically', () => {
    const { container, list } = content()
    expect(scrollParent(list)).toBe(container)
    expect(scrollParent(container)).toBe(container)
    const scroll = element('section', document.body, 'overflow-y: scroll')
    expect(scrollParent(element('div', scroll))).toBe(scroll)
  })

  it('is null when nothing scrolls (hidden overflow only clips)', () => {
    const clip = element('div', document.body, 'overflow: hidden')
    expect(scrollParent(element('div', clip))).toBeNull()
  })
})

describe('keepInView', () => {
  it('leaves an item that shows with its margin where it is', () => {
    const { container, items } = content()
    container.scrollTop = 30
    keepInView(container, items[1]!, false)
    expect(container.scrollTop).toBe(30)
  })

  it('scrolls down at once just enough to leave 6px below the item', () => {
    const { container, items } = content()
    keepInView(container, items[1]!, false)
    expect(container.scrollTop).toBe(104 + 6 - 100)
    keepInView(container, items[4]!, false)
    expect(container.scrollTop).toBe(206 + 6 - 100)
  })

  it('scrolls up at once just enough to leave 6px above the item', () => {
    const { container, items } = content()
    container.scrollTop = 150
    keepInView(container, items[2]!, false)
    expect(container.scrollTop).toBe(108 - 6)
  })

  it('scrolls to the very top for the first item when it fits, showing the info bar', () => {
    const { container, items } = content()
    container.scrollTop = 50
    keepInView(container, items[0]!, true)
    expect(container.scrollTop).toBe(0)
  })

  it('keeps the margin rule for a first item that does not fit at the top', () => {
    const { container, items } = content()
    stubLayout(container, 60, column(IDS, 40, 30, 4))
    keepInView(container, items[0]!, true)
    expect(container.scrollTop).toBe(70 + 6 - 60)
  })
})

describe('scrollPage', () => {
  it('scrolls by 60% of the visible height, down and up', () => {
    const { container } = content()
    scrollPage(container, 1)
    expect(container.scrollTop).toBe(60)
    scrollPage(container, 1)
    expect(container.scrollTop).toBe(120)
    scrollPage(container, -1)
    expect(container.scrollTop).toBe(60)
  })

  it('rounds to whole pixels', () => {
    const { container } = content()
    stubLayout(container, 122, {})
    scrollPage(container, 1)
    expect(container.scrollTop).toBe(73)
  })
})
