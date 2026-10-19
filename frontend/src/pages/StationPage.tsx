import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LINE_COLORS, fetchAlerts, fetchArrivals, fetchDirectionLabels, type Arrival, type StationAlert } from '../lib/mta'
import type { Station } from '../types/station'
import './StationPage.css'

const REFRESH_MS = 30_000
const MAX_ARRIVALS = 8

interface StationPageProps {
  stations: Station[]
}

function RouteBullet({ route, express = false, small = false }: { route: string; express?: boolean; small?: boolean }) {
  const textColor = ['N', 'Q', 'R', 'W'].includes(route) ? '#000' : '#fff'
  return (
    <span
      className={`route-bullet${express ? ' route-bullet-express' : ''}${small ? ' route-bullet-small' : ''}`}
      style={{ background: LINE_COLORS[route] ?? '#808183', color: textColor }}
      title={express ? `${route} Express` : undefined}
    >
      <span>{route}</span>
    </span>
  )
}

// swap the MTA's "[A]" / "[6X]" route codes in alert text for line bullets
function withRouteBullets(text: string): ReactNode[] {
  return text.split(/\[([^\]]+)\]/).map((part, i) => {
    if (i % 2 === 0) return part
    const express = /^\dX$/.test(part)
    const route = express ? part[0] : part
    return route in LINE_COLORS ? <RouteBullet key={i} route={route} express={express} small /> : `[${part}]`
  })
}

export function StationPage({ stations }: StationPageProps) {
  const { stationId = '' } = useParams()
  const station = stations.find((s) => s.id === stationId)

  if (!station) {
    return (
      <div className="station-page">
        <Link to="/" className="station-back-link">← Back to map</Link>
        <div className="station-empty">
          {stations.length ? `No station with ID "${stationId}".` : 'Loading station…'}
        </div>
      </div>
    )
  }

  // remount per station so live state starts fresh
  return <StationDetails key={station.id} station={station} stations={stations} />
}

function StationDetails({ station, stations }: { station: Station; stations: Station[] }) {
  const [labels, setLabels] = useState({ N: 'Northbound', S: 'Southbound' })
  const [arrivals, setArrivals] = useState<Record<'N' | 'S', Arrival[]> | null>(null)
  const [alerts, setAlerts] = useState<StationAlert[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  // bumping this re-runs the load effect, which also restarts the 30s timer
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    fetchDirectionLabels(station.id).then(setLabels)
  }, [station.id])

  useEffect(() => {
    const load = () => {
      fetchArrivals(station, stations)
        .then((data) => {
          setArrivals(data)
          setUpdatedAt(new Date())
          setError(null)
        })
        .catch(() => setError('Live train times are unavailable right now.'))
      fetchAlerts(station)
        .then(setAlerts)
        .catch(() => setAlerts([]))
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [station, stations, refreshCount])

  const minutesAway = (arrivalTime: number) => {
    const minutes = Math.floor((arrivalTime * 1000 - (updatedAt?.getTime() ?? 0)) / 60_000)
    return minutes <= 0 ? 'Now' : `${minutes} min`
  }

  return (
    <div className="station-page">
      <Link to="/" className="station-back-link">← Back to map</Link>

      <section className="station-hero">
        <h2 className="station-name">{station.name}</h2>
        <div className="station-meta">
          {station.lines.map((line) => <RouteBullet key={line} route={line} />)}
          <span>{station.borough}</span>
          {station.ada > 0 && <span className="station-ada">♿ Accessible</span>}
        </div>
      </section>

      <section>
        <div className="station-section-header">
          <h3>Next trains</h3>
          <div className="station-updated">
            {updatedAt && <span>Updated {updatedAt.toLocaleTimeString()}</span>}
            <button className="station-refresh" onClick={() => setRefreshCount((n) => n + 1)}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && <div className="station-empty">{error}</div>}
        {!arrivals && !error && <div className="station-empty">Loading live train times…</div>}

        {arrivals && (
          <div className="direction-grid">
            {(['N', 'S'] as const).map((dir) => (
              <div key={dir} className="direction-card">
                <h4>{labels[dir]}</h4>
                {arrivals[dir].length === 0 && <div>No trains scheduled right now.</div>}
                <ul className="arrival-list">
                  {arrivals[dir].slice(0, MAX_ARRIVALS).map((a) => (
                    <li key={a.tripId} className="arrival-row">
                      <RouteBullet route={a.route} express={a.isExpress} />
                      <span className="arrival-destination">{a.destination}</span>
                      <span className="arrival-time">{minutesAway(a.arrivalTime)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="station-section-header">
          <h3>Service alerts</h3>
        </div>

        {!alerts && <div className="station-empty">Loading alerts…</div>}
        {alerts?.length === 0 && <div className="station-empty">✓ No active alerts for this station.</div>}

        <ul className="alert-list">
          {alerts?.map((alert) => (
            <li key={alert.id} className={`alert-card${alert.stationSpecific ? '' : ' alert-line'}`}>
              <div className="alert-type">
                {alert.type ?? 'Alert'} · {alert.stationSpecific ? 'This station' : 'Line-wide'}
              </div>
              <p>{withRouteBullets(alert.header)}</p>
              {alert.description && (
                <details>
                  <summary>Details</summary>
                  <p>{withRouteBullets(alert.description)}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
