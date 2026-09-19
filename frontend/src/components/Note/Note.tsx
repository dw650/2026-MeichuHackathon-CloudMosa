import { UiIcon } from '@/icons/ui'
import type { UiIconName } from '@/icons/names'

import styles from './Note.module.css'

export interface NoteProps {
  /** The line to show; `null` renders nothing, so a screen can pass an optional note. */
  text: string | null | undefined
  icon?: UiIconName
}

/**
 * A short note about what is on screen, with a small icon (docs/03 §4). The same note is never
 * rendered twice on one screen: a screen shows it once, under the prices it explains.
 */
export function Note({ text, icon = 'info' }: NoteProps) {
  if (!text) return null
  return (
    <p className={styles.note}>
      <UiIcon name={icon} />
      {text}
    </p>
  )
}
