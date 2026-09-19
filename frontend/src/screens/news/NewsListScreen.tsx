import { useRef } from 'react'

import { type NewsItem, useNews } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { Card, CardList } from '@/components/Card/Card'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { NewsCard } from '@/components/NewsCard/NewsCard'
import { Note } from '@/components/Note/Note'
import { Shell } from '@/components/Shell/Shell'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tabs } from '@/components/Tabs/Tabs'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { formatDateTime, formatTime } from '@/lib/dates'
import { AreaSheet, sheetSoftKeys } from '@/screens/shared/AreaSheet'
import { MenuSheet } from '@/screens/shared/MenuSheet'
import { useCountryData } from '@/screens/shared/useCountryData'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import styles from './news.module.css'
import { dayLabel, newsFocusId, newsIdOf, RETRY_ID, summaryLangNote } from './newsItems'

/** Digit key caps go on the first nine cards, which is all of them (docs/02 §4). */
const DIGIT_KEYS = 9

/**
 * 新聞 (docs/02 §5.9), the home screen's third tab: farm price news of my country, the newest
 * first. ◀ goes back to 全部作物 in place (tabs replace the history entry), OK or 1–9 opens an
 * item, `#` changes my area and the left soft key opens the menu. The info bar shows my area
 * and when the news was fetched; each card shows its date.
 */
export default function NewsListScreen() {
  const nav = useNav()
  const { t, pick, lang, dates } = useText()
  const data = useCountryData()
  const country = useSettings((s) => s.country)
  const areaId = useSettings((s) => s.areaId)
  const news = useNews(country && areaId ? { country, area: areaId } : null)
  const root = useRef<HTMLDivElement>(null)

  const list = news.isPlaceholderData ? undefined : news.data
  const items = list?.items ?? []
  const failed = news.isError && !list
  const old = news.isError && !!list
  const loading = !list && !failed
  const ids = loading
    ? []
    : failed
      ? [RETRY_ID]
      : [...(old ? [RETRY_ID] : []), ...items.map((item) => newsFocusId(item.id))]
  const focus = useFocusList(ids, {
    root,
    digitOffset: old ? 1 : 0,
    active: !nav.sheet,
    onActivate: (id) => {
      const newsId = newsIdOf(id)
      if (newsId !== null) nav.open(paths.newsItem(newsId))
      else void news.refetch()
    },
  })
  useKeys({
    ...focus.keys,
    onLeft: () => nav.switchTab(paths.home('all')),
    onHash: () => nav.openSheet('area'),
    onMenu: () => nav.openSheet('menu'),
  })

  const areaName = areaLabel(data.myArea, data.country, lang) || (areaId ?? '')
  const metaOf = (item: NewsItem) => {
    const crop = data.crop(item.crop_ids[0])
    return [crop ? pick(crop.name) : '', dayLabel(item, t, dates)].filter(Boolean).join(' · ')
  }
  const center =
    focus.focusedId === null
      ? ''
      : t(focus.focusedId === RETRY_ID ? 'softkeys.retry' : 'softkeys.open')
  // Every item of a country is summarised in the same language, so one line covers the list.
  const langNote = summaryLangNote(items.find((item) => item.summary)?.summary_lang, lang, t)

  let content
  if (loading) {
    content = (
      <>
        <StatusBox lines={[`${t('news.loading')}…`, t('states.loadingNote')]} />
        <CardList>
          <Card name={<Skeleton width={120} />} loading />
          <Card name={<Skeleton width={90} />} loading />
        </CardList>
      </>
    )
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
  } else if (items.length === 0) {
    content = <StatusBox icon="news" title={t('news.empty')} lines={[t('news.emptyNote')]} />
  } else {
    content = (
      <>
        {langNote && (
          <div className={styles.langNote}>
            <Note text={langNote} />
          </div>
        )}
        <CardList>
          {old && (
            <Card
              focusId={RETRY_ID}
              variant="alert"
              lead={
                <Tile>
                  <UiIcon name="alert" />
                </Tile>
              }
              name={t('states.error')}
              meta={t('states.showingOld', { time: formatTime(list?.fetched_at) })}
            />
          )}
          {items.map((item, index) => (
            <NewsCard
              key={item.id}
              focusId={newsFocusId(item.id)}
              keyCap={index < DIGIT_KEYS ? index + 1 : undefined}
              title={item.title}
              titleLang={item.lang}
              summary={item.summary}
              summaryLang={item.summary_lang}
              meta={metaOf(item)}
              source={item.source.name}
            />
          ))}
        </CardList>
      </>
    )
  }

  const overlay =
    nav.sheet === 'menu' ? (
      <MenuSheet areaFor="home" />
    ) : nav.sheet === 'area' ? (
      <AreaSheet areaFor="home" currentAreaId={areaId ?? ''} />
    ) : null

  return (
    <Shell
      title={t('news.title')}
      softKeys={
        nav.sheet
          ? sheetSoftKeys(t)
          : { left: t('softkeys.menu'), center, right: t('softkeys.exit') }
      }
      overlay={overlay}
    >
      <InfoBar
        left={
          <>
            <UiIcon name="pin" />
            <b>{areaName}</b>
            <KeyCap>#</KeyCap>
          </>
        }
        right={
          list?.fetched_at ? (
            <>
              <UiIcon name="clock" />
              {formatDateTime(list.fetched_at, dates)}
            </>
          ) : undefined
        }
      />
      <Tabs
        tabs={[
          { id: 'watch', label: t('home.tabs.watch') },
          { id: 'all', label: t('home.tabs.all') },
          { id: 'news', label: t('news.title') },
        ]}
        activeId="news"
      />
      <div ref={root}>{content}</div>
    </Shell>
  )
}
