import type { ReactNode } from 'react'

import { KeyCap } from '../KeyCap/KeyCap'
import styles from './NewsCard.module.css'

export interface NewsCardProps {
  /** Makes the card selectable (`data-focus-id`, `tabIndex={-1}`). */
  focusId?: string
  /** Number key cap (1–9) before the title; not drawn on 128×160. */
  keyCap?: number
  title: string
  /** Language of the title, e.g. `zh-TW` or `en`, so Chinese keeps its font floor. */
  titleLang?: string
  /** Two lines of the summary; left out when there is none (never a made-up one). */
  summary?: string | null
  summaryLang?: string | null
  /** Left of the last line: related crop and date, e.g. 「芭樂 · 9/18」. */
  meta: ReactNode
  /** Right of the last line: the publisher; not shown on 128×160. */
  source: string
}

/**
 * News card (docs/03 §4): bold title (two lines at most), two lines of the summary, then the
 * related crop and date on the left and the publisher on the right. Long text is clamped with
 * an ellipsis; the font never shrinks. On 128×160 it keeps the title and the date (docs/03 §6).
 */
export function NewsCard({
  focusId,
  keyCap,
  title,
  titleLang,
  summary,
  summaryLang,
  meta,
  source,
}: NewsCardProps) {
  return (
    <div
      data-fixed=""
      className={styles.card}
      data-focus-id={focusId}
      tabIndex={focusId === undefined ? undefined : -1}
    >
      <span className={styles.title} lang={titleLang}>
        {keyCap !== undefined && (
          <span className={styles.key}>
            <KeyCap>{keyCap}</KeyCap>
          </span>
        )}
        {title}
      </span>
      {summary && (
        <span className={styles.summary} lang={summaryLang ?? undefined}>
          {summary}
        </span>
      )}
      <span className={styles.foot}>
        <span className={styles.meta}>{meta}</span>
        <span className={styles.source}>{source}</span>
      </span>
    </div>
  )
}
