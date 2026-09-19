import { type Area, type Country, type Crop, useAreas, useCountries, useCrops } from '@/api/queries'
import { useSettings } from '@/store/settings'

export interface CountryData {
  /** The chosen country's settings from the API (units, locale, colours, defaults…). */
  country: Country | undefined
  areas: Area[]
  crops: Crop[]
  area(id: string | null | undefined): Area | undefined
  crop(id: string | null | undefined): Crop | undefined
  /** 我的地區 (home and crop lists). */
  myArea: Area | undefined
  isLoading: boolean
  error: unknown
}

/** Catalog data of the chosen country (or of `code`), shared by every screen. */
export function useCountryData(code?: string | null): CountryData {
  const chosen = useSettings((s) => s.country)
  const myAreaId = useSettings((s) => s.areaId)
  const cc = code ?? chosen
  const countries = useCountries()
  const areas = useAreas(cc)
  const crops = useCrops(cc)
  const areaList = areas.data?.areas ?? []
  const cropList = crops.data?.crops ?? []
  const area = (id: string | null | undefined) => areaList.find((a) => a.id === id)
  return {
    country: countries.data?.countries.find((c) => c.code === cc),
    areas: areaList,
    crops: cropList,
    area,
    crop: (id) => cropList.find((c) => c.id === id),
    myArea: area(myAreaId),
    isLoading: countries.isLoading || areas.isLoading || crops.isLoading,
    error: countries.error ?? areas.error ?? crops.error,
  }
}
