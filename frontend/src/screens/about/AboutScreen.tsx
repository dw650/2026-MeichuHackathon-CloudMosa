import { useRef } from 'react'

import { useHealth } from '@/api/queries'
import { Shell } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useText } from '@/screens/shared/useText'

import styles from './about.module.css'

const NO_ITEMS: readonly string[] = []

/**
 * 關於與資料說明 (F11, docs/02 §5.7): how the prices are worked out, where the news and its AI
 * summaries come from (docs/02 §5.9), the country's data source with the IP database credit
 * (DB-IP Lite, CC BY 4.0) and the international prices' sources (World Bank Pink Sheet,
 * CC BY 4.0; Rates By Exchange Rate API), and that the app never asks for money or codes.
 * Nothing to select: ↑ ↓ scroll the page by 60% (docs/03 §5).
 */
export default function AboutScreen() {
  const { t, pick } = useText()
  const { country } = useCountryData()
  const version = useHealth().data?.version
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(NO_ITEMS, { root })
  useKeys(list.keys)

  const notes = [
    t('about.areaPrice'),
    t('about.distance'),
    t('about.nearby'),
    t('about.retail'),
    t('about.gap'),
    t('about.news'),
    t('about.demo'),
  ]

  return (
    <Shell title={t('about.title')} softKeys={{ right: t('softkeys.back') }}>
      <div ref={root} className={styles.stack}>
        {notes.map((note) => (
          <p key={note} className={styles.box}>
            {note}
          </p>
        ))}
        <div className={styles.box}>
          <b className={styles.label}>{t('about.source')}</b>
          <span>{pick(country?.source_label)}</span>
          <span>{t('about.ipCredit')}</span>
          <span>{t('about.intlCredit')}</span>
        </div>
        <p className={styles.box}>{t('about.noMoney')}</p>
        {version && <p className={styles.box}>{t('about.version', { version })}</p>}
      </div>
    </Shell>
  )
}
