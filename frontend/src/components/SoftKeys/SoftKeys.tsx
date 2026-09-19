import styles from './SoftKeys.module.css'

/** Labels of the three soft keys; a missing or empty label leaves that key blank. */
export interface SoftKeysProps {
  left?: string
  center?: string
  right?: string
}

/**
 * The soft key bar (docs/03 §2): left opens the menu, the centre is OK (drawn as a pill when
 * it has a label), right goes back. Labels only; the keys themselves are handled by `keys/`.
 */
export function SoftKeys({ left, center, right }: SoftKeysProps) {
  return (
    <footer className={styles.softkeys}>
      <span className={styles.left} data-softkey="left">
        {left ?? ''}
      </span>
      <span className={styles.center} data-softkey="center">
        {center ?? ''}
      </span>
      <span className={styles.right} data-softkey="right">
        {right ?? ''}
      </span>
    </footer>
  )
}
