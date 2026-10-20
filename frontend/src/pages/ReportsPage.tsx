import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { reportsService } from '../services/reportsService'
import { getUserStats } from '../services/trustService'
import { getTrustSummary } from '../lib/trust'
import type { Report, ReportCreate } from '../types/report'
import type { Station } from '../types/station'
import { ReportCard } from '../components/reports/ReportCard'
import { ReportFilters, type CategoryFilter } from '../components/reports/ReportFilters'
import { ReportForm } from '../components/reports/ReportForm'
import './ReportsPage.css'

// Display the reports page, which shows a feed of reports and a form to create new reports.
export function ReportsPage({ stations }: { stations: Station[] }) {
  const { user, session, profile } = useAuth()
  const viewerId = user?.id ?? null
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [line, setLine] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const lines = [...new Set(stations.flatMap((s) => s.lines))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  // Reload when the viewer changes so "upvoted" reflects who is signed in
  useEffect(() => {
    let cancelled = false
    reportsService
      .list(viewerId ?? undefined)
      .then((data) => {
        if (cancelled) return
        setReports(data)
        setError('')
      })
      .catch(() => {
        if (!cancelled) setError('Could not load reports.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewerId])

  // Keep "x min ago" labels fresh
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const visibleReports = reports.filter(
    (r) => (category === 'all' || r.category === category) && (!line || r.line === line)
  )
  // Handle creating a new report and updating the feed with it
  async function handleCreate(input: ReportCreate) {
    if (!user) throw new Error('Sign in to post a report.')
    setNotice('')
    const stats = await getUserStats(user.id)
    const created = await reportsService.create(session?.access_token ?? '', input, {
      id: user.id,
      name:
        profile?.display_name ||
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Commuter',
      trust_tier: getTrustSummary(stats).tier.id,
    })
    setReports((prev) => [created, ...prev])
    setNow(Date.now())
    setNotice('Report posted. Thanks for looking out for other riders!')
  }

  // Handle toggling the upvote for a report and updating the feed with the new state
  async function handleToggleUpvote(report: Report) {
    if (!user || busyId) return
    setBusyId(report.id)
    setError('')
    try {
      const updated = await reportsService.toggleUpvote(session?.access_token ?? '', report.id, user.id)
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your upvote.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="reports-page">
      <div className="rp-heading">
        <div>
          <span className="rp-eyebrow">COMMUNITY REPORTS</span>
          <h2>Station Reports</h2>
        </div>
        <p className="rp-subtitle">Live issues reported by riders. Upvote what you are seeing too.</p>
      </div>

      <div className="rp-layout">
        <aside className="rp-post">
          <h3>Report an issue</h3>
          {user ? (
            <>
              <p>Help other riders by sharing what is happening at your station.</p>
              <ReportForm stations={stations} lines={lines} onSubmit={handleCreate} />
              {notice && <p className="rp-notice" role="status">{notice}</p>}
            </>
          ) : (
            <div className="rp-locked">
              <span className="rp-locked-icon" aria-hidden="true">🔒</span>
              <p>
                <strong>Sign in to post reports and upvote.</strong>
              </p>
              <p>Anyone can read reports. Use the Sign In button at the top of the page to join in.</p>
            </div>
          )}
        </aside>

        <section className="rp-feed" aria-label="Recent reports">
          <ReportFilters
            category={category}
            line={line}
            lines={lines}
            onCategoryChange={setCategory}
            onLineChange={setLine}
          />

          {error && <p className="rp-error" role="alert">{error}</p>}

          {loading ? (
            <div className="rp-empty">Loading reports...</div>
          ) : visibleReports.length === 0 ? (
            <div className="rp-empty">
              {reports.length ? 'No reports match these filters.' : 'No reports yet. All clear!'}
            </div>
          ) : (
            visibleReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                viewerId={viewerId}
                now={now}
                busy={busyId === report.id}
                onToggleUpvote={handleToggleUpvote}
              />
            ))
          )}
        </section>
      </div>
    </div>
  )
}
