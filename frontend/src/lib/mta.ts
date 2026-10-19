import GtfsRealtimeBindings from 'gtfs-realtime-bindings'
import type { Station } from '../types/station'

// Public MTA feeds (no API key, CORS enabled), fetched straight from the browser
const FEED_BASE = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/'
const ALERTS_URL = `${FEED_BASE}camsys%2Fsubway-alerts.json`
const STATION_INFO_URL = 'https://data.ny.gov/resource/39hk-dx4f.json'

const FEED_FOR_LINE: Record<string, string[]> = {
  '1': ['nyct%2Fgtfs'], '2': ['nyct%2Fgtfs'], '3': ['nyct%2Fgtfs'], '4': ['nyct%2Fgtfs'],
  '5': ['nyct%2Fgtfs'], '6': ['nyct%2Fgtfs'], '7': ['nyct%2Fgtfs'],
  A: ['nyct%2Fgtfs-ace'], C: ['nyct%2Fgtfs-ace'], E: ['nyct%2Fgtfs-ace'],
  B: ['nyct%2Fgtfs-bdfm'], D: ['nyct%2Fgtfs-bdfm'], F: ['nyct%2Fgtfs-bdfm'], M: ['nyct%2Fgtfs-bdfm'],
  G: ['nyct%2Fgtfs-g'], J: ['nyct%2Fgtfs-jz'], Z: ['nyct%2Fgtfs-jz'], L: ['nyct%2Fgtfs-l'],
  N: ['nyct%2Fgtfs-nqrw'], Q: ['nyct%2Fgtfs-nqrw'], R: ['nyct%2Fgtfs-nqrw'], W: ['nyct%2Fgtfs-nqrw'],
  // the three shuttles live in different feeds
  S: ['nyct%2Fgtfs', 'nyct%2Fgtfs-ace', 'nyct%2Fgtfs-bdfm'],
  SIR: ['nyct%2Fgtfs-si'],
}

export const LINE_COLORS: Record<string, string> = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C', '7': '#B933AD',
  A: '#0039A6', C: '#0039A6', E: '#0039A6',
  B: '#FF6319', D: '#FF6319', F: '#FF6319', M: '#FF6319',
  G: '#6CBE45', J: '#996633', Z: '#996633', L: '#A7A9AC',
  N: '#FCCC0A', Q: '#FCCC0A', R: '#FCCC0A', W: '#FCCC0A',
  S: '#808183', SIR: '#0039A6',
}

export interface Arrival {
  tripId: string
  route: string
  isExpress: boolean
  destination: string
  arrivalTime: number // unix seconds
}

export interface StationAlert {
  id: string
  type: string | null
  header: string
  description: string | null
  stationSpecific: boolean
}

// realtime route IDs -> the IDs used in Station.lines ('6X' -> '6', 'GS' -> 'S')
function normalizeRoute(routeId: string): string {
  if (['GS', 'FS', 'H'].includes(routeId)) return 'S'
  if (routeId === 'SI') return 'SIR'
  return routeId.length === 2 && routeId.endsWith('X') ? routeId[0] : routeId
}

const toNumber = (value: number | { toNumber(): number } | null | undefined) =>
  typeof value === 'number' ? value : value?.toNumber() ?? 0

export async function fetchArrivals(
  station: Station,
  stations: Station[]
): Promise<Record<'N' | 'S', Arrival[]>> {
  const feeds = [...new Set(station.lines.flatMap((line) => FEED_FOR_LINE[line] ?? []))]
  const names = new Map(stations.map((s) => [s.id, s.name]))
  const now = Date.now() / 1000
  const result: Record<'N' | 'S', Arrival[]> = { N: [], S: [] }

  const messages = await Promise.all(
    feeds.map(async (feed) => {
      const res = await fetch(FEED_BASE + feed)
      if (!res.ok) throw new Error(`MTA feed HTTP ${res.status}`)
      const buffer = new Uint8Array(await res.arrayBuffer())
      return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer)
    })
  )

  for (const message of messages) {
    for (const entity of message.entity) {
      const updates = entity.tripUpdate?.stopTimeUpdate
      if (!updates?.length) continue
      const terminalId = updates[updates.length - 1].stopId?.slice(0, -1) ?? ''

      for (const update of updates) {
        const direction = update.stopId === `${station.id}N` ? 'N' : update.stopId === `${station.id}S` ? 'S' : null
        const arrivalTime = toNumber(update.arrival?.time) || toNumber(update.departure?.time)
        if (!direction || arrivalTime < now - 30) continue
        result[direction].push({
          tripId: entity.tripUpdate?.trip.tripId ?? entity.id,
          route: normalizeRoute(entity.tripUpdate?.trip.routeId ?? ''),
          // express runs come through as '6X', '7X', '5X'
          isExpress: /^\dX$/.test(entity.tripUpdate?.trip.routeId ?? ''),
          destination: names.get(terminalId) ?? 'Train',
          arrivalTime,
        })
      }
    }
  }

  result.N.sort((a, b) => a.arrivalTime - b.arrivalTime)
  result.S.sort((a, b) => a.arrivalTime - b.arrivalTime)
  return result
}

export async function fetchDirectionLabels(stationId: string): Promise<Record<'N' | 'S', string>> {
  const fallback = { N: 'Northbound', S: 'Southbound' }
  try {
    const res = await fetch(`${STATION_INFO_URL}?gtfs_stop_id=${encodeURIComponent(stationId)}`)
    const [row] = await res.json()
    return {
      N: row?.north_direction_label || fallback.N,
      S: row?.south_direction_label || fallback.S,
    }
  } catch {
    return fallback
  }
}

interface RawAlertEntity {
  id: string
  alert: {
    active_period?: { start?: number; end?: number }[]
    informed_entity?: { route_id?: string; stop_id?: string }[]
    header_text?: { translation: { text: string; language: string }[] }
    description_text?: { translation: { text: string; language: string }[] }
    'transit_realtime.mercury_alert'?: { alert_type?: string }
  }
}

const englishText = (t?: { translation: { text: string; language: string }[] }) =>
  t?.translation.find((tr) => tr.language === 'en')?.text ?? null

// active alerts that name this station, or apply to a whole line serving it
export async function fetchAlerts(station: Station): Promise<StationAlert[]> {
  const res = await fetch(ALERTS_URL)
  if (!res.ok) throw new Error(`MTA alerts HTTP ${res.status}`)
  const { entity } = (await res.json()) as { entity: RawAlertEntity[] }

  const now = Date.now() / 1000
  const stopIds = [station.id, `${station.id}N`, `${station.id}S`]
  const alerts: StationAlert[] = []

  for (const { id, alert } of entity) {
    const periods = alert.active_period ?? []
    const active = !periods.length || periods.some((p) => (p.start ?? 0) <= now && (!p.end || p.end >= now))
    if (!active) continue

    const informed = alert.informed_entity ?? []
    const stationSpecific = informed.some((e) => e.stop_id && stopIds.includes(e.stop_id))
    const lineWide = informed.some(
      (e) => !e.stop_id && e.route_id && station.lines.includes(normalizeRoute(e.route_id))
    )
    if (!stationSpecific && !lineWide) continue

    alerts.push({
      id,
      type: alert['transit_realtime.mercury_alert']?.alert_type ?? null,
      header: englishText(alert.header_text) ?? 'Service alert',
      description: englishText(alert.description_text),
      stationSpecific,
    })
  }

  // station-specific alerts first
  return alerts.sort((a, b) => Number(b.stationSpecific) - Number(a.stationSpecific))
}
