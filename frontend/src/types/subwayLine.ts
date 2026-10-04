export interface SubwayLine {
  id: string
  name?: string
  color: string
  geometry: GeoJSON.MultiLineString | GeoJSON.LineString
}

export interface SubwayLineProperties {
  id: string
  service: string
  name?: string
  color: string
}

export interface SubwayLineFeature {
  type: 'Feature'
  properties: SubwayLineProperties
  geometry: GeoJSON.MultiLineString | GeoJSON.LineString
}

export interface SubwayLineFeatureCollection {
  type: 'FeatureCollection'
  features: SubwayLineFeature[]
}
