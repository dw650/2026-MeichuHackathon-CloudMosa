import { cx } from '../cx'
import styles from './Tabs.module.css'

export interface TabItem {
  id: string
  label: string
}

export interface TabsProps {
  tabs: readonly TabItem[]
  activeId: string
}

/**
 * Tab bar (docs/03 §4): rounded pills with the current one filled, and ◀ ▶ on both sides as the
 * hint that the arrow keys switch tabs (240×320 only). Tabs are never focused; the screen
 * switches them on ◀ ▶.
 */
export function Tabs({ tabs, activeId }: TabsProps) {
  return (
    <div className={styles.tabs} data-fixed="">
      <span className={styles.arrow} aria-hidden="true">
        ◀
      </span>
      <div className={styles.segment} role="tablist">
        {tabs.map((tab) => (
          <span
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeId}
            className={cx(styles.tab, tab.id === activeId && styles.active)}
          >
            {tab.label}
          </span>
        ))}
      </div>
      <span className={styles.arrow} aria-hidden="true">
        ▶
      </span>
    </div>
  )
}
