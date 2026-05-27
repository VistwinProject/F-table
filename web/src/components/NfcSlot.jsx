export default function NfcSlot({ slot, angle, radius = 38, connected, active, focused, onClick }) {
  const rad = (angle * Math.PI) / 180
  const x   = 50 + radius * Math.cos(rad)
  const y   = 50 + radius * Math.sin(rad)

  const cls = [
    'nfc-slot',
    connected && 'connected',
    active    && 'active',
    focused   && 'focused',
  ].filter(Boolean).join(' ')

  const idx = String(slot.slotIndex + 1).padStart(2, '0')

  return (
    <div
      className={cls}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={onClick}
      title={`${slot.label}${connected ? '' : ' (未連線)'}`}
    >
      <div className="slot-outer">
        <div className="slot-inner">
          <span className="slot-plus">+</span>
          <span className="slot-index-small">{idx}</span>
        </div>
      </div>
      <div className="slot-label">{slot.label}</div>
    </div>
  )
}
