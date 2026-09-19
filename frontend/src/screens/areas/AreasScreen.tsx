import { type ReactNode, useRef } from 'react'
import { useSearchParams } from 'react-router'

import { type Area, useAreas } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths, withParam } from '@/app/paths'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import type { Tone } from '@/components/categories'
import { cx } from '@/components/cx'
import { Shell } from '@/components/Shell/Shell'
import { Skeleton } from '@/components/Skeleton/Skeleton'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { describeFreshness, type Freshness } from '@/lib/dates'
import { distanceKm } from '@/lib/geo'
import { useCountryData } from '@/screens/shared/useCountryData'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import { orderAreas } from './areaOrder'
import styles from './AreasScreen.module.css'

const AREA = 'area:'
const COUNTRY = 'country'
const RETRY = 'retry'
const SKELETON_ROWS = 4

/** The `back` parameter, only if it is a path inside the app. */
function appPath(value: string | null): string | null {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null
}

/** The `?area=` of an app path, e.g. `pune` for `/crop/onion/today?area=pune`. */
function areaParam(path: string): string | null {
  return new URLSearchParams(path.split('?')[1] ?? '').get('area')
}

/** Pin tile colour by freshness: today green, stale amber, no data slate. */
function toneOf(area: Area, fresh: Freshness): Tone {
  if (area.staleness.state === 'none') return 'slate'
  return fresh.warn ? 'amber' : 'green'
}

/** Status dot, with text only for exceptions (昨天, 3 天前, 無資料); hidden on 128×160. */
function Status({ area, fresh }: { area: Area; fresh: Freshness }) {
  const none = area.staleness.state === 'none'
  return (
    <span className={styles.status}>
      <span
        className={cx(styles.dot, none && styles.none, fresh.warn && styles.stale)}
        aria-hidden="true"
      />
      {fresh.text && <span className={cx(fresh.warn && styles.warn)}>{fresh.text}</span>}
    </span>
  )
}

/**
 * 選擇地區 (F07, docs/02 §5.6): `/areas?for=home` changes my area; `/areas?for=view&back=<path>`
 * changes the `?area=` of the screen at `back`, which sits one entry below, without touching my
 * area. Recent areas first (the current one on top, checked), then all the others by
 * straight-line distance from my area, then 「更改國家…」.
 */
export default function AreasScreen() {
  const { t, lang, pick, dates } = useText()
  const nav = useNav()
  const [params] = useSearchParams()
  const forView = params.get('for') === 'view'
  const back = forView ? appPath(params.get('back')) : null
  const cc = useSettings((s) => s.country)
  const myAreaId = useSettings((s) => s.areaId)
  const recentIds = useSettings((s) => s.recentAreaIds)
  const chooseArea = useSettings((s) => s.chooseArea)
  const rememberArea = useSettings((s) => s.rememberArea)
  const { country } = useCountryData()
  const query = useAreas(cc)
  const root = useRef<HTMLDivElement>(null)

  const areas = query.data?.areas ?? []
  const failed = !query.data && query.isError
  const loading = !query.data && !failed
  const currentId = (back && areaParam(back)) ?? myAreaId
  const { recent, rest } = orderAreas(areas, currentId, recentIds, myAreaId)
  const rows = [...recent, ...rest]
  const from = areas.find((a) => a.id === myAreaId)

  let ids: string[] = []
  if (failed) ids = [RETRY]
  else if (!loading) ids = [...rows.map((a) => AREA + a.id), COUNTRY]

  const choose = (id: string) => {
    if (id === RETRY) {
      void query.refetch()
      return
    }
    if (id === COUNTRY) {
      nav.open(paths.setup('country'))
      return
    }
    const areaId = id.slice(AREA.length)
    if (!forView) {
      chooseArea(areaId)
      nav.back()
      return
    }
    rememberArea(areaId)
    if (back) nav.backAndReplace(withParam(back, 'area', areaId))
    else nav.back()
  }

  const list = useFocusList(ids, { root, onActivate: choose })
  useKeys(list.keys)

  const keyCap = (index: number) => (index < 9 ? index + 1 : undefined)
  const areaRow = (area: Area, index: number) => {
    const fresh = describeFreshness(area.staleness, area.latest_trade_date, dates)
    const km = from ? distanceKm(from, area) : 0
    const region = pick(area.region)
    return (
      <Card
        key={area.id}
        focusId={AREA + area.id}
        lead={
          <Tile tone={toneOf(area, fresh)} keyCap={keyCap(index)}>
            <UiIcon name="pin" />
          </Tile>
        }
        name={areaLabel(area, country, lang) + (area.id === currentId ? ' ✓' : '')}
        meta={km > 0 ? `${region} · ${t('common.distance', { km })}` : region}
        trailing={<Status area={area} fresh={fresh} />}
      />
    )
  }

  let body: ReactNode
  if (failed) {
    body = (
      <>
        <StatusBox icon="alert" title={t('states.error')} lines={[t('states.settingsKept')]} />
        <CardList>
          <Card
            focusId={RETRY}
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
  } else if (loading) {
    body = (
      <CardList>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Card
            key={i}
            lead={
              <Tile>
                <UiIcon name="pin" />
              </Tile>
            }
            name={<Skeleton width={80} />}
            loading
          />
        ))}
      </CardList>
    )
  } else {
    body = (
      <CardList>
        <div className={styles.section}>{t('areas.recent')}</div>
        {recent.map((area, i) => areaRow(area, i))}
        {rest.length > 0 && <div className={styles.section}>{t('areas.all')}</div>}
        {rest.map((area, i) => areaRow(area, recent.length + i))}
        <Card
          focusId={COUNTRY}
          lead={
            <Tile keyCap={keyCap(rows.length)}>
              <UiIcon name="globe" />
            </Tile>
          }
          name={t('areas.changeCountry')}
          trailing={<Chevron />}
        />
      </CardList>
    )
  }

  let center = t('softkeys.select')
  if (failed) center = t('softkeys.retry')
  else if (loading) center = ''

  return (
    <Shell title={t('areas.title')} softKeys={{ left: '', center, right: t('softkeys.back') }}>
      <div ref={root}>{body}</div>
    </Shell>
  )
}
