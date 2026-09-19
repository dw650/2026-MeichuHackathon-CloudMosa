import { isFiniteNumber } from '@/lib/format'

import type { Tone } from '../categories'
import { cx } from '../cx'
import styles from './TrendChart.module.css'

export interface TrendPoint {
  /** The day's price in any unit (the chart only compares them); `null` when there was none. */
  value: number | null
  /** The day's X-axis label, already formatted: a weekday (`六`, `Sa`) for 7 days, `9/19` for 30. */
  label: string
  /** The markets were closed that day (a country holiday): the 7-day axis shows `closedLabel`. */
  closed?: boolean
}

export interface TrendChartProps {
  /** Days, oldest first: up to 7 for the weekly chart, 30 for the monthly one. */
  points: readonly TrendPoint[]
  /** The crop category's tone, which colours the line and the area. */
  tone: Tone
  /** Formats the reference values and the latest price, e.g. `(v) => formatPrice(v, unit, locale)`. */
  formatValue: (value: number) => string
  /** X-axis label of a closed day in the 7-day chart (`休`); other days without data keep theirs. */
  closedLabel: string
}

interface Frame {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
  /** Reference lines and all text; 128×160 has room for neither (docs/03 §6). */
  detailed: boolean
}

// docs/03 §4: 216×112 on 240×320, 114×58 on 128×160. Paddings from the mockup.
const LARGE: Frame = {
  width: 216,
  height: 112,
  left: 3,
  right: 36,
  top: 16,
  bottom: 15,
  detailed: true,
}
const SMALL: Frame = {
  width: 114,
  height: 58,
  left: 3,
  right: 3,
  top: 10,
  bottom: 3,
  detailed: false,
}

/** Charts with up to this many days label every day and mark each price with a dot. */
const WEEK = 7
/** Labelled days of the 30-day chart, besides the last one. */
const MONTH_TICKS = [0, 7, 14, 21]
/** Room kept above and below the prices, as a share of their range. */
const HEADROOM = 0.12
/** Width of one 11px character, generous for digits, to fit the reference values on the right. */
const CHAR_WIDTH = 6.2
const LABEL_GAP = 5

interface Known {
  i: number
  v: number
}

const num = (n: number) => n.toFixed(1)
const pathOf = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], k) => `${k ? 'L' : 'M'}${num(x)} ${num(y)}`).join('')

/** Runs of consecutive days with a price: the line is broken wherever a day has none. */
function segmentsOf(points: readonly TrendPoint[]): Known[][] {
  const segments: Known[][] = []
  let run: Known[] = []
  points.forEach(({ value }, i) => {
    if (isFiniteNumber(value)) run.push({ i, v: value })
    else if (run.length) {
      segments.push(run)
      run = []
    }
  })
  if (run.length) segments.push(run)
  return segments
}

interface ChartSvgProps extends Omit<TrendChartProps, 'tone'> {
  frame: Frame
  className?: string
}

function ChartSvg({ points, formatValue, closedLabel, frame, className }: ChartSvgProps) {
  const { width, height, left, top, bottom, detailed } = frame
  const n = points.length
  const weekly = n <= WEEK
  const segments = segmentsOf(points)
  const known = segments.flat()
  const values = known.map((k) => k.v)
  const hi = values.length ? Math.max(...values) : 0
  const lo = values.length ? Math.min(...values) : 0
  const pad = (hi - lo || Math.abs(hi) * 0.05 || 1) * HEADROOM

  // Highest, middle and lowest price, once each; they coincide when the price never moved.
  const references = detailed && values.length ? [hi, (hi + lo) / 2, lo] : []
  const labelled = references
    .map((v) => ({ v, text: formatValue(v) }))
    .filter((ref, k, all) => all.findIndex((other) => other.text === ref.text) === k)
  const longest = Math.max(0, ...labelled.map((ref) => ref.text.length))
  const right = detailed
    ? Math.max(frame.right, LABEL_GAP + Math.ceil(longest * CHAR_WIDTH))
    : frame.right

  const plotWidth = width - left - right
  const base = height - bottom
  const x = (i: number) => left + (n > 1 ? (i / (n - 1)) * plotWidth : plotWidth / 2)
  const y = (v: number) => top + (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * (base - top)
  const latest = known.at(-1)
  const ticks = weekly
    ? points.map((_, i) => i)
    : [...new Set([...MONTH_TICKS, n - 1])].filter((i) => i >= 0 && i < n)

  return (
    <svg
      className={cx(styles.svg, className)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {labelled.map(({ v, text }) => (
        <g key={text}>
          <line
            className={styles.grid}
            x1={left}
            x2={width - right + 2}
            y1={num(y(v))}
            y2={num(y(v))}
          />
          <text className={styles.reference} x={width - right + LABEL_GAP} y={num(y(v) + 4)}>
            {text}
          </text>
        </g>
      ))}
      {points.map(({ value }, i) =>
        isFiniteNumber(value) ? null : (
          <rect
            key={`b${i}`}
            className={styles.band}
            x={num(x(i) - 3)}
            y={top}
            width={6}
            height={base - top}
            rx={2}
          />
        ),
      )}
      {segments.map((segment) => {
        const line = pathOf(segment.map(({ i, v }) => [x(i), y(v)] as const))
        const first = segment[0]?.i ?? 0
        const last = segment.at(-1)?.i ?? 0
        return (
          <g key={`s${first}`}>
            {segment.length > 1 && (
              <path
                className={styles.area}
                d={`${line}L${num(x(last))} ${base}L${num(x(first))} ${base}Z`}
              />
            )}
            <path className={styles.line} d={line} />
          </g>
        )
      })}
      {weekly &&
        known
          .filter((k) => k !== latest)
          .map(({ i, v }) => (
            <circle key={`p${i}`} className={styles.point} cx={num(x(i))} cy={num(y(v))} r={2.3} />
          ))}
      {latest && (
        <circle
          className={styles.now}
          cx={num(x(latest.i))}
          cy={num(y(latest.v))}
          r={detailed ? 4.5 : 3}
        />
      )}
      {latest && detailed && (
        <text
          className={styles.value}
          x={num(x(latest.i) > width / 2 ? x(latest.i) - 7 : x(latest.i) + 7)}
          y={num(y(latest.v) - 8)}
          textAnchor={x(latest.i) > width / 2 ? 'end' : 'start'}
        >
          {formatValue(latest.v)}
        </text>
      )}
      {detailed &&
        ticks.map((i) => {
          const point = points[i]
          if (!point) return null
          const closed = point.closed === true && !isFiniteNumber(point.value)
          const anchor = weekly ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
          return (
            <text
              key={`t${i}`}
              className={cx(styles.tick, closed && styles.closed)}
              x={num(x(i))}
              y={height - 3}
              textAnchor={anchor}
            >
              {closed && weekly ? closedLabel : point.label}
            </text>
          )
        })}
    </svg>
  )
}

/**
 * Price trend (docs/03 §4): area and line in the category colour, broken on days without a
 * price, which get a light band (and `closedLabel` on the 7-day X axis). The latest price is
 * a bold dot with its value; three dashed reference lines carry values on the right. Both
 * sizes are drawn and CSS shows the one that fits; 128×160 has no text.
 */
export function TrendChart({ tone, ...chart }: TrendChartProps) {
  return (
    <div className={styles.chart} data-tone={tone}>
      <ChartSvg {...chart} frame={LARGE} className={styles.large} />
      <ChartSvg {...chart} frame={SMALL} className={styles.small} />
    </div>
  )
}
