import type { TrustTier } from '../types/trust'
import './TrustBadge.css'

interface TrustBadgeProps {
  tier: TrustTier
  score?: number
  size?: 'sm' | 'md'
}

export function TrustBadge({ tier, score, size = 'md' }: TrustBadgeProps) {
  const title = score !== undefined ? `${tier.label} · Trust score ${score}/100` : tier.label

  return (
    <span
      className={`trust-badge trust-badge--${size} trust-badge--${tier.id}`}
      style={{ background: tier.color }}
      title={title}
    >
      {tier.label}
      {score !== undefined && <span className="trust-badge-score">{score}</span>}
    </span>
  )
}
