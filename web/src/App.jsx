import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import InfoPanel from './components/InfoPanel.jsx'
import CenterHub from './components/CenterHub.jsx'
import NfcSlot from './components/NfcSlot.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import StudioHeader from './components/StudioHeader.jsx'
import WelcomeScreen from './components/WelcomeScreen.jsx'
import GlowLayer from './glow/GlowLayer.jsx'
import { circlePoints } from './glow/ribbon.js'
import { attachSimKeys } from './shared/simKeys.js'

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
    // ?sim：鍵盤 1–9 送給 server，由它廣播真的 tag-present → 三端一起亮。
    const detachSim = attachSimKeys(() => wsRef.current)
    return () => { detachSim(); clearTimeout(timerRef.current); wsRef.current?.close() }
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

  // ── 發光層 ────────────────────────────────────────────────────────────────
  const hubRef = useRef(null)

  // 哪些東西要亮：有卡的 slot（連線 + 圓環）＋ 有任何一張卡時的中樞環。
  // ⚠ 用 useMemo 並且只依賴「亮起來的 slot 清單」，不要每次 render 都給新的 Set ——
  //    GlowLayer 是拿它當 ref 讀，但重建成本白花。
  const activeKey = slotStates.map(s => (s.activeCard ? 1 : 0)).join('')
  const glowActive = useMemo(() => {
    const ids = new Set()
    slotStates.forEach((s, i) => { if (s.activeCard) { ids.add(`beam-${i}`); ids.add(`ring-${i}`) } })
    if (slotStates.some(s => s.activeCard)) ids.add('core')
    return ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  // 幾何。⚠ 這裡的 % → 世界座標換算必須與 ConnectionLines / .nfc-slot / .center-hub
  //    的 CSS 定位用同一組數字（slotPos、HUB_X/Y、86px、280px），否則光會偏掉。
  const buildGlow = useCallback((world, px) => {
    const toW = (xPct, yPct) => ({ x: (xPct / 100) * world.w, y: (yPct / 100) * world.h })
    const s = world.w / (px.width || world.w)   // CSS px → 世界單位
    const hub = toW(HUB_X, HUB_Y)

    const beams = []
    const lines = []
    SLOTS.forEach((slot) => {
      const pos = slotPos(slot.slotIndex, SLOTS.length)
      const sp = toW(pos.x, pos.y)
      const dx = sp.x - hub.x
      const dy = sp.y - hub.y
      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist
      // 端點讓開中樞與圓環，跟 ConnectionLines 的 HUB_CLEAR_PX / SLOT_CLEAR_PX 同一組值。
      const h = { x: hub.x + HUB_CLEAR_PX * s * ux, y: hub.y + HUB_CLEAR_PX * s * uy }
      const e = { x: sp.x - SLOT_CLEAR_PX * s * ux, y: sp.y - SLOT_CLEAR_PX * s * uy }
      // ⚠ 順序＝流動方向：卡片 → 中樞，與牆面的走線同向（資料流進 AI 大腦）。
      beams.push({ id: `beam-${slot.slotIndex}`, pts: [e, h] })
      lines.push({ id: `ring-${slot.slotIndex}`, pts: circlePoints(sp.x, sp.y, 43 * s), closed: true })
    })
    // 中樞環：CenterHub 的 SVG 是 viewBox 240 裡半徑 116，元素本身 280px → 半徑 135.3px。
    lines.push({ id: 'core', pts: circlePoints(hub.x, hub.y, (280 / 2) * (116 / 120) * s), closed: true })
    return { lines, beams }
  }, [])

  return (
    <div className="app-frame">
      <StudioHeader theme={theme} onThemeToggle={handleThemeToggle} />

      <div className="app-body">
        {/* InfoPanel 只用這兩個 prop（見其 signature）。 */}
        <InfoPanel wsStatus={wsStatus} focusedState={focusedState} />

        <main className="main">
          <div className="hub-container" ref={hubRef}>
            {/* 發光層：牆面那套 WebGL + UnrealBloomPass，畫連線的光與彗星、
                slot 圓環與中樞環的外圈。⚠ 疊在最底層，銳利的東西（+ 號、標籤、
                毛玻璃面板）全部在它之上 —— 與牆面同一個分層原則。 */}
            <GlowLayer
              containerRef={hubRef}
              build={buildGlow}
              activeIds={glowActive}
              className="glow-layer"
            />
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
        return (
          <g key={slot.id}>
            {/* ⚠ 現在這裡【只畫沒感應時的那條細灰線】。
                有卡的時候「光」全部由發光層（WebGL + bloom）畫 —— 亮芯、光暈、
                彗星拖尾、底光呼吸都在 glow/ 裡，與牆面同一組 shader。
                這條 SVG 線在 active 時仍留著但幾乎看不見（被上面的光蓋掉），
                保留它是為了 WebGL 起不來時仍有連線可看（見 GlowLayer 的 catch）。 */}
            <line
              x1={hx} y1={hy} x2={sx} y2={sy}
              className={`beam-halo${isActive ? ' beam-halo--active' : ''}`}
            />
          </g>
        )
      })}
    </svg>
  )
}
