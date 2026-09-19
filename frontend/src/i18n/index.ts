// i18next setup (docs/03 §7, docs/04 §4.1). All UI text lives in locales/*.json, grouped by
// screen or component; zh-TW and en are complete, every other language uses English.

import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

import {
  FALLBACK_LANGUAGE,
  htmlLang,
  phoneLanguage,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type UiLanguage,
} from './languages'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'

export * from './languages'
export * from './text'

type Strings = typeof en

// Typed keys: t('home.title') compiles, a misspelt key does not.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Strings }
  }
}

/** Bundled strings; the compiler also checks that zh-TW has every English key. */
export const resources = {
  'zh-TW': { translation: zhTW },
  en: { translation: en },
} satisfies Record<UiLanguage, { translation: Strings }>

/** The app's i18next instance; components use `useTranslation()` from react-i18next. */
export const i18n = createInstance()

// tokens.css sizes Chinese text with :lang(zh), so <html lang> follows the UI language.
i18n.on('languageChanged', (language: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = htmlLang(resolveLanguage(language))
  }
})

void i18n.use(initReactI18next).init({
  resources,
  // Until the store restores the chosen language, follow the phone (docs/02 §5.1).
  lng: resolveLanguage(phoneLanguage(typeof navigator === 'undefined' ? null : navigator.language)),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  // React escapes values itself.
  interpolation: { escapeValue: false },
  // Strings are bundled, so everything is ready synchronously.
  initAsync: false,
})

/**
 * Shows the UI in the chosen language; हिन्दी, the "More" languages and unknown ids use
 * English (docs/02 F15). Returns the UI language now in use.
 */
export function setLanguage(id: string | null | undefined): UiLanguage {
  const language = resolveLanguage(id)
  if (i18n.language !== language) void i18n.changeLanguage(language)
  return language
}
