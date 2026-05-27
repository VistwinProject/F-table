import { useRef, useCallback } from 'react'

export default function GlassCard({
  children,
  className = '',
  accent = false,
  interactive = false,
  breathe = false,
  drag = false,
  onClick,
  style,
  ...props
}) {
  const ref = useRef(null)

  const handleMouseMove = useCallback((e) => {
    if (!interactive && !drag) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    ref.current.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    ref.current.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }, [interactive, drag])

  const cls = [
    'glass-card',
    accent      && 'glass-card--accent',
    interactive && 'glass-card--interactive',
    breathe     && 'glass-card--breathe',
    drag        && 'glass-card--drag',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={ref}
      className={cls}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}
