import { useRef } from 'react'
import { useLocation } from 'react-router'

import { useNav } from '@/app/navigation'
import { type AreasFor, paths, withoutSheet, withParam } from '@/app/paths'
import { Sheet, type SheetItem } from '@/components/Sheet/Sheet'
import type { SoftKeyLabels } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useSettings } from '@/store/settings'

import { useCountryData } from './useCountryData'
import { areaLabel, type Text, useText } from './useText'

export interface AreaSheetProps {
  /** `home` changes my area (store); `view` changes the `?area=` of the current screen. */
  areaFor: AreasFor
  /** The area shown with a check mark. */
  currentAreaId: string
}

const AREA = 'area:'
const OTHER_AREAS = 'areas'

/**
 * Soft keys while any panel is open (空／選取／關閉). A panel cannot relabel the screen's Shell,
 * so the screen passes these instead of its own: `softKeys={nav.sheet ? sheetSoftKeys(t) : own}`.
 */
// eslint-disable-next-line react-refresh/only-export-components -- a tiny helper for the screens
export function sheetSoftKeys(t: Text['t']): SoftKeyLabels {
  return { left: '', center: t('softkeys.select'), right: t('softkeys.close') }
}

/**
 * The `#` change-area panel (F07, docs/02 §5.6): the 3 recent areas (the current one checked)
 * plus 「其他地區…」, shown while `?sheet=area` is open. Screens render it in Shell's `overlay`
 * slot and pass `active: nav.sheet === null` to their own focus list meanwhile.
 * ↑ ↓ OK and 1–9 pick a row; either soft key closes the panel.
 */
export function AreaSheet({ areaFor, currentAreaId }: AreaSheetProps) {
  const { t, lang } = useText()
  const nav = useNav()
  const location = useLocation()
  const { country, area } = useCountryData()
  const recentIds = useSettings((s) => s.recentAreaIds)
  const chooseArea = useSettings((s) => s.chooseArea)
  const rememberArea = useSettings((s) => s.rememberArea)
  const root = useRef<HTMLDivElement>(null)

  // The screen under the panel, e.g. `/crop/onion/today?area=pune`.
  const here = withoutSheet(location.pathname + location.search)
  const items: SheetItem[] = [
    ...recentIds.map((id) => ({
      focusId: AREA + id,
      label: areaLabel(area(id), country, lang) || id,
      icon: 'pin' as const,
      current: id === currentAreaId,
    })),
    { focusId: OTHER_AREAS, label: t('areas.other'), icon: 'grid' },
  ]

  const choose = (focusId: string) => {
    if (focusId === OTHER_AREAS) {
      const back = areaFor === 'view' ? `&back=${encodeURIComponent(here)}` : ''
      nav.leaveSheet(paths.areas(areaFor) + back)
      return
    }
    const id = focusId.slice(AREA.length)
    if (areaFor === 'home') {
      chooseArea(id)
      nav.closeSheet()
    } else {
      rememberArea(id)
      nav.closeSheetAndReplace(withParam(here, 'area', id))
    }
  }

  const list = useFocusList(
    items.map((item) => item.focusId),
    { root, onActivate: choose },
  )
  useKeys({ ...list.keys, onMenu: nav.closeSheet }, { layer: 'overlay' })

  return (
    <div ref={root}>
      <Sheet title={t('areas.change')} items={items} />
    </div>
  )
}
