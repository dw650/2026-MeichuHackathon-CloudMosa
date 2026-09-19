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
 * Settings → 語言: the three languages of first-run setup, in the same order (the phone's first).
 * The chosen one has a check mark; choosing one saves it and goes back to the settings.
 * हिन्दी is listed but shows English (docs/02 F15).
 */
export function LanguageSettings() {
  const { t, lang } = useText()
  const nav = useNav()
  const chosen = useSettings((s) => s.language) ?? lang
  const chooseLanguage = useSettings((s) => s.chooseLanguage)
  const root = useRef<HTMLDivElement>(null)
  const languages = mainLanguages(navigator.language)

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
                  {language.glyph}
                </Tile>
              }
              name={language.name}
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
