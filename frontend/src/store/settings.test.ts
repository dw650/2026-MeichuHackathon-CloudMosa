import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, setLanguage } from '@/i18n'

import { useSession } from './session'
import {
  DEFAULT_SETTINGS,
  RECENT_AREAS_MAX,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
  useSettings,
  type CountryDefaults,
  type SettingsData,
  type SettingsState,
} from './settings'

// Shaped like the countries of `GET /countries`.
const IN: CountryDefaults = {
  default_area_id: 'nashik',
  default_recent_area_ids: ['nashik', 'pune', 'ahmednagar'],
  default_watch: ['onion', 'tomato', 'potato'],
}
const TW: CountryDefaults = {
  default_area_id: 'taipei',
  default_recent_area_ids: ['taipei', 'newtaipei', 'taichung'],
  default_watch: ['cabbage', 'bokchoy', 'banana'],
}

const settings = () => useSettings.getState()

const data = (): SettingsData => {
  const { language, country, areaId, recentAreaIds, watchlist, priceType, units } = settings()
  const { displayCurrency, setupDone, demo } = settings()
  return {
    language,
    country,
    areaId,
    recentAreaIds,
    watchlist,
    priceType,
    units,
    displayCurrency,
    setupDone,
    demo,
  }
}

const stored = () =>
  JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? 'null') as {
    state: SettingsData
    version: number
  } | null

const seed = (state: unknown, version = SETTINGS_VERSION) =>
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ state, version }))

const rehydrate = async () => {
  await useSettings.persist.rehydrate()
}

/** Settings after first-run setup in India. */
const setUpIndia = () => {
  settings().chooseLanguage('en')
  settings().chooseCountry('IN', IN)
  settings().chooseArea('nashik')
}

const resetStores = () => {
  useSettings.setState(useSettings.getInitialState(), true)
  useSession.setState(useSession.getInitialState(), true)
  localStorage.clear()
}

beforeEach(resetStores)

afterEach(() => {
  vi.restoreAllMocks()
  resetStores()
  setLanguage('en')
})

