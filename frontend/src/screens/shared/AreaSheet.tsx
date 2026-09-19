import type { AreasFor } from '@/app/paths'

export interface AreaSheetProps {
  /** `home` changes my area (store); `view` changes the `?area=` of the current screen. */
  areaFor: AreasFor
  /** The area shown with a check mark. */
  currentAreaId: string
}

/**
 * The `#` change-area panel (F07): the 3 recent areas plus 「其他地區…」, shown while
 * `?sheet=area` is open. Screens render it in Shell's `overlay` slot. Placeholder until T31.
 */
export function AreaSheet(props: AreaSheetProps) {
  void props
  return null
}
