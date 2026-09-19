// User settings (docs/04 §4.5): language, country, my area, the recent areas, the watchlist,
// the price type and units, whether first-run setup is done, and the demo switches (F18).
// Saved to localStorage on every change (docs/08 §7). Prices and other server data never go
// here; a country's defaults come from `GET /countries` and are passed in by the caller.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { isLanguageId, phoneLanguage, setLanguage, type LanguageId } from '@/i18n'
import { DISPLAY_CURRENCIES, LOCAL, type DisplayCurrency } from '@/lib/money'
import type { PriceType } from '@/lib/units'

import {
  persistOptions,
  readBoolean,
  readId,
  readIds,
  readNullable,
  readObject,
  readOneOf,
  type PersistedFormat,
  type Reader,
} from './migrate'
import { useSession } from './session'

export const SETTINGS_STORAGE_KEY = 'agriprice.settings'
/** Bump with a migration step in `steps` whenever the stored shape changes. */
export const SETTINGS_VERSION = 1

/** Countries the app can show; others in `GET /countries` are left out of the list. */
export const COUNTRY_CODES = ['IN', 'TW', 'MY'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

export const PRICE_TYPES = ['wholesale', 'retail'] as const satisfies readonly PriceType[]

/** Recent areas offered in the area sheet (docs/02 §5.6). */
export const RECENT_AREAS_MAX = 3

/** The demo location guess: the real IP, no guess, or a fixed area (docs/06 §7.5). */
export const DEMO_LOCATE_OPTIONS = [
  'auto',
  'none',
  'IN:nashik',
  'TW:taipei',
  'MY:kualalumpur',
] as const
export type DemoLocate = (typeof DEMO_LOCATE_OPTIONS)[number]

/** Demo switches (F18, docs/04 §6.2); only demo builds send them as request headers. */
export interface DemoSwitches {
  /** Price APIs fail with 503 (`X-Demo-Fail`). */
  readonly fail: boolean
  /** The area asked for looks days old (`X-Demo-Stale`). */
  readonly stale: boolean
  /** `auto` keeps the real IP; any other value is sent as `X-Demo-Locate`. */
  readonly locate: DemoLocate
}

/**
 * A country's defaults from `GET /countries`. The field names match the API, so a country
 * from the response can be passed as it is.
 */
export interface CountryDefaults {
  readonly default_area_id: string
  readonly default_recent_area_ids: readonly string[]
  readonly default_watch: readonly string[]
}

export interface SettingsData {
  /** Chosen language id (may be untranslated, e.g. `hi`); `null` follows the phone. */
  readonly language: LanguageId | null
  readonly country: CountryCode | null
  /** 我的地區: the area of the home screen and crop lists. */
  readonly areaId: string | null
  /** Areas used lately, most recent first, at most `RECENT_AREAS_MAX`. */
  readonly recentAreaIds: readonly string[]
  /** Watched crop ids in display order. */
  readonly watchlist: readonly string[]
  /** Toggled by `*` on every price screen. */
  readonly priceType: PriceType
  /** Unit id per price type; `null` uses the country default from the API. */
  readonly units: Readonly<Record<PriceType, string | null>>
  /** Currency every price is shown in; `local` keeps each country's own (F19). */
  readonly displayCurrency: DisplayCurrency
  /** First-run setup finished: a country and an area are chosen. */
  readonly setupDone: boolean
  readonly demo: DemoSwitches
}

export interface SettingsActions {
  chooseLanguage(language: LanguageId): void
  /**
   * Switches country. A different country replaces my area, the recent areas and the
   * watchlist with its defaults, returns the units to its defaults and clears the recently
   * viewed crops; choosing the current country again changes nothing.
   */
  chooseCountry(country: CountryCode, defaults: CountryDefaults): void
  /** Sets my area (home, crop lists) and finishes first-run setup; needs a country first. */
  chooseArea(areaId: string): void
  /** Adds an area viewed in the detail screens to the recent areas; my area stays. */
  rememberArea(areaId: string): void
  /** Watches a crop (added at the end) or stops watching it. */
  toggleWatch(cropId: string): void
  setPriceType(priceType: PriceType): void
  togglePriceType(): void
  /** `null` goes back to the country default. */
  setUnit(priceType: PriceType, unitId: string | null): void
  /** Shows every price in one currency, or `local` for each country's own. */
  chooseDisplayCurrency(currency: DisplayCurrency): void
  setDemo(switches: Partial<DemoSwitches>): void
}

export type SettingsState = SettingsData & SettingsActions

export const DEFAULT_SETTINGS: SettingsData = {
  language: null,
  country: null,
  areaId: null,
  recentAreaIds: [],
  watchlist: [],
  priceType: 'wholesale',
  units: { wholesale: null, retail: null },
  displayCurrency: LOCAL,
  setupDone: false,
  demo: { fail: false, stale: false, locate: 'auto' },
}

const unique = (ids: readonly string[]) => [...new Set(ids)]

const withRecentArea = (ids: readonly string[], areaId: string) =>
  unique([areaId, ...ids]).slice(0, RECENT_AREAS_MAX)

const readLanguage: Reader<LanguageId> = (value) => (isLanguageId(value) ? value : undefined)
const readUnitId = readNullable(readId)

const settingsFormat: PersistedFormat<SettingsData> = {
  name: SETTINGS_STORAGE_KEY,
  version: SETTINGS_VERSION,
  steps: {},
  defaults: DEFAULT_SETTINGS,
  readers: {
    language: readNullable(readLanguage),
    country: readNullable(readOneOf(COUNTRY_CODES)),
    areaId: readNullable(readId),
    recentAreaIds: readIds(RECENT_AREAS_MAX),
    watchlist: readIds(),
    priceType: readOneOf(PRICE_TYPES),
    units: readObject({ wholesale: readUnitId, retail: readUnitId }, DEFAULT_SETTINGS.units),
    displayCurrency: readOneOf(DISPLAY_CURRENCIES),
    setupDone: readBoolean,
    demo: readObject(
      { fail: readBoolean, stale: readBoolean, locate: readOneOf(DEMO_LOCATE_OPTIONS) },
      DEFAULT_SETTINGS.demo,
    ),
  },
  // Home needs a country and an area; without them, run first-run setup again.
  check: (data) => !data.setupDone || (data.country !== null && data.areaId !== null),
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      chooseLanguage: (language) => set({ language }),
      chooseCountry: (country, defaults) => {
        if (get().country === country) return
        set({
          country,
          areaId: defaults.default_area_id,
          recentAreaIds: unique(defaults.default_recent_area_ids).slice(0, RECENT_AREAS_MAX),
          watchlist: unique(defaults.default_watch),
          units: DEFAULT_SETTINGS.units,
        })
        useSession.getState().clearRecentCrops()
      },
      chooseArea: (areaId) => {
        if (get().country === null) return
        set((state) => ({
          areaId,
          recentAreaIds: withRecentArea(state.recentAreaIds, areaId),
          setupDone: true,
        }))
      },
      rememberArea: (areaId) =>
        set((state) => ({ recentAreaIds: withRecentArea(state.recentAreaIds, areaId) })),
      toggleWatch: (cropId) =>
        set(({ watchlist }) => ({
          watchlist: watchlist.includes(cropId)
            ? watchlist.filter((id) => id !== cropId)
            : [...watchlist, cropId],
        })),
      setPriceType: (priceType) => set({ priceType }),
      togglePriceType: () =>
        set((state) => ({ priceType: state.priceType === 'wholesale' ? 'retail' : 'wholesale' })),
      setUnit: (priceType, unitId) =>
        set((state) => ({ units: { ...state.units, [priceType]: unitId } })),
      chooseDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
      setDemo: (switches) => set((state) => ({ demo: { ...state.demo, ...switches } })),
    }),
    persistOptions<SettingsData, SettingsState>(settingsFormat),
  ),
)

/** Shows the UI in the chosen language, or in the phone's until one is chosen (docs/02 F15). */
function applyLanguage(language: LanguageId | null): void {
  setLanguage(language ?? phoneLanguage(navigator.language))
}

// i18next follows the setting: once the saved settings are loaded, then on every change,
// including a later rehydration.
applyLanguage(useSettings.getState().language)
useSettings.subscribe((state, previous) => {
  if (state.language !== previous.language) applyLanguage(state.language)
})
