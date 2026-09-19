import { useLayoutEffect, useRef } from 'react'

import type { Nav } from '@/app/navigation'
import { Sheet } from '@/components/Sheet/Sheet'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useText } from '@/screens/shared/useText'

import { SORT_LABEL } from './compareRows'
import { SORTS, type SortId } from './useDetail'

const PREFIX = 'sort:'

export interface SortSheetProps {
  nav: Nav
  current: SortId
  /** The compare tab's URL with this order, which replaces the screen below the panel. */
  urlFor(sort: SortId): string
}

/** The compare tab's `#` panel (docs/02 §5.4): 1–4 pick an order; the current one is ticked. */
export function SortSheet({ nav, current, urlFor }: SortSheetProps) {
  const { t } = useText()
  const root = useRef<HTMLDivElement>(null)
  const ids = SORTS.map((sort) => PREFIX + sort)
  const list = useFocusList(ids, {
    root,
    onActivate: (id) => nav.closeSheetAndReplace(urlFor(id.slice(PREFIX.length) as SortId)),
  })
  useKeys({ ...list.keys, onMenu: nav.closeSheet }, { layer: 'overlay' })

  // Opens on the order in use, as the mockup does.
  const started = useRef(false)
  useLayoutEffect(() => {
    if (started.current) return
    started.current = true
    list.focus(PREFIX + current)
  })

  return (
    <div ref={root}>
      <Sheet
        title={t('detail.compare.sortTitle')}
        items={SORTS.map((sort) => ({
          focusId: PREFIX + sort,
          label: t(`detail.compare.sorts.${SORT_LABEL[sort]}`),
          icon: 'sort',
          current: sort === current,
        }))}
      />
    </div>
  )
}
