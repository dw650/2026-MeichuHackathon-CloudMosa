import { useTranslation } from 'react-i18next'

import { Card, CardList } from '@/components/Card/Card'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { UiIcon } from '@/icons/ui'
import type { Freshness } from '@/lib/dates'

import { RETRY_ID } from './flow'
import styles from './setup.module.css'

const SETUP_STEPS = 3

/** Progress of first-run setup: language, location or country, area (mockup `.steps`). */
export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useTranslation()
  return (
    <div
      className={styles.steps}
      role="img"
      aria-label={t('setup.step', { step, total: SETUP_STEPS })}
    >
      {Array.from({ length: SETUP_STEPS }, (_, i) => (
        <span key={i} className={i + 1 === step ? styles.on : undefined} />
      ))}
    </div>
  )
}

/** Static placeholder rows while a setup list loads (docs/02 §6: no blinking). */
export function LoadingRows({ rows }: { rows: number }) {
  return (
    <CardList>
      {Array.from({ length: rows }, (_, i) => (
        <Card
          key={i}
          lead={<Tile>{null}</Tile>}
          name={<Skeleton width={96} />}
          meta={<Skeleton width={64} />}
        />
      ))}
    </CardList>
  )
}

/** Connection failed, with one retry card (OK or 1; the centre soft key says 重試). */
export function Failed() {
  const { t } = useTranslation()
  return (
    <>
      <StatusBox icon="alert" title={t('states.error')} />
      <CardList>
        <Card
          focusId={RETRY_ID}
          compact
          lead={
            <Tile keyCap={1}>
              <UiIcon name="refresh" />
            </Tile>
          }
          name={t('states.retry')}
        />
      </CardList>
    </>
  )
}

/** An area's data freshness at the end of its row: a dot, and a label when not today's. */
export function AreaFreshness({ freshness, none }: { freshness: Freshness; none: boolean }) {
  const state = none ? 'none' : freshness.warn ? 'warn' : 'ok'
  return (
    <span className={styles.status}>
      <span className={styles.dot} data-state={state} />
      {freshness.text && (
        <span className={freshness.warn ? styles.warn : undefined}>{freshness.text}</span>
      )}
    </span>
  )
}
