import { useMemo } from 'react'

import { monthLabels } from '@/i18n'
import { formatDay } from '@/lib/monthly'

import styles from './fxNote.module.css'
import { useDisplayCurrency } from './useDisplayCurrency'
import { useText } from './useText'

/**
 * 「以 9/19 匯率換算」 under the info bar of a screen whose prices are shown in another
 * currency (F19, docs/02 §5.7): the conversion is said once per screen, never on a row. The
 * line only exists while a display currency is in use, so the default screens are unchanged;
 * when a rate is missing it says that instead, the prices staying in the local currency.
 * 128×160 keeps the short form (「9/19 匯率」).
 */
export function FxNote() {
  const { t } = useText()
  const fx = useDisplayCurrency()
  const months = useMemo(() => monthLabels(t), [t])
  if (fx.reason === 'no_rate') return <p className={styles.note}>{t('currency.noRate')}</p>
  if (!fx.converted) return null
  const date = formatDay(fx.rateDate, months)
  return (
    <p className={styles.note}>
      <span className={styles.long}>{t('currency.converted', { date })}</span>
      <span className={styles.short}>{t('currency.convertedShort', { date })}</span>
    </p>
  )
}
