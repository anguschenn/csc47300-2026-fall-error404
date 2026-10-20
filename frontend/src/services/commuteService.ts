import type { CommuteTrip, CommuteTripCreate } from '../types/commuteTrip'

const API_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000'

async function request<T>(token: string, path = '', options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1/commute-trips${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((item: { msg: string }) => item.msg).join(' ')
      : `SafeCommute is unavailable (${response.status}). Please try again.`
    throw new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : message)
  }
  return response.json() as Promise<T>
}

export const commuteService = {
  list: (token: string) => request<CommuteTrip[]>(token),
  publish: (token: string, trip: CommuteTripCreate) => request<CommuteTrip>(token, '', {
    method: 'POST', body: JSON.stringify(trip),
  }),
  setMembership: (token: string, tripId: string, joining: boolean) =>
    request<CommuteTrip>(token, `/${tripId}/membership`, { method: joining ? 'PUT' : 'DELETE' }),
  update: (token: string, tripId: string, trip: CommuteTripCreate) =>
    request<CommuteTrip>(token, `/${tripId}`, { method: 'PUT', body: JSON.stringify(trip) }),
  cancel: (token: string, tripId: string) =>
    request<CommuteTrip>(token, `/${tripId}/cancel`, { method: 'POST' }),
}
