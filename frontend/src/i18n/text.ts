import { FALLBACK_LANGUAGE } from './languages'

/** Multilingual text from the API, e.g. `{ "zh-TW": "洋蔥", "en": "Onion" }` (docs/04 §6). */
export type LocalizedText = Readonly<Partial<Record<string, string>>>

/**
 * The text for `language` (pass the UI language, `i18n.language`), else English, else the
 * first non-empty value; '' when there is none.
 */
export function pickText(text: LocalizedText | null | undefined, language: string): string {
  if (!text) return ''
  const candidates = [text[language], text[FALLBACK_LANGUAGE], ...Object.values(text)]
  return candidates.find((value) => typeof value === 'string' && value !== '') ?? ''
}
