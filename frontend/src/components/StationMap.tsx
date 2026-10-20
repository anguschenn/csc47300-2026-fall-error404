import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './StationMap.css'
import type { Station } from '../types/station'
import type { SubwayLineFeatureCollection } from '../types/subwayLine'

interface StationMapProps {
  stations: Station[]
  apiUrl?: string
  onStationClick?: (station: Station) => void
}

// bounds around nyc
const NYC_BOUNDS: L.LatLngBoundsExpression = [
  [40.48, -74.30],
  [40.94, -73.68],
]

export function StationMap({ stations, apiUrl, onStationClick }: StationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const [lineColors, setLineColors] = useState<Record<string, string>>({})
  const [tileError, setTileError] = useState(false)

  const resolvedApiUrl = apiUrl || (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000'

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [40.73061, -73.935242],
      zoom: 11,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: NYC_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
    })

    // Keep zoom controls accessible below the menu overlay on the landing map.
    L.control.zoom({ position: 'bottomleft' }).addTo(map)

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })

    let failedTiles = 0
    tileLayer.on('tileerror', () => {
      failedTiles++
      if (failedTiles >= 3) setTileError(true)
    })
    tileLayer.addTo(map)

    // keep lines below markers
    map.createPane('subwayLines').style.zIndex = '400'
    map.createPane('stationMarkers').style.zIndex = '450'

    markersLayerRef.current = L.layerGroup().addTo(map)
    mapInstanceRef.current = map

    // fetch subway line tracks from backend
    fetch(`${resolvedApiUrl}/api/v1/subway-lines/geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((geojsonData: SubwayLineFeatureCollection) => {
        if (!mapInstanceRef.current) return

        const colors: Record<string, string> = {}
        geojsonData.features.forEach((feat) => {
          const s = feat.properties?.service || feat.properties?.id
          if (s && feat.properties?.color) {
            colors[s] = feat.properties.color
          }
        })
        setLineColors(colors)

        L.geoJSON(geojsonData, {
          pane: 'subwayLines',
          style: (feature) => ({
            color: feature?.properties?.color || '#808183',
            weight: 3.5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          }),
          onEachFeature: (feature, layer) => {
            const service = feature?.properties?.service || feature?.properties?.id || ''
            const name = feature?.properties?.name || ''
            if (service) {
              layer.bindTooltip(
                `<strong>${service} Train</strong>${name ? `<br/><span class="subway-line-tooltip-name">${name}</span>` : ''}`,
                { sticky: true, direction: 'top', opacity: 0.95 }
              )
            }
          },
        }).addTo(map)
      })
      .catch((err) => console.warn('Could not load subway lines:', err))

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
    }
  }, [resolvedApiUrl])

  // render station dots when stations or colors change
  useEffect(() => {
    const markersLayer = markersLayerRef.current
    if (!markersLayer) return

    markersLayer.clearLayers()

    stations.forEach((station) => {
      if (!station.latitude || !station.longitude) return

      // visual dot
      const marker = L.circleMarker([station.latitude, station.longitude], {
        pane: 'stationMarkers',
        radius: 3.5,
        fillColor: '#111827',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
        interactive: false,
      })

      // invisible larger click target
      const hitTarget = L.circleMarker([station.latitude, station.longitude], {
        pane: 'stationMarkers',
        radius: 13,
        opacity: 0,
        fillOpacity: 0,
        stroke: false,
      })

      hitTarget.on('mouseover', () => {
        marker.setRadius(5.5)
        marker.setStyle({ weight: 2.5 })
        marker.bringToFront()
      })

      hitTarget.on('mouseout', () => {
        marker.setRadius(3.5)
        marker.setStyle({ weight: 2 })
      })

      const linesBadges = station.lines
        .map((l) => {
          const bg = lineColors[l] || '#333'
          const txtColor = ['N', 'Q', 'R', 'W'].includes(l.toUpperCase()) ? '#000' : '#fff'
          return `<span class="station-badge" style="background:${bg};color:${txtColor};">${l}</span>`
        })
        .join(' ')

      const adaHtml =
        station.ada > 0
          ? `<div class="station-ada-accessible">♿ ${
              station.ada === 1 ? 'Fully Accessible' : 'Partially Accessible'
            }</div>`
          : ''

      const popupContent = `
        <div class="station-popup">
          <h4 class="station-popup-title">${station.name}</h4>
          <span class="station-popup-borough">${station.borough}</span>
          <div class="station-badges-row">${linesBadges}</div>
          ${adaHtml}
          ${onStationClick ? `<a class="station-popup-link" href="/stations/${station.id}">Live arrivals &amp; alerts →</a>` : ''}
        </div>
      `

      hitTarget.bindPopup(popupContent, {
        closeButton: true,
        autoPan: true,
        offset: [0, -4],
      })

      hitTarget.bindTooltip(station.name, {
        direction: 'top',
        offset: [0, -6],
        opacity: 0.9,
      })

      if (onStationClick) {
        hitTarget.on('popupopen', (e) => {
          const link = e.popup.getElement()?.querySelector<HTMLAnchorElement>('.station-popup-link')
          if (!link) return
          link.onclick = (ev) => {
            // let cmd/ctrl/shift/middle-click open a new tab natively
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
            ev.preventDefault()
            onStationClick(station)
          }
        })
      }

      marker.addTo(markersLayer)
      hitTarget.addTo(markersLayer)
    })
  }, [stations, lineColors, onStationClick])

  return (
    <div className="station-map-wrapper">
      <div ref={mapContainerRef} className="station-map-container" />

      {tileError && (
        <div className="tile-error-banner">
          ⚠️ Map tiles unavailable. Subway lines and stations are still active.
        </div>
      )}
    </div>
  )
}
