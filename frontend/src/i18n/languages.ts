// Languages offered on the setup screens (docs/02 F01, F15, §5.1). zh-TW, en, ms and hi are
// translated; every language under "More" is listed but uses English.

/**
 * UI languages with a locale file (locales/*.json). zh-TW and en hold every key; ms and hi are
 * machine translations pending native review, and a key they miss shows in English.
 */
export const SUPPORTED_LANGUAGES = ['zh-TW', 'en', 'ms', 'hi'] as const
export type UiLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/** UI language for untranslated and unknown languages. */
export const FALLBACK_LANGUAGE: UiLanguage = 'en'

/** The languages on the first setup screen and in Settings → Language. */
export type MainLanguageId = 'zh-TW' | 'en' | 'hi' | 'ms'
/** Languages on the "More・其他" screen. */
export type MoreLanguageId = 'bn' | 'mr' | 'vi' | 'sw' | 'ur' | 'ta' | 'te' | 'id'
/** Any language the user can choose; the store keeps this id. */
export type LanguageId = MainLanguageId | MoreLanguageId

export interface Language {
  readonly id: LanguageId
  /** Name in its own script, the same in every UI language. */
  readonly name: string
  /** `false`: listed but not translated yet, so the UI uses English. */
  readonly translated: boolean
}

export interface MainLanguage extends Language {
  readonly id: MainLanguageId
  /** Letter on the list tile. */
  readonly glyph: string
  /** Tile colour (`--t-*` / `--c-*` tokens). */
  readonly tone: 'green' | 'blue' | 'orange' | 'purple'
}

export interface MainLanguageOption extends MainLanguage {
  /** The phone's own language: listed first and labelled 手機語言 / Phone language. */
  readonly isPhoneLanguage: boolean
}

export interface LanguagePage {
  readonly items: readonly Language[]
  /** Page shown (0-based), clamped to the available pages. */
  readonly page: number
  readonly pages: number
}

const isSupported = (id: string): id is UiLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(id)

/** Default order of the first setup screen (mockup `LANGS`, then Bahasa Melayu). */
export const MAIN_LANGUAGES: readonly MainLanguage[] = (
  [
    { id: 'zh-TW', name: '繁體中文', glyph: '中', tone: 'green' },
    { id: 'en', name: 'English', glyph: 'A', tone: 'blue' },
    { id: 'hi', name: 'हिन्दी', glyph: 'अ', tone: 'orange' },
    { id: 'ms', name: 'Bahasa Melayu', glyph: 'M', tone: 'purple' },
  ] as const
).map((l) => ({ ...l, translated: isSupported(l.id) }))

/**
 * Languages people use in each country, most used first (country codes of the API). Once the
 * country is known (Settings → Language), they follow the phone language; the rest keep the
 * default order.
 */
export const COUNTRY_LANGUAGES: Readonly<Partial<Record<string, readonly MainLanguageId[]>>> = {
  IN: ['en', 'hi'],
  MY: ['ms', 'en', 'zh-TW'],
  TW: ['zh-TW', 'en'],
}

/** The "More・其他" screen, in order (mockup `MORE_LANGS`). */
export const MORE_LANGUAGES: readonly Language[] = (
  [
    { id: 'bn', name: 'বাংলা' },
    { id: 'mr', name: 'मराठी' },
    { id: 'vi', name: 'Tiếng Việt' },
    { id: 'sw', name: 'Kiswahili' },
    { id: 'ur', name: 'اردو' },
    { id: 'ta', name: 'தமிழ்' },
    { id: 'te', name: 'తెలుగు' },
    { id: 'id', name: 'Bahasa Indonesia' },
  ] as const
).map((l) => ({ ...l, translated: isSupported(l.id) }))

export const MORE_LANGUAGES_PER_PAGE = 4

const ALL_LANGUAGES: readonly Language[] = [...MAIN_LANGUAGES, ...MORE_LANGUAGES]

const primarySubtag = (code: string) => code.trim().toLowerCase().split(/[-_]/)[0] ?? ''

export function isLanguageId(value: unknown): value is LanguageId {
  return ALL_LANGUAGES.some((l) => l.id === value)
}

/**
 * The listed language matching the phone's `navigator.language`, whose codes are not
 * always standard (`zh-Hant-TW`, `tl-TL`; docs/08 §9). Only the primary subtag counts, so
 * Chinese of any script or region maps to 繁體中文; `null` when nothing matches.
 */
export function phoneLanguage(code: string | null | undefined): LanguageId | null {
  const primary = code ? primarySubtag(code) : ''
  if (!primary) return null
  return ALL_LANGUAGES.find((l) => primarySubtag(l.id) === primary)?.id ?? null
}

/** The UI language used for a chosen language: itself when translated, English otherwise. */
export function resolveLanguage(id: string | null | undefined): UiLanguage {
  return id && isSupported(id) ? id : FALLBACK_LANGUAGE
}

/**
 * The main languages (docs/02 §5.1): the phone language first and marked, then the languages
 * of `country` when it is known (`COUNTRY_LANGUAGES`), then the rest in the default order.
 * When the phone language is not a main language, nothing is marked. First-run setup has no
 * country yet and adds "More・其他" after these.
 */
export function mainLanguages(
  phoneCode: string | null | undefined,
  country?: string | null,
): MainLanguageOption[] {
  const phone = phoneLanguage(phoneCode)
  const preferred: readonly (LanguageId | null)[] = [
    phone,
    ...((country && COUNTRY_LANGUAGES[country]) || []),
  ]
  const rank = (id: LanguageId) => {
    const index = preferred.indexOf(id)
    return index < 0 ? preferred.length : index
  }
  // Array sort is stable, so languages of the same rank keep the default order.
  return MAIN_LANGUAGES.map((l) => ({ ...l, isPhoneLanguage: l.id === phone })).sort(
    (a, b) => rank(a.id) - rank(b.id),
  )
}

/** One page of the "More・其他" screen; ◀ ▶ change pages and stop at both ends. */
export function moreLanguagesPage(page: number): LanguagePage {
  const pages = Math.ceil(MORE_LANGUAGES.length / MORE_LANGUAGES_PER_PAGE)
  const current = Math.min(Math.max(Math.trunc(page) || 0, 0), pages - 1)
  const start = current * MORE_LANGUAGES_PER_PAGE
  return {
    items: MORE_LANGUAGES.slice(start, start + MORE_LANGUAGES_PER_PAGE),
    page: current,
    pages,
  }
}

/** Name of a chosen language in its own script; English for unknown ids. */
export function languageName(id: string | null | undefined): string {
  return (
    ALL_LANGUAGES.find((l) => l.id === id)?.name ??
    ALL_LANGUAGES.find((l) => l.id === FALLBACK_LANGUAGE)?.name ??
    FALLBACK_LANGUAGE
  )
}

const HTML_LANG: Readonly<Record<UiLanguage, string>> = {
  'zh-TW': 'zh-Hant',
  en: 'en',
  ms: 'ms',
  hi: 'hi',
}

/** `<html lang>` for a UI language; tokens.css sizes Chinese and Hindi with `:lang(zh)`, `:lang(hi)`. */
export function htmlLang(language: UiLanguage): string {
  return HTML_LANG[language]
}
