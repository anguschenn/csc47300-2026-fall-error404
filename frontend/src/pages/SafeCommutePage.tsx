import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { commuteService } from '../services/commuteService'
import type { CommuteTrip, TripStatus } from '../types/commuteTrip'
import type { Station } from '../types/station'
import { TrainLineBullet } from '../components/TrainLineBullet'
import { CommuteTripFilters } from '../components/CommuteTripFilters'
import { filterCommuteTrips, getTripStatus, isMyTrip } from '../lib/commuteTrips'
import './SafeCommutePage.css'

function meetupTime(value: string) {
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

function inputTime(value: string) {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const STATUS_LABELS: Record<TripStatus, string> = {
  upcoming: 'Upcoming', meeting_now: 'Meeting now', completed: 'Completed', cancelled: 'Cancelled',
}

export function SafeCommutePage({ stations }: { stations: Station[] }) {
  const { user, session, profile } = useAuth()
  const token = session?.access_token
  const [trips, setTrips] = useState<CommuteTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [trainLine, setTrainLine] = useState('')
  const [filterLine, setFilterLine] = useState('')
  const [statusTab, setStatusTab] = useState<TripStatus>('upcoming')
  const [myTripsOnly, setMyTripsOnly] = useState(false)
  const [filterDeparture, setFilterDeparture] = useState('')
  const [editingTripId, setEditingTripId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const formSection = useRef<HTMLElement>(null)
  const [departure, setDeparture] = useState('')
  const [destination, setDestination] = useState('')
  const [meetup, setMeetup] = useState('')
  const [meetupEnd, setMeetupEnd] = useState('')
  const generation = useRef(0)
  const mutating = useRef(false)
  const invalidateRequests = useCallback(() => { generation.current++ }, [])
  const availableLines = [...new Set(stations.flatMap((station) => station.lines))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const lineStations = stations.filter((station) => station.lines.includes(trainLine))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  function chooseLine(line: string) {
    setTrainLine(line)
    setDeparture('')
    setDestination('')
  }

  const refresh = useCallback(async () => {
    if (!token || mutating.current) return
    const current = ++generation.current
    try {
      const data = await commuteService.list(token)
      if (current === generation.current) {
        const refreshedAt = Date.now()
        setTrips(data)
        setNow(refreshedAt)
        setFilterLine((selected) => data.some((trip) => trip.train_line === selected) ? selected : '')
        setError('')
      }
    } catch (err) {
      if (current === generation.current) setError(err instanceof Error ? err.message : 'Could not load trips.')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const initial = window.setTimeout(() => { void refresh() }, 0)
    const timer = window.setInterval(() => { setNow(Date.now()); void refresh() }, 15000)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(initial)
      invalidateRequests()
    }
  }, [refresh, invalidateRequests])

  function resetForm() {
    setEditingTripId(null)
    setTrainLine('')
    setDeparture('')
    setDestination('')
    setMeetup('')
    setMeetupEnd('')
  }

  function editTrip(trip: CommuteTrip) {
    setEditingTripId(trip.id)
    setTrainLine(trip.train_line || '')
    setDeparture(trip.departure_station.id)
    setDestination(trip.destination_station.id)
    setMeetup(inputTime(trip.meetup_at))
    setMeetupEnd(inputTime(trip.meetup_end_at))
    setConfirmCancelId(null)
    setError('')
    setNotice('')
    formSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function cancelTrip(trip: CommuteTrip) {
    if (!token || mutating.current) return
    mutating.current = true
    generation.current++
    setBusy(`cancel:${trip.id}`)
    setError('')
    setNotice('')
    try {
      const updated = await commuteService.cancel(token, trip.id)
      setTrips((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      if (editingTripId === trip.id) resetForm()
      setConfirmCancelId(null)
      setStatusTab('cancelled')
      setFilterLine('')
      setFilterDeparture('')
      setNotice('Trip cancelled. It remains available in the Cancelled tab.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this trip.')
    } finally {
      mutating.current = false
      setBusy(null)
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || mutating.current) return
    setError('')
    setNotice('')
    if (!trainLine || !lineStations.some((station) => station.id === departure) || !lineStations.some((station) => station.id === destination)) {
      setError('Choose a train line and two stations served by that line.')
      return
    }
    if (departure === destination) {
      setError('Choose different departure and destination stations.')
      return
    }
    const start = new Date(meetup)
    const end = new Date(meetupEnd)
    // oxlint-disable-next-line react/purity -- The clock is read only when the form is submitted.
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() <= Date.now() || end <= start) {
      setError('Choose a future meetup time and an end time after it.')
      return
    }
    mutating.current = true
    generation.current++
    setBusy('publish')
    try {
      const input = {
        train_line: trainLine,
        departure_station_id: departure, destination_station_id: destination,
        meetup_at: start.toISOString(), meetup_end_at: end.toISOString(),
      }
      const trip = editingTripId
        ? await commuteService.update(token, editingTripId, input)
        : await commuteService.publish(token, input)
      setTrips((previous) => [...previous.filter((item) => item.id !== trip.id), trip]
        .sort((a, b) => Date.parse(a.meetup_at) - Date.parse(b.meetup_at)))
      setDeparture('')
      setTrainLine('')
      setFilterLine('')
      setFilterDeparture('')
      setStatusTab('upcoming')
      setDestination('')
      setMeetup('')
      setMeetupEnd('')
      setNotice(editingTripId ? 'Trip updated. Everyone in the group will see the changes.' : 'Trip published. You have joined its commute group.')
      setEditingTripId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish your trip.')
    } finally {
      mutating.current = false
      setBusy(null)
      setLoading(false)
    }
  }

  async function toggleMembership(trip: CommuteTrip, joined: boolean) {
    if (!token || mutating.current) return
    mutating.current = true
    generation.current++
    setBusy(trip.id)
    setError('')
    setNotice('')
    try {
      const updated = await commuteService.setMembership(token, trip.id, !joined)
      setTrips((previous) => previous.map((item) => item.id === updated.id ? updated : item))
      setNotice(joined ? 'You left the trip.' : 'You joined the trip.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your membership.')
    } finally {
      mutating.current = false
      setBusy(null)
    }
  }

  const creatorName = profile?.display_name || profile?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || 'Commuter'
  const scopedTrips = trips.filter((trip) => !myTripsOnly || isMyTrip(trip, user?.id))
  const statusCounts: Record<TripStatus, number> = { upcoming: 0, meeting_now: 0, completed: 0, cancelled: 0 }
  for (const trip of scopedTrips) statusCounts[getTripStatus(trip, now)]++
  const statusTrips = scopedTrips.filter((trip) => getTripStatus(trip, now) === statusTab)
  const activeLines = [...new Set(statusTrips.flatMap((trip) => trip.train_line ? [trip.train_line] : []))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const activeFilterLine = activeLines.includes(filterLine) ? filterLine : ''
  const lineTrips = statusTrips.filter((trip) => !activeFilterLine || trip.train_line === activeFilterLine)
  const departureOptions = [...new Map(lineTrips.map((trip) => [trip.departure_station.id, trip.departure_station])).values()]
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const activeFilterDeparture = departureOptions.some((station) => station.id === filterDeparture) ? filterDeparture : ''
  const visibleTrips = filterCommuteTrips(trips, {
    status: statusTab, myTripsOnly, line: activeFilterLine, departureStationId: activeFilterDeparture,
  }, user?.id, now)

  function clearFilters() {
    setMyTripsOnly(false)
    setFilterLine('')
    setFilterDeparture('')
  }

  return (
    <main className="safe-commute">
      <div className="sc-heading">
        <div>
          <span className="sc-eyebrow">TRAVEL TOGETHER</span>
          <h2>SafeCommute</h2>
          <p>Find your next commute group. Meet at the station and ride together.</p>
        </div>
        <button type="button" className="sc-secondary" onClick={() => { void refresh() }} disabled={busy !== null}>Refresh trips</button>
      </div>

      {error && <p className="sc-error" role="alert">{error}</p>}
      <p className="sc-notice" role="status">{notice}</p>

      <div className="sc-layout">
        <section ref={formSection} className="sc-publish" aria-labelledby="publish-trip-heading">
          <h3 id="publish-trip-heading">{editingTripId ? 'Edit trip' : 'Plan a trip'}</h3>
          <p>{editingTripId ? <>Editing your trip as <strong>{creatorName}</strong>. Changes will be visible to the group.</> : <>Publishing as <strong>{creatorName}</strong>. You automatically join your trip.</>}</p>
          <form onSubmit={(event) => { void publish(event) }}>
            <fieldset className="sc-trip-fields" disabled={busy !== null}>
            <label htmlFor="sc-train-line">Train line</label>
            <select id="sc-train-line" required value={trainLine} onChange={(event) => chooseLine(event.target.value)}>
              <option value="">Choose a train line</option>
              {availableLines.map((line) => <option key={line} value={line}>{line} train</option>)}
            </select>
            {trainLine && <div className="sc-selected-line"><TrainLineBullet line={trainLine} /><span>Choose two stations on the {trainLine} line.</span></div>}
            <label htmlFor="sc-departure">Departure station</label>
            <select id="sc-departure" required disabled={!trainLine} value={departure} onChange={(event) => setDeparture(event.target.value)}>
              <option value="">{trainLine ? 'Choose a station' : 'Choose a train line first'}</option>
              {lineStations.map((station) => <option key={station.id} value={station.id}>{station.name} · {station.borough} ({station.id})</option>)}
            </select>
            <label htmlFor="sc-destination">Destination station</label>
            <select id="sc-destination" required disabled={!trainLine} value={destination} onChange={(event) => setDestination(event.target.value)}>
              <option value="">{trainLine ? 'Choose a station' : 'Choose a train line first'}</option>
              {lineStations.map((station) => <option key={station.id} value={station.id} disabled={station.id === departure}>{station.name} · {station.borough} ({station.id})</option>)}
            </select>
            <label htmlFor="sc-meetup">Meetup window starts</label>
            <input id="sc-meetup" type="datetime-local" required value={meetup} onChange={(event) => setMeetup(event.target.value)} />
            <label htmlFor="sc-meetup-end">Meetup window ends</label>
            <input id="sc-meetup-end" type="datetime-local" required value={meetupEnd} min={meetup || undefined} onChange={(event) => setMeetupEnd(event.target.value)} />
            <small>Enter times in your device’s local time zone. Trip cards shown in Eastern Standard Time.</small>
            {!stations.length && <p role="status">Stations are unavailable. Check the backend connection and refresh the page.</p>}
            <button className="sc-primary" type="submit" disabled={busy !== null || !trainLine || !stations.length}>{busy === 'publish' ? (editingTripId ? 'Saving…' : 'Publishing…') : editingTripId ? 'Save changes' : 'Publish trip'}</button>
            {editingTripId && <button className="sc-secondary" type="button" onClick={resetForm}>Discard changes</button>}
            </fieldset>
          </form>
        </section>

        <section className="sc-feed" aria-labelledby="upcoming-trips-heading" aria-busy={loading}>
          <h3 id="upcoming-trips-heading">Trips <span className="sc-count">{visibleTrips.length}</span></h3>
          <CommuteTripFilters status={statusTab} counts={statusCounts} myTripsOnly={myTripsOnly}
            line={activeFilterLine} lines={activeLines.map((line) => ({ id: line, count: statusTrips.filter((trip) => trip.train_line === line).length }))}
            departureStationId={activeFilterDeparture} departureStations={departureOptions} total={statusTrips.length}
            onStatusChange={(status) => { setStatusTab(status); setFilterLine(''); setFilterDeparture(''); setConfirmCancelId(null) }}
            onMyTripsChange={(value) => { setMyTripsOnly(value); setFilterLine(''); setFilterDeparture('') }}
            onLineChange={(line) => { setFilterLine(line); setFilterDeparture('') }}
            onDepartureChange={setFilterDeparture} onReset={clearFilters} />
          <div id="sc-trip-panel" role="tabpanel" aria-labelledby={`sc-tab-${statusTab}`} tabIndex={0}>
          {(activeFilterLine || activeFilterDeparture || myTripsOnly) && <p className="sc-filter-summary" role="status">Showing {visibleTrips.length} of {statusTrips.length} trips.</p>}
          {loading ? <p role="status">Loading trips…</p> : visibleTrips.length === 0 && (
            <div className="sc-empty">{error ? 'Trips could not be loaded. Use Refresh trips to try again.' : statusTrips.length ? 'No trips match these filters. Try clearing the filters.' : `No ${STATUS_LABELS[statusTab].toLowerCase()} trips${myTripsOnly ? ' created or joined by you' : ''}.`}</div>
          )}
          {visibleTrips.map((trip) => {
            const joined = trip.participants.some((participant) => participant.id === user?.id)
            const status = getTripStatus(trip, now)
            const isCreator = trip.creator.id === user?.id
            const active = status === 'upcoming' || status === 'meeting_now'
            return (
              <article className="sc-card" key={trip.id}>
                <div className="sc-card-top"><span>Created by <strong>{trip.creator.display_name}</strong></span>{trip.creator.id === user?.id && <span className="sc-tag">Your trip</span>}</div>
                <span className={`sc-trip-status sc-trip-status-${status}`}>{STATUS_LABELS[status]}</span>
                {trip.train_line ? <div className="sc-card-line"><TrainLineBullet line={trip.train_line} /><strong>{trip.train_line} train</strong></div> : <p className="sc-legacy-line">Train line was not specified for this earlier trip.</p>}
                <h4>{trip.departure_station.name} <span aria-label="to">→</span> {trip.destination_station.name}</h4>
                <p className="sc-time">Meet <time dateTime={trip.meetup_at}>{meetupTime(trip.meetup_at)}</time> – <time dateTime={trip.meetup_end_at}>{meetupTime(trip.meetup_end_at)}</time></p>
                <h5>Commute group · {trip.participants.length} {trip.participants.length === 1 ? 'rider' : 'riders'}</h5>
                {trip.participants.length ? (
                  <ul className="sc-members">{trip.participants.map((participant) => <li key={participant.id}>{participant.display_name}{participant.id === user?.id ? ' (you)' : ''}</li>)}</ul>
                ) : <p>No riders have joined yet.</p>}
                <div className="sc-trip-actions">
                {active && <button type="button" className={joined ? 'sc-secondary' : 'sc-primary'} disabled={busy !== null} onClick={() => { void toggleMembership(trip, joined) }}>
                  {busy === trip.id ? 'Updating…' : joined ? 'Leave trip' : 'Join trip'}
                </button>}
                {isCreator && status === 'upcoming' && <button type="button" className="sc-secondary" disabled={busy !== null} onClick={() => editTrip(trip)}>Edit trip</button>}
                {isCreator && active && <button type="button" className="sc-danger" disabled={busy !== null} onClick={() => setConfirmCancelId(trip.id)}>Cancel trip</button>}
                </div>
                {confirmCancelId === trip.id && isCreator && active && <div className="sc-cancel-confirm" role="group" aria-label="Confirm trip cancellation">
                  <p>Cancel this trip? It will move to Cancelled for everyone in the group.</p>
                  <button type="button" className="sc-danger" disabled={busy !== null} onClick={() => { void cancelTrip(trip) }}>{busy === `cancel:${trip.id}` ? 'Cancelling…' : 'Confirm cancellation'}</button>
                  <button type="button" className="sc-secondary" disabled={busy !== null} onClick={() => setConfirmCancelId(null)}>Keep trip</button>
                </div>}
              </article>
            )
          })}
          </div>
        </section>
      </div>
    </main>
  )
}
