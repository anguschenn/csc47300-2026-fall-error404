export interface CommutePerson {
  id: string
  display_name: string
}

export interface CommuteTrip {
  id: string
  creator: CommutePerson
  train_line: string | null
  departure_station: { id: string; name: string }
  destination_station: { id: string; name: string }
  meetup_at: string
  meetup_end_at: string
  participants: CommutePerson[]
}

export interface CommuteTripCreate {
  train_line: string
  departure_station_id: string
  destination_station_id: string
  meetup_at: string
  meetup_end_at: string
}
