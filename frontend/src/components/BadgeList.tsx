import { BADGE_IDS, type Badge } from '../types/trust'
import { BADGES } from '../lib/trust'
import './BadgeList.css'

interface BadgeListProps {
  earned: Badge[]
  showLocked?: boolean
}

export function BadgeList({ earned, showLocked = true }: BadgeListProps) {
  const earnedIds = new Set(earned.map((b) => b.id))
  const visibleIds = showLocked ? BADGE_IDS : BADGE_IDS.filter((id) => earnedIds.has(id))

  if (visibleIds.length === 0) {
    return <p className="badge-list-empty">No badges earned yet.</p>
  }

  return (
    <ul className="badge-list">
      {visibleIds.map((id) => {
        const badge = BADGES[id]
        const isEarned = earnedIds.has(id)
        return (
          <li
            key={id}
            className={`badge-item ${isEarned ? 'earned' : 'locked'}`}
            title={`${badge.description}${isEarned ? '' : ' (not earned yet)'}`}
          >
            <span className="badge-icon" aria-hidden="true">
              {badge.icon}
            </span>
            <span className="badge-label">{badge.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
