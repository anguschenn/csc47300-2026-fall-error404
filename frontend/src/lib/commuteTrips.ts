import type { CommuteTrip, TripStatus } from '../types/commuteTrip'

export function getTripStatus(trip: CommuteTrip, now: number): TripStatus {
  if (trip.cancelled_at) return 'cancelled'
  if (now >= Date.parse(trip.meetup_end_at)) return 'completed'
  if (now >= Date.parse(trip.meetup_at)) return 'meeting_now'
  return 'upcoming'
}

export function isMyTrip(trip: CommuteTrip, userId: string | undefined): boolean {
  return Boolean(userId && (trip.creator.id === userId || trip.participants.some((person) => person.id === userId)))
}

export function filterCommuteTrips(
  trips: CommuteTrip[],
  filters: { status: TripStatus; myTripsOnly: boolean; line: string; departureStationId: string },
  userId: string | undefined,
  now: number,
): CommuteTrip[] {
  return trips.filter((trip) => getTripStatus(trip, now) === filters.status
    && (!filters.myTripsOnly || isMyTrip(trip, userId))
    && (!filters.line || trip.train_line === filters.line)
    && (!filters.departureStationId || trip.departure_station.id === filters.departureStationId))
    .sort((a, b) => filters.status === 'completed' || filters.status === 'cancelled'
      ? Date.parse(b.cancelled_at || b.meetup_end_at) - Date.parse(a.cancelled_at || a.meetup_end_at)
      : Date.parse(a.meetup_at) - Date.parse(b.meetup_at))
}
