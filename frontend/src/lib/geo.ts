/** Straight-line distances between area centres (docs/06 §4): haversine, Earth radius 6371 km. */

export interface LatLon {
  readonly lat: number
  readonly lon: number
}

const EARTH_RADIUS_KM = 6371
const rad = (deg: number) => (deg * Math.PI) / 180

export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)))
}

/** A copy ordered from the nearest to the farthest from `from` (stable for ties). */
export function byDistance<T extends LatLon>(places: readonly T[], from: LatLon): T[] {
  return places
    .map((place, index) => ({ place, index, km: distanceKm(from, place) }))
    .sort((x, y) => x.km - y.km || x.index - y.index)
    .map((x) => x.place)
}
