export default function SegmentedToggle({ options = [], value, onChange, className = '' }) {
  return (
    <div className={`seg-toggle ${className}`} role="tablist">
      {options.map(opt => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          className={`seg-toggle__tab${opt.value === value ? ' seg-toggle__tab--active' : ''}`}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
