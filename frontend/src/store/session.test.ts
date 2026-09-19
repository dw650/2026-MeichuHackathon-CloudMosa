import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FOCUS_ENTRIES_MAX,
  RECENT_CROPS_MAX,
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  selectFocusId,
  selectLastFocusId,
  useSession,
} from './session'

const stored = () =>
  JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null') as {
    state: Record<string, unknown>
    version: number
  } | null

const seed = (state: unknown, version = SESSION_VERSION) =>
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state, version }))

const rehydrate = async () => {
  await useSession.persist.rehydrate()
  return useSession.getState()
}

const data = () => {
  const { lastLocation, focus, recentCrops } = useSession.getState()
  return { lastLocation, focus, recentCrops }
}

beforeEach(() => {
  useSession.setState(useSession.getInitialState(), true)
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('session store', () => {
  it('starts with no last screen, no focus and no recent crops', () => {
    expect(data()).toEqual({ lastLocation: null, focus: [], recentCrops: [] })
  })

  it('saves the last screen with its history key at once (F13)', () => {
    useSession.getState().rememberLocation('/crop/onion/today?area=pune', 'k1')
    expect(stored()).toEqual({
      state: {
        lastLocation: { path: '/crop/onion/today?area=pune', key: 'k1' },
        focus: [],
        recentCrops: [],
      },
      version: SESSION_VERSION,
    })
  })

  describe('focus per history entry', () => {
    it('remembers the focused id of each entry and saves it at once', () => {
      const { rememberFocus } = useSession.getState()
      rememberFocus('k1', 'crop:onion')
      rememberFocus('k2', 'area:pune')
      rememberFocus('k1', 'crop:tomato')
      const state = useSession.getState()
      expect(selectFocusId('k1')(state)).toBe('crop:tomato')
      expect(selectFocusId('k2')(state)).toBe('area:pune')
      expect(selectFocusId('k3')(state)).toBeNull()
      expect(stored()?.state.focus).toEqual([
        { key: 'k2', id: 'area:pune' },
        { key: 'k1', id: 'crop:tomato' },
      ])
    })

    it(`keeps only the newest ${FOCUS_ENTRIES_MAX} entries`, () => {
      const { rememberFocus } = useSession.getState()
      for (let i = 0; i <= FOCUS_ENTRIES_MAX; i += 1) rememberFocus(`k${i}`, `crop:${i}`)
      const state = useSession.getState()
      expect(state.focus).toHaveLength(FOCUS_ENTRIES_MAX)
      expect(selectFocusId('k0')(state)).toBeNull()
      expect(selectFocusId('k1')(state)).toBe('crop:1')
      expect(selectFocusId(`k${FOCUS_ENTRIES_MAX}`)(state)).toBe(`crop:${FOCUS_ENTRIES_MAX}`)
    })

    it('does not write again when the focus has not changed', () => {
      useSession.getState().rememberFocus('k1', 'crop:onion')
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      useSession.getState().rememberFocus('k1', 'crop:onion')
      expect(setItem).not.toHaveBeenCalled()
    })

    it('gives the focus of the last screen, for reopening (F13)', () => {
      const { rememberFocus, rememberLocation } = useSession.getState()
      expect(selectLastFocusId(useSession.getState())).toBeNull()
      rememberLocation('/?tab=watch', 'k1')
      expect(selectLastFocusId(useSession.getState())).toBeNull()
      rememberFocus('k1', 'crop:onion')
      rememberFocus('k0', 'crop:tomato')
      expect(selectLastFocusId(useSession.getState())).toBe('crop:onion')
    })
  })

  describe('recently viewed crops', () => {
    it(`keeps the last ${RECENT_CROPS_MAX}, most recent first, without duplicates`, () => {
      const { viewCrop } = useSession.getState()
      for (const id of ['a', 'b', 'c', 'd', 'e', 'b', 'f']) viewCrop(id)
      expect(useSession.getState().recentCrops).toEqual(['f', 'b', 'e', 'd', 'c'])
      expect(stored()?.state.recentCrops).toEqual(['f', 'b', 'e', 'd', 'c'])
    })

    it('can be cleared', () => {
      useSession.getState().viewCrop('onion')
      useSession.getState().clearRecentCrops()
      expect(useSession.getState().recentCrops).toEqual([])
      expect(stored()?.state.recentCrops).toEqual([])
    })
  })

  describe('restoring', () => {
    const saved = {
      lastLocation: { path: '/crop/onion/trend', key: 'k9' },
      focus: [{ key: 'k9', id: 'crop:onion' }],
      recentCrops: ['onion', 'garlic'],
    }

    it('restores the saved session', async () => {
      seed(saved)
      await rehydrate()
      expect(data()).toEqual(saved)
      expect(useSession.persist.hasHydrated()).toBe(true)
    })

    it('drops repeated keys and extra entries while reading', async () => {
      const focus = Array.from({ length: FOCUS_ENTRIES_MAX + 2 }, (_, i) => ({
        key: `k${i}`,
        id: `crop:${i}`,
      }))
      seed({
        ...saved,
        focus: [...focus, { key: 'k5', id: 'crop:last' }],
        recentCrops: 'abcdefg'.split(''),
      })
      const state = await rehydrate()
      expect(state.focus).toHaveLength(FOCUS_ENTRIES_MAX)
      expect(state.focus.at(-1)).toEqual({ key: 'k5', id: 'crop:last' })
      expect(selectFocusId('k5')(state)).toBe('crop:last')
      expect(selectFocusId('k1')(state)).toBeNull()
      expect(selectFocusId('k2')(state)).toBe('crop:2')
      expect(state.recentCrops).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    it.each([
      ['broken JSON', () => localStorage.setItem(SESSION_STORAGE_KEY, '{"state":{"focus":[')],
      [
        'a path that is not inside the app',
        () => seed({ ...saved, lastLocation: { path: '//evil.example', key: 'k' } }),
      ],
      ['a relative path', () => seed({ ...saved, lastLocation: { path: 'crop/onion', key: 'k' } })],
      ['focus that is not a list', () => seed({ ...saved, focus: { k1: 'crop:onion' } })],
      ['a focus entry without an id', () => seed({ ...saved, focus: [{ key: 'k1' }] })],
      ['recent crops that are not a list', () => seed({ ...saved, recentCrops: 'onion' })],
    ])('starts afresh on %s', async (_, arrange) => {
      useSession.getState().viewCrop('tomato')
      arrange()
      await rehydrate()
      expect(data()).toEqual({ lastLocation: null, focus: [], recentCrops: [] })
    })

    it.each([0, SESSION_VERSION + 1])(
      'starts afresh and saves that when the stored version is %i (no migration path)',
      async (version) => {
        seed(saved, version)
        await rehydrate()
        expect(data()).toEqual({ lastLocation: null, focus: [], recentCrops: [] })
        expect(stored()).toEqual({
          state: { lastLocation: null, focus: [], recentCrops: [] },
          version: SESSION_VERSION,
        })
      },
    )
  })
})
