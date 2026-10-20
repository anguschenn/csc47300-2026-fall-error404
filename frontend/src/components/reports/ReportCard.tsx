import { Link } from 'react-router-dom'
import { REPORT_CATEGORY_INFO, type Report } from '../../types/report'
import { getTierById } from '../../lib/trust'
import { TrustBadge } from '../TrustBadge'
import { TrainLineBullet } from '../TrainLineBullet'

interface ReportCardProps {
  report: Report
  viewerId: string | null
  now: number
  busy: boolean
  onToggleUpvote: (report: Report) => void
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function ReportCard({ report, viewerId, now, busy, onToggleUpvote }: ReportCardProps) {
  const category = REPORT_CATEGORY_INFO[report.category]
  const isOwn = viewerId === report.author_id

  let upvoteTitle = report.upvoted ? 'Remove your upvote' : 'Confirm you are seeing this too'
  if (!viewerId) upvoteTitle = 'Sign in to upvote'
  else if (isOwn) upvoteTitle = 'You cannot upvote your own report'

  return (
    <article className={`rp-card rp-severity-${report.severity}`}>
      <div className="rp-card-top">
        <span className="rp-category">
          <span aria-hidden="true">{category.icon}</span> {category.label}
        </span>
        <span className={`rp-severity rp-severity-tag-${report.severity}`}>{report.severity}</span>
        <time className="rp-time" dateTime={report.created_at}>
          {timeAgo(report.created_at, now)}
        </time>
      </div>

      <div className="rp-card-station">
        {report.line && <TrainLineBullet line={report.line} />}
        <Link to={`/stations/${report.station_id}`}>{report.station_name}</Link>
      </div>

      <p className="rp-description">{report.description}</p>

      <div className="rp-card-bottom">
        <span className="rp-author">
          {report.author_name}
          <TrustBadge tier={getTierById(report.author_trust_tier)} size="sm" />
        </span>
        <button
          type="button"
          className={`rp-upvote${report.upvoted ? ' active' : ''}`}
          onClick={() => onToggleUpvote(report)}
          disabled={!viewerId || isOwn || busy}
          aria-pressed={report.upvoted}
          title={upvoteTitle}
        >
          👍 {report.upvotes}
        </button>
      </div>
    </article>
  )
}
