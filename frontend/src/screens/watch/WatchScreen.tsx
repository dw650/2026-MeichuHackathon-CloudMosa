import { useRef } from 'react'

import { Card, CardList, CheckBox } from '@/components/Card/Card'
import { CropIcon } from '@/components/CropIcon/CropIcon'
import { Shell } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useCountryData } from '@/screens/shared/useCountryData'
import { useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'

/**
 * 編輯關注 (F09, docs/02 §5.7): every crop of the country with a check box; OK watches or
 * stops watching the focused crop, saved at once. A crop watched again goes to the end of the
 * home list. On 128×160 the rows are one line (the card drops the variety).
 */
export default function WatchScreen() {
  const { t, pick } = useText()
  const { crops, toneOf } = useCountryData()
  const watchlist = useSettings((s) => s.watchlist)
  const toggleWatch = useSettings((s) => s.toggleWatch)
  const root = useRef<HTMLDivElement>(null)

  const list = useFocusList(
    crops.map((crop) => crop.id),
    { root, onActivate: toggleWatch },
  )
  // The rows carry no number key caps (mockup), so the digit keys do nothing here.
  useKeys({ ...list.keys, onDigit: undefined })

  return (
    <Shell
      title={t('watch.title')}
      softKeys={{ center: t('softkeys.toggle'), right: t('softkeys.back') }}
    >
      <div ref={root}>
        <CardList>
          {crops.map((crop) => (
            <Card
              key={crop.id}
              focusId={crop.id}
              lead={<CropIcon crop={crop.id} tone={toneOf(crop.category)} />}
              name={pick(crop.name)}
              meta={pick(crop.variety) || undefined}
              trailing={<CheckBox checked={watchlist.includes(crop.id)} />}
            />
          ))}
        </CardList>
      </div>
    </Shell>
  )
}
