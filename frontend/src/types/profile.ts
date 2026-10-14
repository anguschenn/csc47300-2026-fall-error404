export interface Profile {
  id: string
  email: string
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  home_station_id: string | null
  work_station_id: string | null
  created_at: string
}

export interface ProfileUpdate {
  full_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  home_station_id?: string | null
  work_station_id?: string | null
}
