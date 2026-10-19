import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { NavLink } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { SafeCommutePage } from './pages/SafeCommutePage'
import { StationMap } from './components/StationMap'
import { AuthModal } from './components/AuthModal'
import { ProfileModal } from './components/ProfileModal'
import { StationPage } from './pages/StationPage'
import { useAuth } from './context/useAuth'
import type { Station } from './types/station'
import './App.css'

interface ConnectionStatus {
  loading: boolean
  connected: boolean
  message: string
}

function App() {
  const apiUrl = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000'
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<ConnectionStatus>({
    loading: true,
    connected: false,
    message: 'Checking backend connection...'
  })
  const [stations, setStations] = useState<Station[]>([])
  const [loadingStations, setLoadingStations] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

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
  }, [apiUrl])

  const openStation = useCallback(
    (station: Station) => navigate(`/stations/${station.id}`),
    [navigate]
  )

  // Look up station names for commuter preferences if set
  const homeStation = stations.find((s) => s.id === profile?.home_station_id)
  const workStation = stations.find((s) => s.id === profile?.work_station_id)

  const userDisplayName =
    profile?.display_name ||
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Commuter'

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand-block">
          <div className="title-row">
            <h1>MetroPulse NYC 🚇</h1>
          </div>
          <p className="subtitle">Real-time transit tracker & commuter safety network.</p>
        </div>

        <div className="header-actions">
          {user ? (
            <button
              className="user-profile-btn"
              onClick={() => setProfileModalOpen(true)}
              title="Manage your profile & commute stations"
            >
              <div className="user-profile-avatar">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={userDisplayName} />
                ) : (
                  <span>{userDisplayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="user-profile-name">{userDisplayName}</span>
            </button>
          ) : (
            <button className="sign-in-btn" onClick={() => setAuthModalOpen(true)}>
              Sign In
            </button>
          )}
        </div>
      </header>

      <nav className="app-tabs" aria-label="Main navigation">
        <NavLink to="/" end>Transit map</NavLink>
        {user && <NavLink to="/safe-commute">SafeCommute</NavLink>}
      </nav>

      <Routes>
        <Route path="/safe-commute" element={
          <RequireAuth><SafeCommutePage key={user?.id} stations={stations} /></RequireAuth>
        } />
        <Route path="/stations/:stationId" element={<StationPage stations={stations} />} />
        <Route
          path="*"
          element={
            <>
              {/* Commuter preferences strip when logged in */}
              {user && (homeStation || workStation) && (
                <div className="commuter-strip">
                  {homeStation && (
                    <span className="commute-tag">
                      🏠 <strong>Home:</strong> {homeStation.name}
                      {homeStation.lines?.length ? ` (${homeStation.lines.join(', ')})` : ''}
                    </span>
                  )}
                  {workStation && (
                    <span className="commute-tag">
                      💼 <strong>Work:</strong> {workStation.name}
                      {workStation.lines?.length ? ` (${workStation.lines.join(', ')})` : ''}
                    </span>
                  )}
                  <button
                    className="commute-edit-link"
                    onClick={() => setProfileModalOpen(true)}
                  >
                    Edit
                  </button>
                </div>
              )}

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
                <StationMap stations={stations} apiUrl={apiUrl} onStationClick={openStation} />
              </div>
            </>
          }
        />
      </Routes>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        stations={stations}
      />
    </div>
  )
}

export default App
