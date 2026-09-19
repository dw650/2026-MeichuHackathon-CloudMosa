import type { ReactNode } from 'react'

import styles from './Shell.module.css'

export interface SoftKeyLabels {
  left?: string
  center?: string
  right?: string
}

export interface ShellProps {
  title: string
  /** Rendered right after the title, e.g. the `#` key cap on the home screen. */
  titleAddon?: ReactNode
  softKeys: SoftKeyLabels
  children?: ReactNode
  /** Bottom sheet or other overlay drawn above the content (not above the soft keys). */
  overlay?: ReactNode
}

/** Screen frame: header, scrollable content and the soft key bar (docs/03 §2). */
export function Shell({ title, titleAddon, softKeys, children, overlay }: ShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {titleAddon}
      </header>
      <main className={styles.content}>{children}</main>
      <footer className={styles.softkeys}>
        <span className={styles.left} data-softkey="left">
          {softKeys.left ?? ''}
        </span>
        <span className={styles.center} data-softkey="center">
          {softKeys.center ?? ''}
        </span>
        <span className={styles.right} data-softkey="right">
          {softKeys.right ?? ''}
        </span>
      </footer>
      {overlay}
    </div>
  )
}
