import type { Report, ReportAuthor, ReportCreate } from '../types/report'

// Mock data until the backend has a reports endpoint.
// Reports are kept in localStorage so posts and upvotes survive a page reload.
// TODO: replace with /api/v1/reports calls (Fetch pattern in commuteService.ts).

const STORAGE_KEY = 'metropulse.mockReports.v1'
const MOCK_LATENCY_MS = 250

type StoredReport = Omit<Report, 'upvotes' | 'upvoted'> & { upvoter_ids: string[] }

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const mockUpvoters = (count: number) => Array.from({ length: count }, (_, i) => `mock-user-${i}`)

function seedReports(): StoredReport[] {
  return [
    {
      id: 'seed-1',
      station_id: '127',
      station_name: 'Times Sq-42 St',
      line: '1',
      category: 'delay',
      severity: 'medium',
      description: 'Uptown 1 trains holding at the platform for 10+ minutes, conductor says signal problems.',
      author_id: 'mock-user-a',
      author_name: 'Maria',
      author_trust_tier: 'trusted',
      upvoter_ids: mockUpvoters(14),
      created_at: minutesAgo(8),
    },
    {
      id: 'seed-2',
      station_id: '635',
      station_name: '14 St-Union Sq',
      line: '6',
      category: 'accessibility',
      severity: 'high',
      description: 'Elevator to the downtown 4/5/6 platform is out of service. Use the 16 St entrance.',
      author_id: 'mock-user-b',
      author_name: 'Devon',
      author_trust_tier: 'pillar',
      upvoter_ids: mockUpvoters(31),
      created_at: minutesAgo(42),
    },
    {
      id: 'seed-3',
      station_id: 'R31',
      station_name: 'Atlantic Av-Barclays Ctr',
      line: 'R',
      category: 'crowding',
      severity: 'medium',
      description: 'Platform packed after the game let out, expect to wait for 2-3 trains.',
      author_id: 'mock-user-c',
      author_name: 'Sam',
      author_trust_tier: 'regular',
      upvoter_ids: mockUpvoters(6),
      created_at: minutesAgo(95),
    },
    {
      id: 'seed-4',
      station_id: 'G14',
      station_name: 'Jackson Hts-Roosevelt Av',
      line: 'E',
      category: 'safety',
      severity: 'high',
      description: 'Person acting erratically on the Manhattan-bound E platform. Station agent notified.',
      author_id: 'mock-user-d',
      author_name: 'Priya',
      author_trust_tier: 'trusted',
      upvoter_ids: mockUpvoters(9),
      created_at: minutesAgo(130),
    },
    {
      id: 'seed-5',
      station_id: 'A15',
      station_name: '125 St',
      line: 'A',
      category: 'cleanliness',
      severity: 'low',
      description: 'Spill near the downtown A/C stairs, mind your step.',
      author_id: 'mock-user-e',
      author_name: 'Leo',
      author_trust_tier: 'new',
      upvoter_ids: mockUpvoters(1),
      created_at: minutesAgo(300),
    },
  ]
}

function load(): StoredReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StoredReport[]
  } catch {
    // Fall through to seed data if storage is unavailable or corrupted
  }
  const seeded = seedReports()
  save(seeded)
  return seeded
}

function save(reports: StoredReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
  } catch {
    // Storage unavailable (e.g. private mode): changes only last until reload
  }
}

function toReport(stored: StoredReport, viewerId?: string): Report {
  const { upvoter_ids, ...rest } = stored
  return {
    ...rest,
    upvotes: upvoter_ids.length,
    upvoted: viewerId ? upvoter_ids.includes(viewerId) : false,
  }
}

const delay = () => new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))

export const reportsService = {
  // Newest first. viewerId marks which reports the signed-in user has upvoted.
  list: async (viewerId?: string): Promise<Report[]> => {
    await delay()
    return load()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((r) => toReport(r, viewerId))
  },

  create: async (token: string, input: ReportCreate, author: ReportAuthor): Promise<Report> => {
    void token
    await delay()
    const description = input.description.trim()
    if (!description) throw new Error('Please describe what is happening.')

    const stored: StoredReport = {
      ...input,
      description,
      id: crypto.randomUUID(),
      author_id: author.id,
      author_name: author.name,
      author_trust_tier: author.trust_tier,
      upvoter_ids: [],
      created_at: new Date().toISOString(),
    }
    save([stored, ...load()])
    return toReport(stored, author.id)
  },

  toggleUpvote: async (token: string, reportId: string, userId: string): Promise<Report> => {
    void token
    await delay()
    const reports = load()
    const target = reports.find((r) => r.id === reportId)
    if (!target) throw new Error('That report no longer exists.')
    if (target.author_id === userId) throw new Error('You cannot upvote your own report.')

    target.upvoter_ids = target.upvoter_ids.includes(userId)
      ? target.upvoter_ids.filter((id) => id !== userId)
      : [...target.upvoter_ids, userId]
    save(reports)
    return toReport(target, userId)
  },

  // Dev helper: restore the seed reports.
  resetMock: () => save(seedReports()),
}
