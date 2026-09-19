import { useEffect, useState } from 'react'

import { Shell } from '@/components/Shell/Shell'

import styles from './debug.module.css'

const SIZES = [10, 11, 12, 13, 15, 17]
const WEIGHTS = [400, 700, 900]

function readViewport() {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    qqvga: window.matchMedia('(max-width: 176px)').matches,
    language: navigator.language,
    tzOffsetMin: new Date().getTimezoneOffset(),
    hasFeature: typeof (navigator as Navigator & { hasFeature?: unknown }).hasFeature,
  }
}

/** Viewport, font and Intl samples to calibrate the design tokens on the device (docs/08 §12). */
export default function DebugViewport() {
  const [info, setInfo] = useState(readViewport)
  useEffect(() => {
    const update = () => setInfo(readViewport())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(123450.5)
  const inrMoney = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    2350,
  )
  const twd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 }).format(123450.5)
  const day = new Date(Date.UTC(2026, 8, 19))
  const zhDate = new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(day)
  const enDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(day)

  return (
    <Shell title="Debug: viewport" softKeys={{ right: 'Back' }}>
      <div className={styles.page}>
        {Object.entries(info).map(([k, v]) => (
          <div key={k} className={styles.row}>
            <span className={styles.muted}>{k}</span>
            <span className={styles.key}>{String(v)}</span>
          </div>
        ))}
        <div className={styles.row}>
          <span className={styles.muted}>en-IN</span>
          <span>
            {inr} · {inrMoney} · {enDate}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.muted}>zh-TW</span>
          <span>
            {twd} · {zhDate}
          </span>
        </div>
        {SIZES.map((size) => (
          <div key={size} style={{ fontSize: size }}>
            {WEIGHTS.map((w) => (
              <span key={w} style={{ fontWeight: w }}>
                {size}px {w} Roboto 洋蔥 प्याज{' '}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  )
}
