import { useContext } from 'react'

import type { Direction } from '@/lib/change'

import type { Tone } from '../categories'
import { cx } from '../cx'
import { riseColor, UpIsPosContext } from '../rise'
import styles from './MetricGrid.module.css'

export interface Metric {
  label: string
  /** Already formatted, e.g. `+3.1%`, `偏多 ▲18%`, `高檔 72%`; never truncated. */
  value: string
  /** Colours the value as a rise or a fall, following the country. */
  direction?: Direction
  /** 0–1: draws a thin gauge under the value (the 30-day position). */
  gauge?: number
}

export interface MetricGridProps {
  /** Three metrics, drawn side by side. */
  items: readonly Metric[]
  /** The crop category's tone, which colours the gauge. */
  tone?: Tone
}

const percent = (share: number) => `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`

/** Metric boxes: a small title over a bold value (docs/03 §4). Not shown on 128×160 (docs/03 §6). */
export function MetricGrid({ items, tone }: MetricGridProps) {
  const upIsPos = useContext(UpIsPosContext)
  return (
    <div className={styles.grid} data-tone={tone}>
      {items.map((item) => (
        <div key={item.label} className={styles.cell}>
          <span className={styles.label}>{item.label}</span>
          <span
            className={cx(
              styles.value,
              item.direction && styles[riseColor(item.direction, upIsPos)],
            )}
          >
            {item.value}
          </span>
          {item.gauge !== undefined && (
            <span className={styles.gauge}>
              <span className={styles.fill} style={{ width: percent(item.gauge) }} />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
