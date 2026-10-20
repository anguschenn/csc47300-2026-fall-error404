import { REPORT_CATEGORIES, REPORT_CATEGORY_INFO, type ReportCategory } from '../../types/report'

export type CategoryFilter = ReportCategory | 'all'

interface ReportFiltersProps {
  category: CategoryFilter
  line: string
  lines: string[]
  onCategoryChange: (category: CategoryFilter) => void
  onLineChange: (line: string) => void
}

export function ReportFilters({ category, line, lines, onCategoryChange, onLineChange }: ReportFiltersProps) {
  return (
    <div className="rp-filters">
      <div className="rp-chips" role="group" aria-label="Filter by category">
        <button
          type="button"
          className={category === 'all' ? 'active' : ''}
          aria-pressed={category === 'all'}
          onClick={() => onCategoryChange('all')}
        >
          All
        </button>
        {REPORT_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={category === c ? 'active' : ''}
            aria-pressed={category === c}
            onClick={() => onCategoryChange(c)}
          >
            <span aria-hidden="true">{REPORT_CATEGORY_INFO[c].icon}</span> {REPORT_CATEGORY_INFO[c].label}
          </button>
        ))}
      </div>

      <label className="rp-line-filter">
        Line
        <select value={line} onChange={(e) => onLineChange(e.target.value)}>
          <option value="">All lines</option>
          {lines.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