describe('settings store', () => {
  it('starts before first-run setup with nothing chosen', () => {
    expect(data()).toEqual({
      language: null,
      country: null,
      areaId: null,
      recentAreaIds: [],
      watchlist: [],
      priceType: 'wholesale',
      units: { wholesale: null, retail: null },
      displayCurrency: 'local',
      setupDone: false,
      demo: { fail: false, stale: false, locate: 'auto' },
    })
    expect(data()).toEqual(DEFAULT_SETTINGS)
  })

  it.each<[string, (s: SettingsState) => void, Partial<SettingsData>]>([
    ['choosing a language', (s) => s.chooseLanguage('zh-TW'), { language: 'zh-TW' }],
    ['choosing a country', (s) => s.chooseCountry('TW', TW), { country: 'TW', areaId: 'taipei' }],
    ['choosing an area', (s) => s.chooseArea('pune'), { areaId: 'pune', setupDone: true }],
    [
      'remembering a viewed area',
      (s) => s.rememberArea('agra'),
      { recentAreaIds: ['agra', 'nashik', 'pune'] },
    ],
    ['toggling a watched crop', (s) => s.toggleWatch('onion'), { watchlist: ['tomato', 'potato'] }],
    ['toggling the price type', (s) => s.togglePriceType(), { priceType: 'retail' }],
    ['setting the price type', (s) => s.setPriceType('retail'), { priceType: 'retail' }],
    [
      'choosing a unit',
      (s) => s.setUnit('wholesale', 'kg'),
      { units: { wholesale: 'kg', retail: null } },
    ],
    [
      'choosing a display currency',
      (s) => s.chooseDisplayCurrency('USD'),
      { displayCurrency: 'USD' },
    ],
    [
      'changing a demo switch',
      (s) => s.setDemo({ fail: true }),
      { demo: { fail: true, stale: false, locate: 'auto' } },
    ],
  ])('saves %s to localStorage at once', (_, act, expected) => {
    setUpIndia()
    act(settings())
    expect(data()).toMatchObject(expected)
    expect(stored()).toEqual({ state: data(), version: SETTINGS_VERSION })
  })

  describe('first-run setup', () => {
    it('fills in the country defaults, and is done once an area is chosen', () => {
      settings().chooseLanguage('en')
      settings().chooseCountry('IN', IN)
      expect(data()).toMatchObject({
        country: 'IN',
        areaId: 'nashik',
        recentAreaIds: ['nashik', 'pune', 'ahmednagar'],
        watchlist: ['onion', 'tomato', 'potato'],
        setupDone: false,
      })
      settings().chooseArea('pune')
      expect(data()).toMatchObject({
        areaId: 'pune',
        recentAreaIds: ['pune', 'nashik', 'ahmednagar'],
        setupDone: true,
      })
    })

    it('ignores an area chosen before any country', () => {
      settings().chooseArea('pune')
      expect(data()).toEqual(DEFAULT_SETTINGS)
      expect(stored()).toBeNull()
    })

    it('drops repeated ids and extra recent areas from the defaults', () => {
      settings().chooseCountry('IN', {
        default_area_id: 'nashik',
        default_recent_area_ids: ['nashik', 'nashik', 'pune', 'agra', 'kolar'],
        default_watch: ['onion', 'onion', 'garlic'],
      })
      expect(data()).toMatchObject({
        recentAreaIds: ['nashik', 'pune', 'agra'],
        watchlist: ['onion', 'garlic'],
      })
    })
  })

  describe('the display currency', () => {
    it('stays over a change of country, the point being to compare them', () => {
      setUpIndia()
      settings().chooseDisplayCurrency('USD')
      settings().chooseCountry('TW', TW)
      expect(settings().displayCurrency).toBe('USD')
      expect(stored()?.state.displayCurrency).toBe('USD')
    })

    it('starts at the local currency of each country', () => {
      setUpIndia()
      expect(settings().displayCurrency).toBe('local')
    })
  })

  describe('changing the country', () => {
    it('resets my area, the recent areas, the watchlist, the units and the recent crops', () => {
      setUpIndia()
      settings().chooseArea('pune')
      settings().toggleWatch('garlic')
      settings().setUnit('wholesale', 'kg')
      settings().togglePriceType()
      settings().setDemo({ stale: true })
      useSession.getState().viewCrop('onion')

      settings().chooseCountry('TW', TW)

      expect(data()).toEqual({
        language: 'en',
        country: 'TW',
        areaId: 'taipei',
        recentAreaIds: ['taipei', 'newtaipei', 'taichung'],
        watchlist: ['cabbage', 'bokchoy', 'banana'],
        priceType: 'retail',
        units: { wholesale: null, retail: null },
        displayCurrency: 'local',
        setupDone: true,
        demo: { fail: false, stale: true, locate: 'auto' },
      })
      expect(useSession.getState().recentCrops).toEqual([])
      expect(stored()?.state.country).toBe('TW')
    })

    it('keeps everything when the same country is chosen again', () => {
      setUpIndia()
      settings().chooseArea('pune')
      settings().toggleWatch('garlic')
      useSession.getState().viewCrop('onion')
      const before = data()
      settings().chooseCountry('IN', IN)
      expect(data()).toEqual(before)
      expect(useSession.getState().recentCrops).toEqual(['onion'])
    })
  })

  describe('areas', () => {
    it(`lists the ${RECENT_AREAS_MAX} most recent areas first, without duplicates`, () => {
      setUpIndia()
      for (const id of ['pune', 'agra', 'kolar', 'agra']) settings().chooseArea(id)
      expect(data()).toMatchObject({ areaId: 'agra', recentAreaIds: ['agra', 'kolar', 'pune'] })
    })

    it('remembers an area viewed in the detail screens without changing my area', () => {
      setUpIndia()
      settings().rememberArea('pune')
      settings().rememberArea('agra')
      expect(data()).toMatchObject({ areaId: 'nashik', recentAreaIds: ['agra', 'pune', 'nashik'] })
    })
  })

  it('adds watched crops at the end and removes them in place', () => {
    setUpIndia()
    settings().toggleWatch('garlic')
    settings().toggleWatch('tomato')
    settings().toggleWatch('grapes')
    expect(settings().watchlist).toEqual(['onion', 'potato', 'garlic', 'grapes'])
    settings().toggleWatch('tomato')
    expect(settings().watchlist).toEqual(['onion', 'potato', 'garlic', 'grapes', 'tomato'])
  })

  it('switches wholesale and retail, and keeps a unit per price type', () => {
    setUpIndia()
    settings().togglePriceType()
    expect(settings().priceType).toBe('retail')
    settings().togglePriceType()
    expect(settings().priceType).toBe('wholesale')
    settings().setUnit('retail', 'qtl')
    settings().setUnit('wholesale', 'kg')
    expect(settings().units).toEqual({ wholesale: 'kg', retail: 'qtl' })
    settings().setUnit('wholesale', null)
    expect(settings().units).toEqual({ wholesale: null, retail: 'qtl' })
  })

  it('changes only the given demo switches', () => {
    settings().setDemo({ fail: true, locate: 'TW:taipei' })
    settings().setDemo({ stale: true })
    expect(settings().demo).toEqual({ fail: true, stale: true, locate: 'TW:taipei' })
  })

  describe('language', () => {
    it('shows the UI in the chosen language; untranslated ones use English', () => {
      settings().chooseLanguage('zh-TW')
      expect(i18n.language).toBe('zh-TW')
      settings().chooseLanguage('hi')
      expect(i18n.language).toBe('hi')
      settings().chooseLanguage('bn')
      expect(settings().language).toBe('bn')
      expect(i18n.language).toBe('en')
    })

    it('applies the language of restored settings', async () => {
      seed({ ...DEFAULT_SETTINGS, language: 'zh-TW' })
      await rehydrate()
      expect(i18n.language).toBe('zh-TW')
    })

    it('follows the phone again when the settings are reset', async () => {
      vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-Hant-TW')
      settings().chooseLanguage('en')
      localStorage.setItem(SETTINGS_STORAGE_KEY, 'not json')
      await rehydrate()
      expect(settings().language).toBeNull()
      expect(i18n.language).toBe('zh-TW')
    })

    it('applies the saved language as soon as the store loads', async () => {
      seed({ ...DEFAULT_SETTINGS, language: 'zh-TW' })
      vi.resetModules()
      const fresh = await import('@/i18n')
      await import('./settings')
      expect(fresh.i18n.language).toBe('zh-TW')
      fresh.setLanguage('en')
    })
  })

  describe('restoring', () => {
    const saved: SettingsData = {
      language: 'hi',
      country: 'IN',
      areaId: 'pune',
      recentAreaIds: ['pune', 'nashik'],
      watchlist: ['garlic', 'onion'],
      priceType: 'retail',
      units: { wholesale: 'kg', retail: null },
      displayCurrency: 'USD',
      setupDone: true,
      demo: { fail: true, stale: false, locate: 'none' },
    }

    it('restores the saved settings', async () => {
      seed(saved)
      await rehydrate()
      expect(data()).toEqual(saved)
      expect(useSettings.persist.hasHydrated()).toBe(true)
    })

    it('restores a Malaysian setup with its demo location', async () => {
      const malaysia: SettingsData = {
        ...saved,
        country: 'MY',
        areaId: 'kualalumpur',
        recentAreaIds: ['kualalumpur'],
        watchlist: ['tomato'],
        units: { wholesale: 'kati', retail: null },
        demo: { ...saved.demo, locate: 'MY:kualalumpur' },
      }
      seed(malaysia)
      await rehydrate()
      expect(data()).toEqual(malaysia)
    })

    it('fills settings the saved data lacks with their defaults', async () => {
      // As saved by a build without these fields (JSON drops `undefined`).
      seed({ ...saved, demo: undefined, units: undefined, displayCurrency: undefined })
      await rehydrate()
      expect(data()).toEqual({
        ...saved,
        demo: DEFAULT_SETTINGS.demo,
        units: DEFAULT_SETTINGS.units,
        displayCurrency: DEFAULT_SETTINGS.displayCurrency,
      })
    })

    it('drops repeated and extra recent areas', async () => {
      seed({ ...saved, recentAreaIds: ['a', 'b', 'a', 'c', 'd'] })
      await rehydrate()
      expect(settings().recentAreaIds).toEqual(['a', 'b', 'c'])
    })

    it.each<[string, () => void]>([
      ['broken JSON', () => localStorage.setItem(SETTINGS_STORAGE_KEY, '{"state":{"country":')],
      ['an unknown country', () => seed({ ...saved, country: 'JP' })],
      ['an unknown language', () => seed({ ...saved, language: 'xx' })],
      ['a watchlist that is not a list', () => seed({ ...saved, watchlist: 'onion' })],
      ['an unknown price type', () => seed({ ...saved, priceType: 'farmgate' })],
      ['a unit that is not an id', () => seed({ ...saved, units: { wholesale: 5, retail: null } })],
      [
        'an unknown demo location',
        () => seed({ ...saved, demo: { ...saved.demo, locate: 'JP:tokyo' } }),
      ],
      ['setup marked done without an area', () => seed({ ...saved, areaId: null })],
      ['setup marked done without a country', () => seed({ ...saved, country: null })],
    ])('goes back to first-run setup on %s', async (_, arrange) => {
      setUpIndia()
      arrange()
      await rehydrate()
      expect(data()).toEqual(DEFAULT_SETTINGS)
      expect(settings().setupDone).toBe(false)
    })

    it.each([0, SETTINGS_VERSION + 1])(
      'runs the migration for stored version %i and, with no path to the current version, resets and saves that',
      async (version) => {
        seed(saved, version)
        await rehydrate()
        expect(data()).toEqual(DEFAULT_SETTINGS)
        expect(stored()).toEqual({ state: DEFAULT_SETTINGS, version: SETTINGS_VERSION })
      },
    )
  })
})
