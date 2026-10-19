export interface CommutePerson {
  id: string
  display_name: string
}

export interface CommuteTrip {
  id: string
  creator: CommutePerson
  departure_station: { id: string; name: string }
  destination_station: { id: string; name: string }
  meetup_at: string
  meetup_end_at: string
  participants: CommutePerson[]
}

export interface CommuteTripCreate {
  departure_station_id: string
  destination_station_id: string
  meetup_at: string
  meetup_end_at: string
}
