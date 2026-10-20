import type { KeyboardEvent } from 'react'
import type { TripStatus } from '../types/commuteTrip'
import { TrainLineBullet } from './TrainLineBullet'

const STATUS_TABS: { id: TripStatus; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'meeting_now', label: 'Meeting now' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

interface Props {
  status: TripStatus
  counts: Record<TripStatus, number>
  myTripsOnly: boolean
  line: string
  lines: { id: string; count: number }[]
  departureStationId: string
  departureStations: { id: string; name: string }[]
  total: number
  onStatusChange: (status: TripStatus) => void
  onMyTripsChange: (value: boolean) => void
  onLineChange: (line: string) => void
  onDepartureChange: (stationId: string) => void
  onReset: () => void
}

export function CommuteTripFilters(props: Props) {
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % STATUS_TABS.length
    else if (event.key === 'ArrowLeft') next = (index + STATUS_TABS.length - 1) % STATUS_TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = STATUS_TABS.length - 1
    else return
    event.preventDefault()
    props.onStatusChange(STATUS_TABS[next].id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <section className="sc-filter-box" aria-label="Trip filters">
      <div className="sc-status-tabs" role="tablist" aria-label="Trip status">
        {STATUS_TABS.map((tab, index) => (
          <button key={tab.id} id={`sc-tab-${tab.id}`} type="button" role="tab"
            aria-selected={props.status === tab.id} aria-controls="sc-trip-panel"
            tabIndex={props.status === tab.id ? 0 : -1} className={props.status === tab.id ? 'active' : ''}
            onClick={() => props.onStatusChange(tab.id)} onKeyDown={(event) => navigateTabs(event, index)}>
            {tab.label} <span className="sc-filter-count">{props.counts[tab.id]}</span>
          </button>
        ))}
      </div>
      <div className="sc-filter-options">
        <label className="sc-departure-filter" htmlFor="sc-filter-departure">Departure station
          <select id="sc-filter-departure" value={props.departureStationId} onChange={(event) => props.onDepartureChange(event.target.value)}>
            <option value="">All departure stations</option>
            {props.departureStations.map((station) => <option key={station.id} value={station.id}>{station.name} ({station.id})</option>)}
          </select>
        </label>
      </div>
      <div className="sc-line-filters" role="group" aria-label="Filter trips by train line">
        <button type="button" className={!props.line ? 'active' : ''} aria-pressed={!props.line} onClick={() => props.onLineChange('')}>
          All lines <span className="sc-filter-count">{props.total}</span>
        </button>
        {props.lines.map((line) => (
          <button key={line.id} type="button" className={props.line === line.id ? 'active' : ''} aria-pressed={props.line === line.id} onClick={() => props.onLineChange(line.id)}>
            <TrainLineBullet line={line.id} /><span>{line.id} train</span><span className="sc-filter-count">{line.count}</span>
          </button>
        ))}
      </div>
      <div className="sc-filter-footer">
        <label className="sc-my-trips"><input type="checkbox" checked={props.myTripsOnly} onChange={(event) => props.onMyTripsChange(event.target.checked)} />My trips</label>
        <button type="button" className="sc-clear-filters" onClick={props.onReset}>Clear filters</button>
      </div>
    </section>
  )
}
