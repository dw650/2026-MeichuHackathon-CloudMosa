import type { ReactNode } from 'react'

import styles from './Header.module.css'

export interface HeaderProps {
  title: string
  /** Drawn right after the title, e.g. the `#` key cap on the home screen. Key caps are not
   *  drawn on 128×160 (docs/03 §6). */
  addon?: ReactNode
}

/** Screen title bar: the title centred on the brand colour (docs/03 §4). Long titles get an ellipsis. */
export function Header({ title, addon }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {addon}
    </header>
  )
}
