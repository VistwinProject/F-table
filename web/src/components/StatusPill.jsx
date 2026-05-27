const STATE_MAP = {
  active:  { dot: 'signal', label: '運作中' },
  idle:    { dot: 'idle',   label: '待機' },
  warning: { dot: 'amber',  label: '警告' },
  error:   { dot: 'red',    label: '錯誤' },
}

export default function StatusPill({ state = 'idle', label, className = '' }) {
  const { dot, label: defaultLabel } = STATE_MAP[state] ?? STATE_MAP.idle
  return (
    <span className={`status-pill status-pill--${state} ${className}`}>
      <span className={`status-pill__dot status-pill__dot--${dot}`} />
      <span className="status-pill__label">{label ?? defaultLabel}</span>
    </span>
  )
}
