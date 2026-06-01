/* Centre AI hub — adapted from the wall's f-wall/src/components/Hub.jsx.
   SVG-based: concentric rings + 72 radial tick marks (rotating slowly) +
   counter-rotating dashed arc + static inner ring + radial-gradient glow orb
   + bright centre spot. Colour matches the SYNC-SPEC accent (#009393). */

const ACCENT    = '#009393'  // main teal
const ACCENT2   = '#4dbaba'  // accent-2
const ACTIVE    = '#00dcdc'  // bright cyan
const HIGHLIGHT = '#dcffff'  // near-white core

const R  = 116  // outer ring radius (viewBox units)
const CX = 120
const CY = 120

// 72 radial ticks (every 5°). Every 6th is a long tick (every 30°).
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a    = (i / 72) * Math.PI * 2
  const long = i % 6 === 0
  const r2   = R - (long ? 13 : 6)
  return {
    x1: Math.cos(a) * R,
    y1: Math.sin(a) * R,
    x2: Math.cos(a) * r2,
    y2: Math.sin(a) * r2,
    long,
  }
})

export default function CenterHub({ wsStatus, activeCount }) {
  const isActive       = activeCount > 0
  const isDisconnected = wsStatus === 'disconnected'

  const cls = [
    'center-hub',
    isActive       && 'center-hub--active',
    isDisconnected && 'center-hub--disconnected',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <svg className="center-hub__svg" viewBox="0 0 240 240">
        <defs>
          <filter id="hub-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Core glowing orb gradient: white centre → cyan → fade to accent */}
          <radialGradient id="hub-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={HIGHLIGHT} stopOpacity="1" />
            <stop offset="22%"  stopColor={ACTIVE}    stopOpacity="0.9" />
            <stop offset="60%"  stopColor={ACCENT}    stopOpacity="0.45" />
            <stop offset="100%" stopColor={ACCENT}    stopOpacity="0" />
          </radialGradient>

          {/* Wide ambient halo behind the whole hub */}
          <radialGradient id="hub-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={ACCENT} stopOpacity="0.22" />
            <stop offset="55%"  stopColor={ACCENT} stopOpacity="0.06" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background aura — wide soft cyan glow */}
        <circle cx={CX} cy={CY} r="280" fill="url(#hub-aura)" />

        {/* Outer ring + radial tick marks (slow clockwise rotation) */}
        <g opacity="0.55" filter="url(#hub-glow)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${CX} ${CY}`}
            to={`360 ${CX} ${CY}`}
            dur="60s"
            repeatCount="indefinite"
          />
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={ACCENT2} strokeWidth="1" opacity="0.5" />
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={CX + t.x1}
              y1={CY + t.y1}
              x2={CX + t.x2}
              y2={CY + t.y2}
              stroke={t.long ? ACTIVE : ACCENT2}
              strokeWidth={t.long ? 1.6 : 1}
            />
          ))}
        </g>

        {/* Middle dashed arc — counter-rotating */}
        <g filter="url(#hub-glow)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`360 ${CX} ${CY}`}
            to={`0 ${CX} ${CY}`}
            dur="50s"
            repeatCount="indefinite"
          />
          <circle
            cx={CX} cy={CY} r={R - 26}
            fill="none"
            stroke={ACTIVE}
            strokeWidth="2"
            strokeDasharray="40 26"
            opacity="0.55"
          />
        </g>

        {/* Inner static thin ring */}
        <circle cx={CX} cy={CY} r={R - 46} fill="none" stroke={ACCENT2} strokeWidth="1" opacity="0.45" />

        {/* Central glow orb (the bright cyan-white sun) — gently breathing when active */}
        <circle
          cx={CX} cy={CY} r={R - 34}
          fill="url(#hub-core-glow)"
          filter="url(#hub-glow)"
          opacity={isActive ? 0.95 : 0.70}
        >
          {isActive && (
            <animate attributeName="opacity" values="0.82;1;0.82" dur="1.6s" repeatCount="indefinite" />
          )}
        </circle>

        {/* Bright centre spot */}
        <circle
          cx={CX} cy={CY} r="15"
          fill={HIGHLIGHT}
          filter="url(#hub-glow)"
          opacity={isActive ? 1 : 0.88}
        />
      </svg>

      <div className="hub-label">System Core</div>
    </div>
  )
}
