export default function PhaseBadge({ phase = 'ALPHA', version, className = '' }) {
  return (
    <span className={`phase-badge ${className}`}>
      <span className="phase-badge__phase">{phase}</span>
      {version && <span className="phase-badge__version">{version}</span>}
    </span>
  )
}
