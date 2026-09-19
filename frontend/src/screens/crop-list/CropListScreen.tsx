import { useRef } from 'react'
import { Navigate, useParams } from 'react-router'

import type { Crop } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { paths } from '@/app/paths'
import { RECENT_CATEGORY } from '@/components/categories'
import { InfoBar } from '@/components/InfoBar/InfoBar'
import { KeyCap } from '@/components/KeyCap/KeyCap'
import { PriceTypeTag } from '@/components/PriceTypeTag/PriceTypeTag'
import { Shell } from '@/components/Shell/Shell'
import { StatusBox } from '@/components/StatusBox/StatusBox'
import { useFocusList } from '@/focus/useFocusList'
import { UiIcon } from '@/icons/ui'
import { useKeys } from '@/keys/useKeys'
import { CropPriceList } from '@/screens/home/CropCards'
import {
  cropListIds,
  cropOf,
  leadingItems,
  okAction,
  RETRY_ID,
  useOpenCrop,
} from '@/screens/home/cropList'
import { useAreaPrices } from '@/screens/home/useAreaPrices'
import { AreaSheet, sheetSoftKeys } from '@/screens/shared/AreaSheet'
import { MenuSheet } from '@/screens/shared/MenuSheet'
import { useCountryData } from '@/screens/shared/useCountryData'
import { usePriceFormat } from '@/screens/shared/usePriceFormat'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'

/** A crop list (F03, docs/02 §5.3): one of the country's categories, or the recently viewed
 *  crops (「最近」). */
export default function CropListScreen() {
  const { catId = '' } = useParams()
  const data = useCountryData()
  const known = catId === RECENT_CATEGORY.id || data.categories.some((c) => c.id === catId)
  // Unknown paths (and the old /cat/all) go home once the country's categories are known
  // (docs/04 §4.3).
  if (!known && data.country) return <Navigate to={paths.home()} replace />
  return <CropList categoryId={catId} />
}

/** The crops listed under a home grid cell, in catalog order (「最近」: newest first). */
function cropsIn(categoryId: string, catalog: readonly Crop[], recent: readonly string[]): Crop[] {
  if (categoryId === RECENT_CATEGORY.id) {
    return recent.flatMap((id) => catalog.filter((crop) => crop.id === id))
  }
  return catalog.filter((crop) => crop.category === categoryId)
}

function CropList({ categoryId }: { categoryId: string }) {
  const nav = useNav()
  const { t, lang, pick } = useText()
  const data = useCountryData()
  const format = usePriceFormat()
  const areaId = useSettings((s) => s.areaId)
  const togglePriceType = useSettings((s) => s.togglePriceType)
  const recentCrops = useSession((s) => s.recentCrops)
  // Every crop in one request, shared by all the lists of my area.
  const prices = useAreaPrices('all')
  const openCrop = useOpenCrop()
  const root = useRef<HTMLDivElement>(null)

  const crops = cropsIn(categoryId, data.crops, recentCrops)
  const title =
    categoryId === RECENT_CATEGORY.id
      ? t('categories.recent')
      : pick(data.categories.find((c) => c.id === categoryId)?.name)
  const list = useFocusList(cropListIds(crops, prices), {
    root,
    digitOffset: leadingItems(prices),
    active: !nav.sheet,
    onActivate: (id) => {
      const crop = cropOf(id)
      if (crop) openCrop(crop)
      else if (id === RETRY_ID) prices.retry()
    },
  })
  useKeys({
    ...list.keys,
    onStar: togglePriceType,
    onHash: () => nav.openSheet('area'),
    onMenu: () => nav.openSheet('menu'),
  })

  const areaName = areaLabel(data.myArea, data.country, lang) || (areaId ?? '')
  const action = okAction(list.focusedId)
  const overlay =
    nav.sheet === 'menu' ? (
      <MenuSheet areaFor="home" />
    ) : nav.sheet === 'area' ? (
      <AreaSheet areaFor="home" currentAreaId={areaId ?? ''} />
    ) : null

  return (
    <Shell
      title={title}
      softKeys={
        nav.sheet
          ? sheetSoftKeys(t)
          : {
              left: t('softkeys.menu'),
              center: action ? t(`softkeys.${action}`) : '',
              right: t('softkeys.back'),
            }
      }
      overlay={overlay}
    >
      <InfoBar
        small={<PriceTypeTag type={format.type} label={t(`priceType.${format.type}`)} />}
        left={
          <>
            <UiIcon name="pin" />
            <b>{areaName}</b>
            <KeyCap>#</KeyCap>
          </>
        }
        right={
          <>
            <KeyCap>*</KeyCap>
            <PriceTypeTag type={format.type} label={t(`priceType.${format.type}`)} />
            {format.unitLabel}
          </>
        }
      />
      <div ref={root}>
        <CropPriceList
          crops={crops}
          prices={prices}
          areaName={areaName}
          empty={<StatusBox lines={[t('freshness.none')]} />}
        />
      </div>
    </Shell>
  )
}
