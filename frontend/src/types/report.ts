import type { TrustTierId } from './trust'

export const REPORT_CATEGORIES = [
  'delay',
  'safety',
  'crowding',
  'cleanliness',
  'accessibility',
  'other',
] as const

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

// Mapping of report categories to their display labels and icons
export const REPORT_CATEGORY_INFO: Record<ReportCategory, { label: string; icon: string }> = {
  delay: { label: 'Delay', icon: '⏱️' },
  safety: { label: 'Safety', icon: '🚨' },
  crowding: { label: 'Crowding', icon: '👥' },
  cleanliness: { label: 'Cleanliness', icon: '🧹' },
  accessibility: { label: 'Elevator / Accessibility', icon: '♿' },
  other: { label: 'Other', icon: '💬' },
}


export const REPORT_SEVERITIES = ['low', 'medium', 'high'] as const

export type ReportSeverity = (typeof REPORT_SEVERITIES)[number]

export const REPORT_DESCRIPTION_MAX = 280

// Report data structure returned from the API
export interface Report {
  id: string
  station_id: string
  station_name: string
  line: string | null
  category: ReportCategory
  severity: ReportSeverity
  description: string
  author_id: string
  author_name: string
  author_trust_tier: TrustTierId
  upvotes: number
  // Whether the current viewer has upvoted this report
  upvoted: boolean
  created_at: string
}

// Report data structure used when creating a new report
export interface ReportCreate {
  station_id: string
  station_name: string
  line: string | null
  category: ReportCategory
  severity: ReportSeverity
  description: string
}

export interface ReportAuthor {
  id: string
  name: string
  trust_tier: TrustTierId
}
