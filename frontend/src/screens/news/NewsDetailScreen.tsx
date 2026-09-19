import { useRef } from 'react'
import { Navigate, useParams } from 'react-router'

import { errorKind } from '@/api/client'
import { useNewsItem } from '@/api/queries'
import { paths } from '@/app/paths'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import { Shell } from '@/components/Shell/Shell'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { formatTime } from '@/lib/dates'
import { useOpenCrop } from '@/screens/home/cropList'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useText } from '@/screens/shared/useText'

import styles from './news.module.css'
import { dayLabel, RETRY_ID } from './newsItems'

const NO_ITEMS: readonly string[] = []
/** Related crops shown; 1, 2, 3 open them. */
const MAX_CROPS = 3

/** A news item (docs/02 §5.9); unknown ids go back to the list. */
export default function NewsDetailScreen() {
  const { newsId } = useParams()
  const id = Number(newsId)
  if (!Number.isSafeInteger(id) || id <= 0) return <Navigate to={paths.news()} replace />
  return <NewsDetail id={id} />
}

/**
 * The headline, its date, publisher and domain (the app never opens the publisher's site: data
 * costs), the summary marked as written by AI (none when there is no summary), and the related
 * crops. Nothing to select: ↑ ↓ scroll the page; 1–3 open a related crop's prices and OK the
 * first one.
 */
function NewsDetail({ id }: { id: number }) {
  const { t, pick, dates } = useText()
  const data = useCountryData()
  const query = useNewsItem(id)
  const openCrop = useOpenCrop()
  const root = useRef<HTMLDivElement>(null)

  const item = query.isPlaceholderData ? undefined : query.data
  const notFound = !item && query.isError && errorKind(query.error) === 'not_found'
  const failed = !item && query.isError && !notFound
  const crops = (item?.crop_ids ?? [])
    .flatMap((cropId) => {
      const crop = data.crop(cropId)
      return crop ? [crop] : []
    })
    .slice(0, MAX_CROPS)

  const focus = useFocusList(failed ? [RETRY_ID] : NO_ITEMS, {
    root,
    onActivate: () => void query.refetch(),
  })
  const open = (index: number) => {
    const crop = crops[index]
    if (crop) openCrop(crop.id)
  }
  useKeys(
    crops.length > 0
      ? { ...focus.keys, onEnter: () => open(0), onDigit: (digit) => open(digit - 1) }
      : focus.keys,
  )

  let content
  if (item) {
    content = (
      <div className={styles.detail}>
        <h2 className={styles.title} lang={item.lang}>
          {item.title}
        </h2>
        <p className={styles.meta}>
          {dayLabel(item, t, dates)} {formatTime(item.published_at)}
        </p>
        <p className={styles.meta}>
          {[item.source.name, item.source.domain].filter(Boolean).join(' · ')}
        </p>
        {item.summary && (
          <div className={styles.summary}>
            <p lang={item.summary_lang ?? undefined}>{item.summary}</p>
            <p className={styles.note}>{t('news.aiNote')}</p>
          </div>
        )}
        {crops.length > 0 && (
          <>
            <p className={styles.label}>{t('news.related')}</p>
            <div className={styles.crops}>
              {crops.map((crop, index) => (
                <Card
                  key={crop.id}
                  compact
                  lead={
                    <CropIcon crop={crop.id} tone={data.toneOf(crop.category)} keyCap={index + 1} />
                  }
                  name={pick(crop.name)}
                  trailing={<Chevron />}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  } else if (notFound) {
    content = <StatusBox icon="news" title={t('news.notFound')} lines={[t('news.notFoundNote')]} />
  } else if (failed) {
    content = (
      <>
        <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
        <CardList>
          <Card
            focusId={RETRY_ID}
            lead={
              <Tile>
                <UiIcon name="refresh" />
              </Tile>
            }
            name={t('states.retry')}
          />
        </CardList>
      </>
    )
  } else {
    content = (
      <>
        <StatusBox lines={[`${t('news.loading')}…`, t('states.loadingNote')]} />
        <CardList>
          <Card name={<Skeleton width={120} />} loading />
        </CardList>
      </>
    )
  }

  const center = failed ? t('softkeys.retry') : crops.length > 0 ? t('softkeys.prices') : ''
  return (
    <Shell title={t('news.title')} softKeys={{ left: '', center, right: t('softkeys.back') }}>
      <div ref={root}>{content}</div>
    </Shell>
  )
}
