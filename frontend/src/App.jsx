import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState({
    loading: true,
    connected: false,
    message: 'Checking backend connection...'
  })

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    fetch(`${apiUrl}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setStatus({
          loading: false,
          connected: true,
          message: data.message || 'Connected'
        })
      })
      .catch(() => {
        setStatus({
          loading: false,
          connected: false,
          message: 'Offline (FastAPI not detected on port 8000)'
        })
      })
  }, [])

  return (
    <div className="container">
      <h1>MetroPulse NYC 🚇</h1>
      <p className="subtitle">Project baseline initialized.</p>

      <div className={`status-badge ${status.connected ? 'online' : 'offline'}`}>
        <span className="dot"></span>
        <span>
          <strong>Backend:</strong> {status.loading ? 'Checking...' : status.message}
        </span>
      </div>
    </div>
  )
}

export default App
