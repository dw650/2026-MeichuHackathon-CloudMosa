import { useEffect, useRef, useState } from 'react'

import { Shell } from '@/components/Shell/Shell'

import styles from './debug.module.css'

interface KeyEntry {
  id: number
  key: string
  code: string
  repeat: boolean
  deltaMs: number | null
}

const MAX_ENTRIES = 30

/** Logs every keydown (key, code, repeat, time since the previous key) plus history events,
 *  so the real key values and back behaviour can be checked on the device (docs/08 §12). */
export default function DebugKeys() {
  const [entries, setEntries] = useState<KeyEntry[]>([])
  const [clicks, setClicks] = useState(0)
  const [events, setEvents] = useState<string[]>([])
  const last = useRef<number | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = e.timeStamp || performance.now()
      const deltaMs = last.current === null ? null : Math.round(now - last.current)
      last.current = now
      seq.current += 1
      const entry = { id: seq.current, key: e.key, code: e.code, repeat: e.repeat, deltaMs }
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES))
      if (e.key.startsWith('Arrow')) e.preventDefault()
    }
    const note = (name: string) => () => setEvents((prev) => [name, ...prev].slice(0, 5))
    const onPop = note('popstate')
    const onBack = note('back')
    // One extra history entry: the first right soft key press should fire popstate here.
    window.history.pushState({ debugKeys: true }, '')
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', onPop)
    window.addEventListener('back', onBack)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('back', onBack)
    }
  }, [])

  return (
    <Shell title="Debug: keys" softKeys={{ right: 'Back' }}>
      <div className={styles.page}>
        <button type="button" className={styles.button} onClick={() => setClicks((n) => n + 1)}>
          Enter test · clicks <span data-testid="click-count">{clicks}</span>
        </button>
        <div className={styles.muted}>history: {events.join(', ') || '—'}</div>
        <ul className={styles.list} data-testid="key-log">
          {entries.map((e) => (
            <li key={e.id} className={styles.row}>
              <span>
                <span className={styles.key}>{JSON.stringify(e.key)}</span>{' '}
                <span className={styles.muted}>{e.code || '—'}</span>
              </span>
              <span>
                {e.repeat ? 'repeat ' : ''}
                {e.deltaMs === null ? '' : `+${e.deltaMs}ms`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  )
}
