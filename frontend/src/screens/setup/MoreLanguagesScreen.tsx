import { useRef } from 'react'
import { useLocation } from 'react-router'

import { useNav } from '@/app/navigation'
import { withParam } from '@/app/paths'
import { Card, CardList } from '@/components/Card/Card'
import { Shell } from '@/components/Shell/Shell'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { moreLanguagesPage } from '@/i18n'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { useText } from '@/screens/shared/useText'

import { useChooseLanguage, useSetupFlow } from './flow'
import styles from './setup.module.css'

/** `?page=` is 1-based and left out on the first page. */
const PAGE_PARAM = 'page'

/**
 * 「More・其他」 (docs/02 §5.1): the other languages, four per page; ◀ ▶ change the page in
 * place like tabs, so the page survives coming back. None is translated yet: all use English.
 */
export default function MoreLanguagesScreen() {
  const { t } = useText()
  const nav = useNav()
  const { pathname, search } = useLocation()
  const choose = useChooseLanguage(useSetupFlow())
  const requested = Number(new URLSearchParams(search).get(PAGE_PARAM) ?? 1) - 1
  const { items, page, pages } = moreLanguagesPage(requested)

  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(
    items.map((l) => l.id),
    {
      root,
      onActivate: (id) => {
        const language = items.find((l) => l.id === id)
        if (language) choose(language.id)
      },
    },
  )
  const turn = (step: 1 | -1) => {
    const target = page + step
    if (target < 0 || target >= pages) return
    const value = target > 0 ? String(target + 1) : undefined
    nav.switchTab(withParam(pathname + search, PAGE_PARAM, value))
  }
  useKeys({ ...list.keys, onLeft: () => turn(-1), onRight: () => turn(1) })

  return (
    <Shell
      title={t('setup.language.more')}
      softKeys={{ center: t('softkeys.select'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <div className={styles.pager}>
          <span className={styles.arrow} aria-hidden="true">
            {'◀ '}
          </span>
          {t('common.page', { page: page + 1, total: pages })}
          <span className={styles.arrow} aria-hidden="true">
            {' ▶'}
          </span>
        </div>
        <CardList>
          {items.map((language, i) => (
            <Card
              key={language.id}
              focusId={language.id}
              compact
              lead={
                <Tile keyCap={i + 1}>
                  <UiIcon name="globe" />
                </Tile>
              }
              name={
                <span lang={language.id} dir="auto">
                  {language.name}
                </span>
              }
              meta={language.translated ? undefined : t('setup.language.fallbackNote')}
            />
          ))}
        </CardList>
      </div>
    </Shell>
  )
}
