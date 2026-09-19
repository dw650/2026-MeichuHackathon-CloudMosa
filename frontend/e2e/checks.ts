/**
 * Layout checks shared by every UI spec (docs/07 §4). Each returns human-readable problems
 * (empty when fine), so a failing test lists exactly what is wrong and by how much.
 */
import { expect, type Page, test as base } from '@playwright/test'

/** Collects console errors and uncaught exceptions for the whole test. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await provide(errors)
  },
})
export { expect }

/** Selectors of fixed blocks that must never overflow. */
const FIXED = 'header, footer, [data-fixed]'

export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate((fixedSelector) => {
    const problems: string[] = []
    const doc = document.documentElement
    if (doc.scrollWidth > window.innerWidth) {
      problems.push(`page overflows horizontally: ${doc.scrollWidth} > ${window.innerWidth}`)
    }
    const ellipsis = (el: Element) => getComputedStyle(el).textOverflow === 'ellipsis'
    for (const el of document.querySelectorAll<HTMLElement>(fixedSelector)) {
      if (el.offsetParent === null) continue
      if (
        el.scrollHeight > el.clientHeight + 1 ||
        (el.scrollWidth > el.clientWidth + 1 && !ellipsis(el))
      ) {
        const name =
          el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : '')
        problems.push(
          `${name} overflows: ${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight}`,
        )
      }
    }
    return problems
  }, FIXED)
}

/** Every visible text is at least the floor (11px on 240×320, 10px on 128×160, 11px Chinese). */
export async function fontProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small = window.innerWidth <= 176
    const problems = new Set<string>()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const el = node.parentElement
      if (!text || !el || el.closest('[data-keycap], [aria-hidden="true"] text, script, style'))
        continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0 || getComputedStyle(el).visibility === 'hidden')
        continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      const zh = /[㐀-鿿]/.test(text)
      const floor = small ? (zh ? 11 : 10) : 11
      if (size + 0.01 < floor) problems.add(`"${text.slice(0, 16)}" is ${size}px (< ${floor}px)`)
    }
    return [...problems].slice(0, 10)
  })
}

/** The focused element is a real focus target and fully inside the content area. */
export async function focusProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!document.querySelector('[data-focus-id]')) return []
    if (!el || !el.hasAttribute('data-focus-id'))
      return ['focus is not on an item with data-focus-id']
    const main = el.closest('main') ?? document.querySelector('main')
    if (!main) return []
    const box = el.getBoundingClientRect()
    const area = main.getBoundingClientRect()
    if (box.top < area.top - 1 || box.bottom > area.bottom + 1) {
      return [`focused item ${el.dataset.focusId} is outside the content area`]
    }
    return []
  })
}

/** Runs every check and fails with the full list. */
export async function expectCleanScreen(page: Page, errors: string[]): Promise<void> {
  const problems = [
    ...(await layoutProblems(page)),
    ...(await fontProblems(page)),
    ...(await focusProblems(page)),
    ...errors,
  ]
  expect(problems, problems.join('\n')).toEqual([])
}
