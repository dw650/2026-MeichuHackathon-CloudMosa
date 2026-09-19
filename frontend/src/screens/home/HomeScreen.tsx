import { useRef } from 'react'
import { useSearchParams } from 'react-router'

import type { Crop } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { type HomeTab, paths } from '@/app/paths'
import { Card, CardList, Chevron } from '@/components/Card/Card'
import { CATEGORY_ICON, CATEGORY_IDS, CATEGORY_TONE } from '@/components/categories'
import { IconGrid } from '@/components/IconGrid/IconGrid'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { FxNote } from '@/screens/shared/FxNote'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { PriceTypeTag } from '@/components/PriceTypeTag/PriceTypeTag'
import { Shell } from '@/components/Shell/Shell'
import { Tabs } from '@/components/Tabs/Tabs'
import { Tile } from '@/components/Tile/Tile'
import { useFocusList } from '@/focus/useFocusList'
import { useGrid } from '@/focus/useGrid'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { formatDate } from '@/lib/dates'
import { AreaSheet, sheetSoftKeys } from '@/screens/shared/AreaSheet'
import { MenuSheet } from '@/screens/shared/MenuSheet'
import { useCountryData } from '@/screens/shared/useCountryData'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

import { CropPriceList } from './CropCards'
import { cropListIds, cropOf, leadingItems, okAction, RETRY_ID, useOpenCrop } from './cropList'
import { useAreaPrices } from './useAreaPrices'

const CATEGORY_PREFIX = 'cat:'
const GRID_IDS = CATEGORY_IDS.map((id) => CATEGORY_PREFIX + id)
/** The only item of an empty watchlist: switches to 全部作物. */
const BROWSE_ID = 'action:browse'

/**
 * Home (F02, docs/02 §5.2): my area's prices in two tabs, 關注 (the watchlist's crop cards)
 * and 全部作物 (the 3×3 category grid laid out like keys 1–9). ◀ ▶ switch tabs in place,
 * `*` switches wholesale ⇄ retail, `#` opens the change-area panel.
 */
export default function HomeScreen() {
  const nav = useNav()
  const [params] = useSearchParams()
  const tab: HomeTab = params.get('tab') === 'all' ? 'all' : 'watch'
  const { t, lang, dates } = useText()
  const data = useCountryData()
  const format = usePriceFormat()
  const areaId = useSettings((s) => s.areaId)
  const watchlist = useSettings((s) => s.watchlist)
  const togglePriceType = useSettings((s) => s.togglePriceType)
  const prices = useAreaPrices(watchlist)
  const openCrop = useOpenCrop()
  const listRoot = useRef<HTMLDivElement>(null)
  const gridRoot = useRef<HTMLDivElement>(null)

  const crops = watchlist.map((id) => data.crop(id)).filter((crop): crop is Crop => !!crop)
  const empty = prices.status === 'ready' && crops.length === 0
  const watchIds = empty ? [BROWSE_ID] : cropListIds(crops, prices)
  const toWatch = () => nav.switchTab(paths.home('watch'))
  const toAll = () => nav.switchTab(paths.home('all'))

  const list = useFocusList(tab === 'watch' ? watchIds : [], {
    root: listRoot,
    digitOffset: empty ? 1 : leadingItems(prices),
    active: tab === 'watch' && !nav.sheet,
    onActivate: (id) => {
      const crop = cropOf(id)
      if (crop) openCrop(crop)
      else if (id === RETRY_ID) prices.retry()
      else if (id === BROWSE_ID) toAll()
    },
  })
  const grid = useGrid(tab === 'all' ? GRID_IDS : [], 3, {
    root: gridRoot,
    active: tab === 'all' && !nav.sheet,
    onActivate: (id) => nav.open(paths.category(id.slice(CATEGORY_PREFIX.length))),
    onLeftEdge: toWatch,
  })
  useKeys({
    ...(tab === 'all' ? grid.keys : { ...list.keys, onRight: toAll }),
    onStar: togglePriceType,
    onHash: () => nav.openSheet('area'),
    onMenu: () => nav.openSheet('menu'),
  })

  const areaName = areaLabel(data.myArea, data.country, lang) || (areaId ?? '')
  const action = tab === 'all' ? 'open' : okAction(list.focusedId)
  const overlay =
    nav.sheet === 'menu' ? (
      <MenuSheet areaFor="home" />
    ) : nav.sheet === 'area' ? (
      <AreaSheet areaFor="home" currentAreaId={areaId ?? ''} />
    ) : null

  return (
    <Shell
      title={t('home.title', { area: areaName })}
      titleAddon={<KeyCap>#</KeyCap>}
      softKeys={
        nav.sheet
          ? sheetSoftKeys(t)
          : {
              left: t('softkeys.menu'),
              center: action ? t(`softkeys.${action}`) : '',
              right: t('softkeys.exit'),
            }
      }
      overlay={overlay}
    >
      <InfoBar
        left={
          <>
            <KeyCap>*</KeyCap>
            <PriceTypeTag type={format.type} label={t(`priceType.${format.type}`)} />
            {format.unitLabel}
          </>
        }
        right={
          prices.today ? (
            <>
              <UiIcon name="cal" />
              {formatDate(prices.today, dates)}
            </>
          ) : undefined
        }
      />
      <FxNote />
      <Tabs
        tabs={[
          { id: 'watch', label: t('home.tabs.watch') },
          { id: 'all', label: t('home.tabs.all') },
        ]}
        activeId={tab}
      />
      {tab === 'all' ? (
        <div ref={gridRoot}>
          <IconGrid
            items={CATEGORY_IDS.map((id, i) => ({
              focusId: CATEGORY_PREFIX + id,
              label: t(`categories.${id}`),
              icon: CATEGORY_ICON[id],
              tone: CATEGORY_TONE[id],
              keyCap: i + 1,
            }))}
          />
        </div>
      ) : (
        <div ref={listRoot}>
          <CropPriceList
            crops={crops}
            prices={prices}
            areaName={areaName}
            empty={
              <CardList>
                <Card
                  focusId={BROWSE_ID}
                  lead={
                    <Tile>
                      <UiIcon name="grid" />
                    </Tile>
                  }
                  name={t('home.browse')}
                  trailing={<Chevron />}
                />
              </CardList>
            }
          />
        </div>
      )}
    </Shell>
  )
}
