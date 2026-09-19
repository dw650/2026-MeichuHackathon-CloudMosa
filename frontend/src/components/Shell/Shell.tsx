import type { ReactNode } from 'react'

import { Header } from '../Header/Header'
import { SoftKeys, type SoftKeysProps } from '../SoftKeys/SoftKeys'
import styles from './Shell.module.css'

/** Labels of the three soft keys; a missing or empty label leaves that key blank. */
export type SoftKeyLabels = SoftKeysProps

export interface ShellProps {
  title: string
  /** Rendered right after the title, e.g. the `#` key cap on the home screen. */
  titleAddon?: ReactNode
  softKeys: SoftKeyLabels
  children?: ReactNode
  /** Bottom sheet or other overlay drawn above the header and content (not above the soft keys). */
  overlay?: ReactNode
}

/** Screen frame: header, scrollable content and the soft key bar (docs/03 §2). */
export function Shell({ title, titleAddon, softKeys, children, overlay }: ShellProps) {
  return (
    <div className={styles.shell}>
      <Header title={title} addon={titleAddon} />
      <main className={styles.content}>{children}</main>
      <SoftKeys {...softKeys} />
      {overlay ? <div className={styles.overlay}>{overlay}</div> : null}
    </div>
  )
}
