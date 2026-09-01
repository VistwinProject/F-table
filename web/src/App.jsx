import { useState, useEffect, useRef, useCallback } from 'react'
import InfoPanel from './components/InfoPanel.jsx'
import CenterHub from './components/CenterHub.jsx'
import NfcSlot from './components/NfcSlot.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import StudioHeader from './components/StudioHeader.jsx'
import GaussianViewer from './components/GaussianViewer.jsx'
import WelcomeScreen from './components/WelcomeScreen.jsx'

const WS_URL       = 'ws://localhost:8787'
const RECONNECT_MS = 3000

// ── Orbit geometry (viewBox % units) ─────────────────────────────────────────
// Slots sit along the TOP half of a wide, flattened ellipse (a shallow dome).
// The core sits below the ellipse center, so beams fan up-and-out to each slot.
const ELLIPSE_CX = 50   // ellipse center x
const ELLIPSE_CY = 70   // ellipse center y (= the side-slot baseline)
const ORBIT_RX   = 43   // horizontal radius (wide)
const ORBIT_RY   = 48   // vertical radius (rounded dome, not too flat)
const ARC_START  = 180  // leftmost angle (deg)
const ARC_SWEEP  = 180  // upper semicircle of the ellipse

// Core sits ON the arc's baseline (same y as the side nodes) so the fan from
// the core's point of view spans a TRUE 180° — NFC 01 ↔ core ↔ NFC 09 form a
// horizontal line, with the dome opening straight up above.
const HUB_X      = 50
const HUB_Y      = ELLIPSE_CY

// Per the design sketch, every other slot (1-indexed even = NFC 02/04/06/08) is
// pulled inward, creating a staggered two-ring fan. The 1-indexed odd slots —
// NFC 01/03/05/07/09 — stay on the outer ellipse, so NFC 01 and NFC 09 still sit
// at the horizontal extremes of the 180° fan.
const INSET_RATIO = 0.7

// Position of slot i (of n) along the upper elliptical arc.
export function slotPos(i, n) {
  const f      = n > 1 ? i / (n - 1) : 0.5
  const deg    = ARC_START + f * ARC_SWEEP
  const rad    = (deg * Math.PI) / 180
  // 0-indexed odd ↔ 1-indexed even → inset toward the core
  const k      = (i % 2 === 1) ? INSET_RATIO : 1
  return {
    x: ELLIPSE_CX + ORBIT_RX * k * Math.cos(rad),
    y: ELLIPSE_CY + ORBIT_RY * k * Math.sin(rad),
    deg,
    rad,
  }
}

export const SLOTS = [
  { slotIndex: 0, label: 'NFC 01', id: 'r0' },
  { slotIndex: 1, label: 'NFC 02', id: 'r1' },
  { slotIndex: 2, label: 'NFC 03', id: 'r2' },
  { slotIndex: 3, label: 'NFC 04', id: 'r3' },
  { slotIndex: 4, label: 'NFC 05', id: 'r4' },
  { slotIndex: 5, label: 'NFC 06', id: 'r5' },
  { slotIndex: 6, label: 'NFC 07', id: 'r6' },
  { slotIndex: 7, label: 'NFC 08', id: 'r7' },
  { slotIndex: 8, label: 'NFC 09', id: 'r8' },
]

const initSlotState = () => ({ connected: false, readerName: '', activeCard: null })

