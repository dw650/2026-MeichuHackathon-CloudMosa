import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeys } from '@/keys/useKeys'
import { useSession } from '@/store/session'

import { useGrid, type GridOptions } from './useGrid'

// The home screen's 3×3 category grid; cell positions match keys 1–9 (docs/02 §5.2).
const CELLS = [
  ...['cat:grains', 'cat:veg', 'cat:fruit'],
  ...['cat:pulses', 'cat:spices', 'cat:oilseeds'],
  ...['cat:other', 'cat:all', 'cat:recent'],
]

const press = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key })
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.focusId

function Grid({ ids, options }: { ids: readonly string[]; options?: Omit<GridOptions, 'root'> }) {
  const root = useRef<HTMLDivElement>(null)
  const grid = useGrid(ids, 3, { ...options, root })
  useKeys(grid.keys)
  return (
    <div ref={root}>
      {ids.map((id) => (
        <div key={id} data-focus-id={id} tabIndex={-1}>
          {id}
        </div>
      ))}
    </div>
  )
}

const renderGrid = (ids: readonly string[], options?: Omit<GridOptions, 'root'>) =>
  render(
    <MemoryRouter>
      <Grid ids={ids} options={options} />
    </MemoryRouter>,
  )

beforeEach(() => {
  useSession.setState(useSession.getInitialState(), true)
  localStorage.clear()
})

describe('useGrid', () => {
  it('jumps a whole row with ↑ ↓ and stays on the top and bottom rows', () => {
    renderGrid(CELLS)
    press('ArrowRight')
    press('ArrowUp')
    expect(focused()).toBe('cat:veg')
    press('ArrowDown')
    expect(focused()).toBe('cat:spices')
    press('ArrowDown')
    expect(focused()).toBe('cat:all')
    press('ArrowDown')
    expect(focused()).toBe('cat:all')
    press('ArrowUp')
    expect(focused()).toBe('cat:spices')
  })

  it('moves within the row with ◀ ▶ and stays on the right column', () => {
    renderGrid(CELLS)
    press('ArrowDown')
    press('ArrowRight')
    expect(focused()).toBe('cat:spices')
    press('ArrowRight')
    press('ArrowRight')
    expect(focused()).toBe('cat:oilseeds')
    press('ArrowLeft')
    expect(focused()).toBe('cat:spices')
  })

  it('calls onLeftEdge for ◀ on the left column, e.g. back to the watch tab', () => {
    const onLeftEdge = vi.fn()
    renderGrid(CELLS, { onLeftEdge })
    press('ArrowLeft')
    expect(onLeftEdge).toHaveBeenCalledOnce()
    expect(focused()).toBe('cat:grains')
    press('ArrowDown')
    press('ArrowRight')
    press('ArrowLeft')
    expect(focused()).toBe('cat:pulses')
    press('ArrowLeft')
    expect(onLeftEdge).toHaveBeenCalledTimes(2)
  })

  it('opens the cell of a digit key and the focused cell with OK', () => {
    const onActivate = vi.fn()
    renderGrid(CELLS, { onActivate })
    press('5')
    expect(onActivate).toHaveBeenLastCalledWith('cat:spices')
    expect(focused()).toBe('cat:spices')
    press('ArrowDown')
    press('Enter')
    expect(onActivate).toHaveBeenLastCalledWith('cat:all')
  })

  it('stays where a shorter last row has no cell', () => {
    renderGrid(CELLS.slice(0, 8))
    press('ArrowDown')
    press('ArrowRight')
    press('ArrowRight')
    press('ArrowDown')
    expect(focused()).toBe('cat:oilseeds')
    press('ArrowLeft')
    press('ArrowDown')
    press('ArrowRight')
    expect(focused()).toBe('cat:all')
  })
})
