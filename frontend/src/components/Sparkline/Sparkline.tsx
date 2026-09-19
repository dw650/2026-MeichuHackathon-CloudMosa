import type { Direction } from '@/lib/change'
import { isFiniteNumber } from '@/lib/format'

import { cx } from '../cx'
import { useRiseColor } from '../rise'
import styles from './Sparkline.module.css'

const WIDTH = 38
const HEIGHT = 16

export interface SparklineProps {
  /** The last 7 daily prices, oldest first; days without a price (`null`) are skipped. */
  values: readonly (number | null)[]
  /** Direction of the change shown beside it: picks the colour, which follows the country. */
  direction: Direction
}

/** 7-day mini trend, 38×16, with a solid dot on the latest price (docs/03 §4). */
export function Sparkline({ values, direction }: SparklineProps) {
  const color = useRiseColor(direction)
  const known = values.filter(isFiniteNumber)
  const lo = Math.min(...known)
  const hi = Math.max(...known)
  const points = known.map(
    (v, i) =>
      [
        known.length > 1 ? 1.5 + (i / (known.length - 1)) * (WIDTH - 3) : WIDTH - 1.5,
        hi === lo ? HEIGHT / 2 : HEIGHT - 2 - ((v - lo) / (hi - lo)) * (HEIGHT - 4),
      ] as const,
  )
  const end = points.at(-1)
  return (
    <svg
      className={cx(styles.spark, styles[color])}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden="true"
    >
      {points.length > 1 && (
        <path
          d={points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')}
        />
      )}
      {end && <circle cx={end[0].toFixed(1)} cy={end[1].toFixed(1)} r={2.2} />}
    </svg>
  )
}
