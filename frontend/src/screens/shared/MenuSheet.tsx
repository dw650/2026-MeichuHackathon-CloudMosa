import type { AreasFor } from '@/app/paths'

export interface MenuSheetProps {
  /** Detail screens pass the crop being viewed: 「加入／取消關注」 comes first (F08). */
  cropId?: string
  /** Which area 「換地區」 changes: my area (home, crop lists) or the viewed one (?area=). */
  areaFor: AreasFor
}

/**
 * The left soft key menu (F08), shown while `?sheet=menu` is open. Screens render it in
 * Shell's `overlay` slot. Placeholder until T33 builds it.
 */
export function MenuSheet(props: MenuSheetProps) {
  void props
  return null
}
