export interface Station {
  id: string
  complex_id?: string | null
  name: string
  borough: string
  lines: string[]
  latitude: number
  longitude: number
  structure?: string | null
  ada: number
  ada_notes?: string | null
}

