export default function DemoPill({ label = 'DEMO', className = '' }) {
  return (
    <span className={`demo-pill ${className}`}>{label}</span>
  )
}
