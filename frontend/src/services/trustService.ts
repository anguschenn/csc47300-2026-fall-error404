import type { UserStats } from '../types/trust'
import { EMPTY_STATS } from '../lib/trust'

// Mock data until the backend has a stats endpoint.
// Change ACTIVE_PRESET to preview the profile at different trust tiers.
const MOCK_PRESETS = {
  newUser: { ...EMPTY_STATS, accountAgeDays: 3 },
  regular: {
    ...EMPTY_STATS,
    accountAgeDays: 45,
    reportsSubmitted: 6,
    upVotesReceived: 12,
    tripRatingsPositive: 4,
    tripRatingsNegative: 1,
    schoolOrWorkEmailVerified: true
  },
  pillar: {
    ...EMPTY_STATS,
    accountAgeDays: 400,
    reportsSubmitted: 24,
    upVotesReceived: 80,
    reportsFlagged: 1,
    tripRatingsPositive: 18,
    tripRatingsNegative: 1,
    phoneVerified: true,
    schoolOrWorkEmailVerified: true,
    idVerified: true
  }
} satisfies Record<string, UserStats>

const ACTIVE_PRESET: keyof typeof MOCK_PRESETS = 'regular'

const MOCK_LATENCY_MS = 300

// TODO: replace with GET /api/v1/users/{userId}/stats once the backend exists.
export async function getUserStats(userId: string): Promise<UserStats> {
  void userId
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return { ...MOCK_PRESETS[ACTIVE_PRESET] }
}
