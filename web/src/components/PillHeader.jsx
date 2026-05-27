export default function PillHeader({ label, right, className = '' }) {
  return (
    <div className={`pill-header ${className}`}>
      <span className="pill-header__label">{label}</span>
      {right && <span className="pill-header__right">{right}</span>}
    </div>
  )
}
