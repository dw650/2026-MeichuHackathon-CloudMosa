import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useRefresh } from '@/api/queries'
import { useNav } from '@/app/navigation'
import { type AreasFor, paths } from '@/app/paths'
import { Sheet, type SheetItem } from '@/components/Sheet/Sheet'
import type { SoftKeyLabels } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { useSettings } from '@/store/settings'

export interface MenuSheetProps {
  /** Detail screens pass the crop being viewed: 「加入／取消關注」 comes first (F08). */
  cropId?: string
  /**
   * Which area 「換地區」 changes: my area (home, crop lists) or the viewed one (?area=). The row
   * opens the area sheet of the same screen (`?sheet=area`), so that screen's `AreaSheet`
   * decides; the prop documents the screen's choice and keeps the call sites uniform.
   */
  areaFor: AreasFor
}

interface MenuRow extends SheetItem {
  run(): void
}

/**
 * Soft key labels while a bottom sheet is open (mockup `shell`): blank / 選取 / 關閉. The sheet
 * cannot change the screen's soft keys, so a screen passes these to `Shell` instead of its own
 * whenever `nav.sheet` is set:
 *
 *   const sheetKeys = useMenuSheetSoftKeys()
 *   <Shell softKeys={nav.sheet ? sheetKeys : { left: t('softkeys.menu'), … }} overlay={…} />
 */
// eslint-disable-next-line react-refresh/only-export-components -- belongs with the sheet it labels
export function useMenuSheetSoftKeys(): SoftKeyLabels {
  const { t } = useTranslation()
  return { left: '', center: t('softkeys.select'), right: t('softkeys.close') }
}

/**
 * The left soft key menu (F08, docs/02 §5.7), shown while `?sheet=menu` is open. Screens render
 * it in Shell's `overlay` slot and pass `useMenuSheetSoftKeys()` as their soft keys meanwhile;
 * a screen with this menu must also render its `AreaSheet` for `?sheet=area`, which 「換地區」
 * opens in place of the menu.
 *
 * Keys go to the menu only (overlay layer): ↑ ↓ move, OK or 1–9 run a row, the left soft key
 * closes it, and the right soft key (history back) closes it too.
 */
export function MenuSheet({ cropId }: MenuSheetProps) {
  const { t } = useTranslation()
  const nav = useNav()
  const refresh = useRefresh()
  const watched = useSettings((s) => cropId !== undefined && s.watchlist.includes(cropId))
  const toggleWatch = useSettings((s) => s.toggleWatch)
  const root = useRef<HTMLDivElement>(null)

  const rows: MenuRow[] = [
    ...(cropId === undefined
      ? []
      : [
          {
            focusId: 'watchToggle',
            icon: 'star' as const,
            label: t(watched ? 'menu.removeWatch' : 'menu.addWatch'),
            run: () => {
              toggleWatch(cropId)
              nav.closeSheet()
            },
          },
        ]),
    {
      focusId: 'area',
      icon: 'pin',
      label: t('menu.changeArea'),
      run: () => nav.openSheet('area'),
    },
    {
      focusId: 'watch',
      icon: 'star',
      label: t('menu.watchlist'),
      run: () => nav.leaveSheet(paths.watch()),
    },
    {
      focusId: 'refresh',
      icon: 'refresh',
      label: t('menu.refresh'),
      run: () => {
        nav.closeSheet()
        void refresh()
      },
    },
    {
      focusId: 'about',
      icon: 'info',
      label: t('menu.about'),
      run: () => nav.leaveSheet(paths.about()),
    },
    {
      focusId: 'settings',
      icon: 'gear',
      label: t('menu.settings'),
      run: () => nav.leaveSheet(paths.settings()),
    },
  ]

  const list = useFocusList(
    rows.map((row) => row.focusId),
    { root, onActivate: (id) => rows.find((row) => row.focusId === id)?.run() },
  )
  useKeys({ ...list.keys, onMenu: nav.closeSheet }, { layer: 'overlay' })

  return (
    <div ref={root}>
      <Sheet title={t('menu.title')} items={rows} />
    </div>
  )
}