export default function App() {
  // 'welcome' = welcome overlay shown, 'live' = main app interactive.
  // The tablet operator triggers 'live' via a WS `session-start` broadcast.
  // welcomeExiting drives the 600 ms fade-out animation BEFORE we actually
  // unmount the welcome overlay, so the transition is smooth whether the
  // trigger came from a local click or a remote WS message.
  const [mode,              setMode]               = useState('welcome')
  const [welcomeExiting,    setWelcomeExiting]     = useState(false)
  const [wsStatus,          setWsStatus]          = useState('connecting')
  const [slotStates,        setSlotStates]         = useState(() => Array.from({ length: 9 }, initSlotState))
  const [focusedIdx,        setFocusedIdx]         = useState(null)
  const [theme,             setTheme]              = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )

  const wsRef    = useRef(null)
  const timerRef = useRef(null)

  const handleThemeToggle = useCallback((next) => {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch (_) {}
  }, [])

  const patchSlot = useCallback((index, patch) => {
    setSlotStates(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      clearTimeout(timerRef.current)
    }

    ws.onmessage = ({ data }) => {
      let msg
      try { msg = JSON.parse(data) } catch { return }
      const idx = msg.slot_index ?? null

      switch (msg.type) {
        case 'reader-connected':
          if (idx !== null) {
            patchSlot(idx, { connected: true, readerName: msg.reader })
          }
          break

        case 'reader-disconnected':
          if (idx !== null) {
            patchSlot(idx, { connected: false, readerName: '', activeCard: null })
          }
          break

        case 'tag-present':
          if (idx !== null) {
            patchSlot(idx, { activeCard: { uid: msg.uid, known: msg.known, data: msg.data } })
            setFocusedIdx(idx)
            setTotalInteractions(n => n + 1)
            // Pre-fetch model into browser cache so subsequent taps load instantly
            if (msg.data?.model) fetch(msg.data.model, { priority: 'low' }).catch(() => {})
          }
          break

        case 'tag-remove':
          if (idx !== null) {
            patchSlot(idx, { activeCard: null })
          }
          break

        // ── Session control (broadcast by operator tablet via server) ──
        case 'session-start':
          // Fade the welcome overlay out first, then drop it from the tree.
          // Matches the local-click animation so all displays look the same.
          setWelcomeExiting(true)
          setTimeout(() => {
            setMode('live')
            setWelcomeExiting(false)
          }, 600)
          break

        case 'session-end':
          setMode('welcome')
          setWelcomeExiting(false)
          break

        default: break
      }
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
      setSlotStates(Array.from({ length: 9 }, initSlotState))
      timerRef.current = setTimeout(connect, RECONNECT_MS)
    }

    ws.onerror = () => ws.close()
  }, [patchSlot])

  useEffect(() => {
    connect()
    return () => { clearTimeout(timerRef.current); wsRef.current?.close() }
  }, [connect])

  // ── InfoPanel focus rotation ────────────────────────────────────────────────
  // A new tag jumps focus to the newest card immediately (handled in
  // 'tag-present' above). After that, if more than one appliance is active, the
  // panel auto-rotates through all active appliances every 5 s. The effect
  // re-runs whenever slotStates or focusedIdx changes, so every new tap (and
  // every rotation tick) restarts the 5 s timer — the newest card always gets a
  // full interval before rotation continues. Also self-corrects focus to an
  // active slot if the focused card was removed.
  const ROTATE_MS = 8000  // 停留較久，老年觀眾看得從容
  useEffect(() => {
    const active = slotStates.flatMap((s, i) => (s.activeCard ? [i] : []))
    if (active.length === 0) return

    // Focus landed on a non-active slot (e.g. its card was removed) → snap to
    // the most recent active one; the effect re-runs after this update.
    if (focusedIdx === null || !slotStates[focusedIdx]?.activeCard) {
      setFocusedIdx(active[active.length - 1])
      return
    }

    if (active.length < 2) return  // single appliance → nothing to rotate

    const id = setInterval(() => {
      setFocusedIdx(prev => {
        const order = slotStates.flatMap((s, i) => (s.activeCard ? [i] : []))
        if (order.length === 0) return prev
        const cur = order.indexOf(prev)
        return order[(cur + 1) % order.length]
      })
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [slotStates, focusedIdx])

  const activeCount    = slotStates.filter(s => s.activeCard !== null).length
  const focusedState   = focusedIdx !== null ? slotStates[focusedIdx] : null

  return (
    <div className="app-frame">
      <StudioHeader theme={theme} onThemeToggle={handleThemeToggle} />

      <div className="app-body">
        {/* InfoPanel 只用這兩個 prop（見其 signature）。舊版還傳了
            focusedSlot / activeCount / connectedCount / activityLog /
            totalInteractions，全部沒有被解構，已一併移除。 */}
        <InfoPanel wsStatus={wsStatus} focusedState={focusedState} />

        <main className="main">
          <div className="hub-container">
            <ConnectionLines slots={SLOTS} slotStates={slotStates} />

            {SLOTS.map((slot) => {
              const pos   = slotPos(slot.slotIndex, SLOTS.length)
              const state = slotStates[slot.slotIndex]
              return (
                <NfcSlot
                  key={slot.id}
                  slot={slot}
                  x={pos.x}
                  y={pos.y}
                  connected={state.connected}
                  active={state.activeCard !== null}
                  focused={focusedIdx === slot.slotIndex}
                  onClick={() => setFocusedIdx(slot.slotIndex)}
                />
              )
            })}

            {/* Model overlays — rendered in hub-container so positioning is unaffected
                by the nfc-slot's translate(-50%,-50%) transform */}
            {SLOTS.map((slot) => {
              const state     = slotStates[slot.slotIndex]
              const modelPath = state.activeCard?.data?.model
              if (!modelPath) return null
              const pos = slotPos(slot.slotIndex, SLOTS.length)
              return (
                <div
                  key={`model-${slot.id}`}
                  className="slot-model-overlay"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <GaussianViewer key={state.activeCard.uid} modelPath={modelPath} />
                </div>
              )
            })}

            <CenterHub wsStatus={wsStatus} activeCount={activeCount} />
          </div>

          <ConnectionStatus wsStatus={wsStatus} />
        </main>
      </div>

      {/* Bottom frame label */}
      <div className="frame-footer">
        <div className="frame-footer__bar" />
        <div className="frame-footer__text">AI大腦控制塔</div>
      </div>

      {/* Welcome overlay — shown until the operator tablet sends a
          `session-start` broadcast. The local click is a dev fallback only
          (projection surfaces aren't touchable in production); when WS is
          connected it sends the same control message so all displays sync.
          Exit fade is driven by `welcomeExiting`, applied uniformly whether
          the trigger came from local click or remote WS broadcast. */}
      {mode === 'welcome' && (
        <WelcomeScreen
          exiting={welcomeExiting}
          onStart={() => {
            const ws = wsRef.current
            if (ws && ws.readyState === WebSocket.OPEN) {
              // The server broadcast will come back to us and the
              // session-start case above will drive the fade-out.
              ws.send(JSON.stringify({ type: 'session-start' }))
            } else {
              // No WS — do the same fade-then-mount-change locally.
              setWelcomeExiting(true)
              setTimeout(() => {
                setMode('live')
                setWelcomeExiting(false)
              }, 600)
            }
          }}
        />
      )}
    </div>
  )
}

// Clearances in PX — lines stop short of the hub orb and the slot ring.
// Hub SVG renders an outer ring at ~135px from centre (and a wider aura beyond);
// 150px keeps beams from cutting through the ring while staying close to it.
// Slot ring is 86px (43px half) + small visual gap.
const HUB_CLEAR_PX  = 150
const SLOT_CLEAR_PX = 50

/* ── SVG Connection Lines with animated transmission ──
   The SVG uses preserveAspectRatio="none" so viewBox 0–100 maps directly to
   container %, the same coord system used by the CSS-positioned slots and hub.
   Clearances are computed in px (via a measured container size) so the line
   endpoints stay outside the hub/slot regardless of container aspect ratio. */
function ConnectionLines({ slots, slotStates }) {
  const svgRef = useRef(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setDim({ w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = dim.w
  const H = dim.h

  // Wait for container measurement before drawing — otherwise positions and
  // px-based stroke widths render at a wrong scale on first frame.
  if (!W || !H) {
    return <svg ref={svgRef} className="connections" />
  }

  // % → px helpers (one shared coord system: container pixels)
  const toPx = (xPct, yPct) => ({
    x: (xPct / 100) * W,
    y: (yPct / 100) * H,
  })
  const hub = toPx(HUB_X, HUB_Y)

  return (
    <svg
      ref={svgRef}
      className="connections"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {slots.map((slot) => {
        const pos = slotPos(slot.slotIndex, slots.length)
        const sp  = toPx(pos.x, pos.y)

        // Direction (px) from hub center to slot center
        const dx   = sp.x - hub.x
        const dy   = sp.y - hub.y
        const dist = Math.hypot(dx, dy) || 1
        const ux   = dx / dist
        const uy   = dy / dist

        // Endpoints clear hub box and slot ring by px amounts (uniform in every direction)
        const hx = hub.x + HUB_CLEAR_PX  * ux
        const hy = hub.y + HUB_CLEAR_PX  * uy
        const sx = sp.x  - SLOT_CLEAR_PX * ux
        const sy = sp.y  - SLOT_CLEAR_PX * uy

        const state    = slotStates[slot.slotIndex]
        const isActive = state.activeCard !== null
        // 連線只有兩種樣子：active 與其他。「讀卡機在線但沒卡」是由 NfcSlot 的
        // 圓環轉實線表示，不由連線表示 —— 所以那種狀態的線跟沒讀卡機時一樣安靜。
        const stateSuffix = isActive ? '--active' : ''

        return (
          <g key={slot.id}>
            {/* 連線本體：idle 極細灰線 → active 白高光（樣式全在 CSS 的 .beam-halo）。
                舊版的高斯模糊光暈與三段掃描光已移除。 */}
            <line
              x1={hx} y1={hy} x2={sx} y2={sy}
              className={`beam-halo${stateSuffix && ' beam-halo' + stateSuffix}`}
            />
            {/* core 疊層保留掛點但目前 CSS 設為透明，之後要做雙層線不用再動這裡的幾何 */}
            <line
              x1={hx} y1={hy} x2={sx} y2={sy}
              className={`beam-core${stateSuffix && ' beam-core' + stateSuffix}`}
            />
          </g>
        )
      })}
    </svg>
  )
}
