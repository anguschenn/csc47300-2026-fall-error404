import { useState, type SubmitEvent } from 'react'
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_INFO,
  REPORT_DESCRIPTION_MAX,
  REPORT_SEVERITIES,
  type ReportCategory,
  type ReportCreate,
  type ReportSeverity,
} from '../../types/report'
import type { Station } from '../../types/station'

interface ReportFormProps {
  stations: Station[]
  lines: string[]
  onSubmit: (input: ReportCreate) => Promise<void>
}

const stationLabel = (s: Station) => (s.lines.length ? `${s.name} (${s.lines.join(', ')})` : s.name)

export function ReportForm({ stations, lines, onSubmit }: ReportFormProps) {
  const [line, setLine] = useState('')
  const [stationId, setStationId] = useState('')
  const [category, setCategory] = useState<ReportCategory | ''>('')
  const [severity, setSeverity] = useState<ReportSeverity>('medium')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Picking a line narrows the station list; no line means a station-wide report
  const stationOptions = stations
    .filter((s) => !line || s.lines.includes(line))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

  function chooseLine(value: string) {
    setLine(value)
    setStationId('')
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const station = stations.find((s) => s.id === stationId)
    if (!station) return setError('Choose the station this is happening at.')
    if (!category) return setError('Choose what kind of issue this is.')
    if (!description.trim()) return setError('Describe what is happening.')

    setSubmitting(true)
    try {
      await onSubmit({
        station_id: station.id,
        station_name: station.name,
        line: line || null,
        category,
        severity,
        description: description.trim(),
      })
      setLine('')
      setStationId('')
      setCategory('')
      setSeverity('medium')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="rp-form" onSubmit={handleSubmit}>
      <label htmlFor="rp-line">Line</label>
      <select id="rp-line" value={line} onChange={(e) => chooseLine(e.target.value)}>
        <option value="">Station-wide / not sure</option>
        {lines.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      <label htmlFor="rp-station">Station</label>
      <select
        id="rp-station"
        value={stationId}
        onChange={(e) => setStationId(e.target.value)}
        disabled={!stations.length}
      >
        <option value="">{stations.length ? '-- Choose a station --' : 'Loading stations...'}</option>
        {stationOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {stationLabel(s)}
          </option>
        ))}
      </select>

      <label htmlFor="rp-category">Category</label>
      <select
        id="rp-category"
        value={category}
        onChange={(e) => setCategory(e.target.value as ReportCategory)}
      >
        <option value="">-- Choose a category --</option>
        {REPORT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {REPORT_CATEGORY_INFO[c].icon} {REPORT_CATEGORY_INFO[c].label}
          </option>
        ))}
      </select>

      <fieldset className="rp-severity-picker">
        <legend>Severity</legend>
        {REPORT_SEVERITIES.map((s) => (
          <label key={s} className={severity === s ? 'active' : ''}>
            <input
              type="radio"
              name="rp-severity"
              value={s}
              checked={severity === s}
              onChange={() => setSeverity(s)}
            />
            {s}
          </label>
        ))}
      </fieldset>

      <label htmlFor="rp-description">What's happening?</label>
      <textarea
        id="rp-description"
        rows={4}
        maxLength={REPORT_DESCRIPTION_MAX}
        placeholder="e.g. Downtown elevator out of service, use the north entrance."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <small className="rp-char-count">
        {description.length}/{REPORT_DESCRIPTION_MAX}
      </small>

      {error && <p className="rp-error" role="alert">{error}</p>}

      <button type="submit" className="rp-primary" disabled={submitting}>
        {submitting ? 'Posting...' : 'Post report'}
      </button>
    </form>
  )
}
