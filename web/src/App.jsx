import { useState, useEffect, useRef, useCallback } from 'react'
import InfoPanel from './components/InfoPanel.jsx'
import CenterHub from './components/CenterHub.jsx'
import NfcSlot from './components/NfcSlot.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import StudioHeader from './components/StudioHeader.jsx'
import GaussianViewer from './components/GaussianViewer.jsx'

const WS_URL       = 'ws://localhost:8787'
const RECONNECT_MS = 3000
const SLOT_RADIUS  = 38

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

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function App() {
  const [wsStatus,          setWsStatus]          = useState('connecting')
  const [slotStates,        setSlotStates]         = useState(() => Array.from({ length: 9 }, initSlotState))
  const [focusedIdx,        setFocusedIdx]         = useState(null)
  const [theme,             setTheme]              = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )
  const [activityLog,       setActivityLog]        = useState([])
  const [totalInteractions, setTotalInteractions]  = useState(0)

  const wsRef    = useRef(null)
  const timerRef = useRef(null)

  const handleThemeToggle = useCallback((next) => {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch (_) {}
  }, [])

  const addLog = useCallback((action, slotIdx) => {
    const node = `NFC ${String(slotIdx + 1).padStart(2, '0')}`
    setActivityLog(prev => [{ id: Date.now() + Math.random(), time: nowTime(), node, action }, ...prev].slice(0, 7))
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
            addLog('Connected', idx)
          }
          break

        case 'reader-disconnected':
          if (idx !== null) {
            patchSlot(idx, { connected: false, readerName: '', activeCard: null })
            addLog('Disconnected', idx)
          }
          break

        case 'tag-present':
          if (idx !== null) {
            patchSlot(idx, { activeCard: { uid: msg.uid, known: msg.known, data: msg.data } })
            setFocusedIdx(idx)
            addLog('Activated', idx)
            setTotalInteractions(n => n + 1)
            // Pre-fetch model into browser cache so subsequent taps load instantly
            if (msg.data?.model) fetch(msg.data.model, { priority: 'low' }).catch(() => {})
          }
          break

        case 'tag-remove':
          if (idx !== null) {
            patchSlot(idx, { activeCard: null })
            addLog('Removed', idx)
          }
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
  }, [patchSlot, addLog])

  useEffect(() => {
    connect()
    return () => { clearTimeout(timerRef.current); wsRef.current?.close() }
  }, [connect])

  const activeCount    = slotStates.filter(s => s.activeCard !== null).length
  const connectedCount = slotStates.filter(s => s.connected).length
  const focusedState   = focusedIdx !== null ? slotStates[focusedIdx] : null
  const focusedSlot    = focusedIdx !== null ? SLOTS[focusedIdx] : null

  return (
    <div className="app-frame">
      <StudioHeader theme={theme} onThemeToggle={handleThemeToggle} />

      <div className="app-body">
        <InfoPanel
          wsStatus={wsStatus}
          focusedSlot={focusedSlot}
          focusedState={focusedState}
          activeCount={activeCount}
          connectedCount={connectedCount}
          activityLog={activityLog}
          totalInteractions={totalInteractions}
        />

        <main className="main">
          <div className="hub-container">
            <ConnectionLines slots={SLOTS} slotStates={slotStates} />

            {SLOTS.map((slot) => {
              const angle = (slot.slotIndex * 360 / SLOTS.length) - 90
              const state = slotStates[slot.slotIndex]
              return (
                <NfcSlot
                  key={slot.id}
                  slot={slot}
                  angle={angle}
                  radius={SLOT_RADIUS}
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
              const angle = (slot.slotIndex * 360 / SLOTS.length) - 90
              const rad   = (angle * Math.PI) / 180
              const x     = 50 + SLOT_RADIUS * Math.cos(rad)
              const y     = 50 + SLOT_RADIUS * Math.sin(rad)
              return (
                <div
                  key={`model-${slot.id}`}
                  className="slot-model-overlay"
                  style={{ left: `${x}%`, top: `${y}%` }}
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
    </div>
  )
}

// Clearances in SVG viewBox units (container ≈ 555px, 1 VB ≈ 5.55px)
// Small values so lines feel long — elements are wireframe so slight overlap is fine
const HUB_EDGE  = 4.5   // line starts inside hub square (hub is transparent wireframe)
const SLOT_EDGE = 3.5   // line ends just inside slot outer ring

/* ── SVG Connection Lines with animated transmission ── */
function ConnectionLines({ slots, slotStates }) {
  return (
    <svg className="connections" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="pkt-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {slots.map((slot) => {
        const angle = (slot.slotIndex * 360 / slots.length) - 90
        const rad   = (angle * Math.PI) / 180
        const cos   = Math.cos(rad)
        const sin   = Math.sin(rad)

        const hx = 50 + HUB_EDGE * cos
        const hy = 50 + HUB_EDGE * sin
        const sx = 50 + (SLOT_RADIUS - SLOT_EDGE) * cos
        const sy = 50 + (SLOT_RADIUS - SLOT_EDGE) * sin

        const state       = slotStates[slot.slotIndex]
        const isActive    = state.activeCard !== null
        const isConnected = state.connected

        // Packet travels slot edge → hub edge (data flows inward to core)
        const packetPath = `M ${sx} ${sy} L ${hx} ${hy}`
        // Vary duration slightly per slot so not all active lines feel identical
        const baseDur = 3.6 + (slot.slotIndex % 3) * 0.3
        const spacing = (baseDur / 3).toFixed(2)

        return (
          <g key={slot.id}>
            {!isActive && (
              <line
                x1={hx} y1={hy} x2={sx} y2={sy}
                className={`conn-line-base${isConnected ? ' conn-line-base--connected' : ''}`}
              />
            )}

            {isActive && (
              <>
                <line x1={hx} y1={hy} x2={sx} y2={sy} className="conn-line-active" />
                {/* 3 evenly-spaced packets, staggered via negative begin */}
                {[0, 1, 2].map(i => (
                  <circle key={i} r="0.55" fill="rgba(0,200,200,0.92)" filter="url(#pkt-glow)">
                    <animateMotion
                      dur={`${baseDur}s`}
                      repeatCount="indefinite"
                      path={packetPath}
                      begin={`${-(i * spacing)}s`}
                      calcMode="spline"
                      keyTimes="0;1"
                      keySplines="0.4 0 0.6 1"
                    />
                  </circle>
                ))}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
