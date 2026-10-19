import { LINE_COLORS } from '../lib/mta'

export function TrainLineBullet({ line }: { line: string }) {
  const color = LINE_COLORS[line] || '#808183'
  const textColor = ['N', 'Q', 'R', 'W'].includes(line) ? '#000' : '#fff'
  return (
    <svg className="sc-train-bullet" viewBox="0 0 48 48" role="img" aria-label={`${line} train`}>
      <title>{line} train</title>
      <circle cx="24" cy="24" r="23" fill={color} />
      <text x="24" y="25" dy=".33em" textAnchor="middle" fill={textColor} fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize={line.length === 1 ? 33 : 19}>{line}</text>
    </svg>
  )
}
