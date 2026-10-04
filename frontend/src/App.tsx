import { useState, useEffect } from 'react'
import { StationMap } from './components/StationMap'
import type { Station } from './types/station'
import './App.css'

interface ConnectionStatus {
  loading: boolean
  connected: boolean
  message: string
}

function App() {
  const apiUrl = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000'
  const [status, setStatus] = useState<ConnectionStatus>({
    loading: true,
    connected: false,
    message: 'Checking backend connection...'
  })
  const [stations, setStations] = useState<Station[]>([])
  const [loadingStations, setLoadingStations] = useState(false)

  useEffect(() => {
    fetch(`${apiUrl}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: { message?: string }) => {
        setStatus({
          loading: false,
          connected: true,
          message: data.message || 'Connected'
        })
        setLoadingStations(true)
        return fetch(`${apiUrl}/api/v1/stations`)
      })
      .then((res) => {
        if (res && res.ok) return res.json()
        return []
      })
      .then((data: Station[]) => {
        if (Array.isArray(data)) {
          setStations(data)
        }
      })
      .catch(() => {
        setStatus({
          loading: false,
          connected: false,
          message: 'Offline (FastAPI not detected on port 8000)'
        })
      })
      .finally(() => {
        setLoadingStations(false)
      })
  }, [])

  return (
    <div className="container">
      <h1>MetroPulse NYC 🚇</h1>
      <p className="subtitle">Real-time transit tracker & commuter safety network.</p>

      <div className="status-row">
        <div className={`status-badge ${status.connected ? 'online' : 'offline'}`}>
          <span className="dot"></span>
          <span>
            <strong>Backend:</strong> {status.loading ? 'Checking...' : status.message}
          </span>
        </div>

        {status.connected && (
          <div className="status-badge info">
            <span>
              <strong>Subway Stations:</strong>{' '}
              {loadingStations ? 'Loading stations...' : `${stations.length} loaded from Supabase`}
            </span>
          </div>
        )}
      </div>

      <div className="map-wrapper">
        <StationMap stations={stations} apiUrl={apiUrl} />
      </div>
    </div>
  )
}

export default App
