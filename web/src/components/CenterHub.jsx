export default function CenterHub({ wsStatus, activeCount }) {
  const isActive       = activeCount > 0
  const isDisconnected = wsStatus === 'disconnected'

  const squareCls = [
    'hub-square',
    isActive       ? 'active'       : '',
    isDisconnected ? 'disconnected'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="center-hub">
      <div className="hub-rings-wrap">
        <div className="hub-ring hub-ring-1" />
        <div className="hub-ring hub-ring-2" />

        <div className={squareCls}>
          {/* NFC N-symbol */}
          <svg
            className="hub-nfc-icon"
            width="30"
            height="30"
            viewBox="0 0 30 30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 24 L7 6 L23 24 L23 6" />
            <path d="M23 11 Q27 15 23 19" strokeWidth="1.5" opacity="0.5" />
            <path d="M25 8 Q32 15 25 22" strokeWidth="1.2" opacity="0.3" />
          </svg>

          <div className={`hub-dot${isActive ? ' active' : ''}`} />
        </div>
      </div>

      <div className="hub-label">System Core</div>
    </div>
  )
}
