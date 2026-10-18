export interface UserStats {
  accountAgeDays: number
  // Incident feed activity
  reportsSubmitted: number
  upVotesReceived: number
  reportsFlagged: number
  // SafeCommute post-trip feedback
  tripRatingsPositive: number
  tripRatingsNegative: number
  // Block & report tool results that moderation upheld against this user
  upheldSafetyReports: number
  // Optional identity verification
  phoneVerified: boolean
  schoolOrWorkEmailVerified: boolean
  idVerified: boolean
}

export const TRUST_TIER_IDS = ['new', 'regular', 'trusted', 'pillar'] as const

export type TrustTierId = (typeof TRUST_TIER_IDS)[number]

export interface TrustTier {
  id: TrustTierId
  label: string
  min: number
  color: string
}

export const BADGE_IDS = [
  'phone-verified',
  'email-verified',
  'id-verified',
  'first-report',
  'reliable-reporter',
  'helpful-voice',
  'safe-companion',
  'veteran',
] as const

export type BadgeId = (typeof BADGE_IDS)[number]

export interface Badge {
  id: BadgeId
  label: string
  description: string
  icon: string
}

export interface TrustBreakdown {
  verification: number
  tripRatings: number
  reporting: number
  accountAge: number
  penalties: number
}

export interface TrustSummary {
  score: number
  tier: TrustTier
  nextTier: TrustTier | null
  pointsToNextTier: number
  breakdown: TrustBreakdown
  badges: Badge[]
}
