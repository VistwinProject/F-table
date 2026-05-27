export default function HudCorner({ size = 8, thickness = 1.5, color = 'var(--c-signal)', className = '' }) {
  const s = `${size}px`
  const t = `${thickness}px`
  const corners = ['tl', 'tr', 'bl', 'br']
  return (
    <div className={`hud-corner-wrap ${className}`} aria-hidden>
      {corners.map(c => (
        <span
          key={c}
          className={`hud-corner hud-corner--${c}`}
          style={{
            '--hc-size': s,
            '--hc-t':    t,
            '--hc-c':    color,
          }}
        />
      ))}
    </div>
  )
}
