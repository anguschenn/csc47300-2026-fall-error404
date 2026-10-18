import type {
  Badge,
  BadgeId,
  TrustBreakdown,
  TrustSummary,
  TrustTier,
  TrustTierId,
  UserStats
} from '../types/trust'

// Community Trust Rating: 0–100 score 

// 4 Categories: Verification, Trip Ratings, Reporting, Account Age
export const MAX_POINTS = {
  verification: 30,
  tripRatings: 35,
  reporting: 20,
  accountAge: 15
} as const

// Penalties: Safety Reports upheld against the user
const VERIFICATION_POINTS = {
  phone: 10,
  schoolOrWorkEmail: 10,
  id: 10
} as const

const TRIP_RATINGS_FOR_FULL_CONFIDENCE = 10
const TRIP_RATING_PRIOR_WEIGHT = 4

const POINTS_PER_REPORT = 1
const POINTS_PER_UPVOTE = 0.25
const PENALTY_PER_FLAGGED_REPORT = 4

const DAYS_FOR_FULL_ACCOUNT_AGE = 90

const PENALTY_PER_UPHELD_SAFETY_REPORT = 15

// Ordered by min ascending; 
export const TIERS: readonly TrustTier[] = [
  { id: 'new', label: 'New', min: 0, color: '#9CA3AF' },
  { id: 'regular', label: 'Regular', min: 25, color: '#0039A6' },
  { id: 'trusted', label: 'Trusted', min: 50, color: '#00933C' },
  { id: 'pillar', label: 'Community Pillar', min: 75, color: '#FCCC0A' }
]

export const BADGES: Record<BadgeId, Badge> = {
  'phone-verified': {
    id: 'phone-verified',
    label: 'Phone Verified',
    description: 'Confirmed a phone number',
    icon: '📱'
  },
  'email-verified': {
    id: 'email-verified',
    label: 'School/Work Verified',
    description: 'Confirmed a school or employer email',
    icon: '🎓'
  },
  'id-verified': {
    id: 'id-verified',
    label: 'ID Verified',
    description: 'Completed government ID verification',
    icon: '🪪'
  },
  'first-report': {
    id: 'first-report',
    label: 'First Report',
    description: 'Submitted a first station incident report',
    icon: '📝'
  },
  'reliable-reporter': {
    id: 'reliable-reporter',
    label: 'Reliable Reporter',
    description: '10+ reports with fewer than 10% flagged',
    icon: '📡'
  },
  'helpful-voice': {
    id: 'helpful-voice',
    label: 'Helpful Voice',
    description: 'Reports received 50+ upvotes from riders',
    icon: '👍'
  },
  'safe-companion': {
    id: 'safe-companion',
    label: 'Safe Companion',
    description: '10+ shared trips rated, 90%+ positive',
    icon: '🤝'
  },
  veteran: {
    id: 'veteran',
    label: 'Veteran Rider',
    description: 'Member for over a year',
    icon: '🚇'
  }
}

export const EMPTY_STATS: UserStats = {
  accountAgeDays: 0,
  reportsSubmitted: 0,
  upVotesReceived: 0,
  reportsFlagged: 0,
  tripRatingsPositive: 0,
  tripRatingsNegative: 0,
  upheldSafetyReports: 0,
  phoneVerified: false,
  schoolOrWorkEmailVerified: false,
  idVerified: false
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Guards against negative/NaN counts from a bad API response.
const count = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)

export function accountAgeDaysFrom(createdAt: string, now: Date = new Date()): number {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return 0
  return Math.max(0, Math.floor((now.getTime() - created) / 86_400_000))
}

export function getTrustBreakdown(stats: UserStats): TrustBreakdown {
  const verification =
    (stats.phoneVerified ? VERIFICATION_POINTS.phone : 0) +
    (stats.schoolOrWorkEmailVerified ? VERIFICATION_POINTS.schoolOrWorkEmail : 0) +
    (stats.idVerified ? VERIFICATION_POINTS.id : 0)

  const positive = count(stats.tripRatingsPositive)
  const totalRatings = positive + count(stats.tripRatingsNegative)
  const smoothedRatio =
    (positive + TRIP_RATING_PRIOR_WEIGHT * 0.5) / (totalRatings + TRIP_RATING_PRIOR_WEIGHT)
  const confidence = Math.min(1, totalRatings / TRIP_RATINGS_FOR_FULL_CONFIDENCE)
  const tripRatings = MAX_POINTS.tripRatings * smoothedRatio * confidence

  const reporting = clamp(
    count(stats.reportsSubmitted) * POINTS_PER_REPORT +
      count(stats.upVotesReceived) * POINTS_PER_UPVOTE -
      count(stats.reportsFlagged) * PENALTY_PER_FLAGGED_REPORT,
    0,
    MAX_POINTS.reporting
  )

  const accountAge =
    MAX_POINTS.accountAge * Math.min(1, count(stats.accountAgeDays) / DAYS_FOR_FULL_ACCOUNT_AGE)

  const penalties = count(stats.upheldSafetyReports) * PENALTY_PER_UPHELD_SAFETY_REPORT

  return { verification, tripRatings, reporting, accountAge, penalties }
}

export function computeTrustScore(stats: UserStats): number {
  const b = getTrustBreakdown(stats)
  const raw = b.verification + b.tripRatings + b.reporting + b.accountAge - b.penalties
  return Math.round(clamp(raw, 0, 100))
}

export function getTrustTier(score: number): TrustTier {
  let tier = TIERS[0]
  for (const t of TIERS) {
    if (score >= t.min) tier = t
  }
  return tier
}

export function getNextTier(score: number): TrustTier | null {
  return TIERS.find((t) => t.min > score) ?? null
}

export function getTierById(id: TrustTierId): TrustTier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0]
}

// For UI gating, e.g. hiding "verified users only" trips from low-trust viewers.
export function meetsTrustTier(score: number, requiredTier: TrustTierId): boolean {
  return score >= getTierById(requiredTier).min
}

// 0–1 progress through the current tier, for a progress bar.
export function getTierProgress(score: number): number {
  const tier = getTrustTier(score)
  const next = getNextTier(score)
  if (!next) return 1
  return (score - tier.min) / (next.min - tier.min)
}

export function getBadges(stats: UserStats): Badge[] {
  const earned: BadgeId[] = []

  if (stats.phoneVerified) earned.push('phone-verified')
  if (stats.schoolOrWorkEmailVerified) earned.push('email-verified')
  if (stats.idVerified) earned.push('id-verified')

  const reports = count(stats.reportsSubmitted)
  if (reports >= 1) earned.push('first-report')
  if (reports >= 10 && count(stats.reportsFlagged) / reports < 0.1) {
    earned.push('reliable-reporter')
  }
  if (count(stats.upVotesReceived) >= 50) earned.push('helpful-voice')

  const positive = count(stats.tripRatingsPositive)
  const totalRatings = positive + count(stats.tripRatingsNegative)
  if (totalRatings >= 10 && positive / totalRatings >= 0.9) earned.push('safe-companion')

  if (count(stats.accountAgeDays) >= 365) earned.push('veteran')

  return earned.map((id) => BADGES[id])
}

export function getTrustSummary(stats: UserStats): TrustSummary {
  const score = computeTrustScore(stats)
  const nextTier = getNextTier(score)
  return {
    score,
    tier: getTrustTier(score),
    nextTier,
    pointsToNextTier: nextTier ? nextTier.min - score : 0,
    breakdown: getTrustBreakdown(stats),
    badges: getBadges(stats)
  }
}
