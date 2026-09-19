import { useRef } from 'react'

import { Card, CardList, Chevron } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { mainLanguages, type MainLanguageOption } from '@/i18n'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { useText } from '@/screens/shared/useText'

import { useChooseLanguage, useSetupFlow } from './flow'
import { StepDots } from './parts'

const MORE_ID = 'more'

/**
 * A new user's first screen (F01, docs/02 §5.1): the phone language first and marked, the other
 * two main languages, then 「More・其他」. Untranslated languages say they fall back to English.
 */
export default function LanguageScreen() {
  const { t } = useText()
  const flow = useSetupFlow()
  const choose = useChooseLanguage(flow)
  const languages = mainLanguages(navigator.language)
  const ids = [...languages.map((l) => l.id), MORE_ID]

  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(ids, {
    root,
    onActivate: (id) => {
      const language = languages.find((l) => l.id === id)
      if (language) choose(language.id)
      else flow.next('langs')
    },
  })
  useKeys(list.keys)

  const note = (language: MainLanguageOption) => {
    if (language.isPhoneLanguage) return t('setup.language.phone')
    return language.translated ? undefined : t('setup.language.fallbackNote')
  }

  return (
    <Shell
      title={t('setup.language.title')}
      softKeys={{ center: t('softkeys.select'), right: t('softkeys.exit') }}
    >
      <div ref={root}>
        <StepDots step={1} />
        <CardList>
          {languages.map((language) => (
            <Card
              key={language.id}
              focusId={language.id}
              compact
              lead={<Tile tone={language.tone}>{language.glyph}</Tile>}
              name={<span lang={language.id}>{language.name}</span>}
              meta={note(language)}
            />
          ))}
          <Card
            focusId={MORE_ID}
            compact
            lead={
              <Tile tone="blue">
                <UiIcon name="globe" />
              </Tile>
            }
            name={t('setup.language.more')}
            meta={t('setup.language.moreSub')}
            trailing={<Chevron />}
          />
        </CardList>
      </div>
    </Shell>
  )
}
