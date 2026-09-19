import { useEffect } from 'react'

import { PlaceholderScreen } from '@/screens/placeholder/PlaceholderScreen'
import { useSession } from '@/store/session'

import { TodayTab } from './TodayTab'
import { useDetail } from './useDetail'

/**
 * Crop detail (F04, docs/02 §5.4): `/crop/:cropId/:tab?area=` with the tabs 走勢｜行情｜比價.
 * Each tab owns its focus list and its one set of keys; the viewed area is `?area=` and never
 * changes my area.
 */
export default function CropDetailScreen() {
  const detail = useDetail()
  const known = detail.crop !== undefined
  const { cropId } = detail

  // 最近看過 (F03) lists the crops whose detail was opened.
  useEffect(() => {
    if (known) useSession.getState().viewCrop(cropId)
  }, [cropId, known])

  // Placeholder until T28 and T29 build the other tabs.
  if (detail.tab !== 'today') return <PlaceholderScreen name="crop-detail" />
  return <TodayTab detail={detail} />
}
