import styles from './Skeleton.module.css'

export interface SkeletonProps {
  /** Bar width, e.g. `50` (px) or `'60%'`; the full width by default. */
  width?: number | string
}

/** A static grey bar standing in for text while loading; it never blinks (docs/03 §1, §4). */
export function Skeleton({ width = '100%' }: SkeletonProps) {
  return <span className={styles.bar} style={{ width }} aria-hidden="true" />
}
