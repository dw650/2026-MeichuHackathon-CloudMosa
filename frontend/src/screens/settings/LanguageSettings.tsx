import { useRef } from 'react'

import { useNav } from '@/app/navigation'
import { Card, CardList } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { mainLanguages } from '@/i18n'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './settings.module.css'

/**
 * Settings → 語言: the main languages of first-run setup, the phone's first, then the languages
 * of the chosen country (docs/02 F10, F15). The chosen one has a check mark; choosing one saves
 * it and goes back to the settings.
 */
export function LanguageSettings() {
  const { t, lang } = useText()
  const nav = useNav()
  const chosen = useSettings((s) => s.language) ?? lang
  const country = useSettings((s) => s.country)
  const chooseLanguage = useSettings((s) => s.chooseLanguage)
  const root = useRef<HTMLDivElement>(null)
  const languages = mainLanguages(navigator.language, country)

  const list = useFocusList(
    languages.map((language) => language.id),
    {
      root,
      onActivate: (id) => {
        const language = languages.find((l) => l.id === id)
        if (!language) return
        chooseLanguage(language.id)
        nav.back()
      },
    },
  )
  useKeys(list.keys)

  return (
    <Shell
      title={t('settings.rows.language')}
      softKeys={{ center: t('softkeys.select'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <CardList>
          {languages.map((language, i) => (
            <Card
              key={language.id}
              focusId={language.id}
              lead={
                <Tile tone={language.tone} keyCap={i + 1}>
                  <span lang={language.id}>{language.glyph}</span>
                </Tile>
              }
              name={<span lang={language.id}>{language.name}</span>}
              meta={
                language.isPhoneLanguage
                  ? t('setup.language.phone')
                  : language.translated
                    ? undefined
                    : t('setup.language.fallbackNote')
              }
              trailing={
                language.id === chosen ? (
                  <span className={styles.check}>
                    <UiIcon name="check" />
                  </span>
                ) : undefined
              }
            />
          ))}
        </CardList>
      </div>
    </Shell>
  )
}
