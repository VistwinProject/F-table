import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SLOT_COUNT, bgConf, exportTuning, getTuning, hubPos, hubSize,
  resetTuning, setTuning, slotPos, slotSize,
} from '../config/tableTuning.js'

// ============================================================================
// 桌面版面編輯器（鍵盤 e）—— 暫時性工具，不是展場的一部分。
//
// 能調：
//   左右佔比   左側資訊面板佔 .app-body 的百分比
//   圓圈大小   感應圈直徑、中樞圈直徑
//   圓圈位置   九個感應圈與中樞，直接在畫面上拖
//   背景漸層   三個色點的位置與顏色，加上擴散、濃淡、晃動幅度與速度
//
// ⚠ 值即時寫進 config/tableTuning.js（localStorage），CSS 變數、連線 SVG 與
//   WebGL 發光層同時跟著變 —— 三邊讀的是同一份，不會各調各的。
// ⚠ localStorage 只是過程的暫存。調完按「匯出」，把內容貼回 DEFAULTS。
// ⚠ 展場的桌面是投影、沒有接鍵盤，所以用按鍵開啟是安全的。
// ============================================================================

const GRID = 0.5 // 吸附格（容器 %）；按住 Alt 可以無視
const r1 = (n) => Math.round(n * 10) / 10

export default function TableEditor({ onClose, hubRef }) {
  const T = getTuning()
  const [collapsed, setCollapsed] = useState(false)
  const [sel, setSel] = useState(null) // { kind: 'slot'|'hub', i }
  const [exported, setExported] = useState(null)
  const drag = useRef(null)

  const set = (patch) => setTuning((t) => ({ ...t, ...patch }))
  const setBg = (patch) => setTuning((t) => ({ ...t, bg: { ...t.bg, ...patch } }))
  const setBgPoint = (i, patch) => setTuning((t) => ({
    ...t,
    bg: { ...t.bg, points: t.bg.points.map((p, j) => (j === i ? { ...p, ...patch } : p)) },
  }))

  // 螢幕座標 → 某個容器的百分比。
  // ⚠ 兩種物件的基準【不一樣】：感應圈與中樞是 .hub-container 的 %（那個容器
  //   只佔 main 的 96%×90% 又被左側面板推開），背景色點是 .app-frame 的 %。
  //   換錯基準拖起來就是倍率不對，而且只有在容器不滿版時才看得出來。
  const pctIn = useCallback((el, e) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }, [])
  const toPct = useCallback((e, kind) => (
    pctIn(kind === 'bg' ? document.querySelector('.app-frame') : hubRef?.current, e)
  ), [pctIn, hubRef])

  const startDrag = (kind, i) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const p = toPct(e, kind)
    if (!p) return
    setSel({ kind, i })
    const base =
      kind === 'hub' ? { ...hubPos() }
      : kind === 'bg' ? { ...bgConf().points[i] }
      : { ...slotPos(i) }
    drag.current = { kind, i, start: p, base }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 某些環境不支援；下面的 buttons 檢查會兜底 */
    }
  }

  useEffect(() => {
    const move = (e) => {
      const d = drag.current
      if (!d) return
      // 兜底：沒按著鍵卻收到 move ＝ pointerup 漏掉了，不修的話圓圈會黏著游標跑。
      if (e.buttons === 0) { drag.current = null; return }
      const p = toPct(e, d.kind)
      if (!p) return
      const snap = (v) => (e.altKey ? Math.round(v * 100) / 100 : Math.round(v / GRID) * GRID)
      const x = snap(d.base.x + (p.x - d.start.x))
      const y = snap(d.base.y + (p.y - d.start.y))
      if (d.kind === 'hub') setTuning((t) => ({ ...t, hub: { x, y } }))
      else if (d.kind === 'bg') setBgPoint(d.i, { x, y })
      else setTuning((t) => ({ ...t, slots: { ...t.slots, [d.i]: { x, y } } }))
    }
    const up = () => (drag.current = null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
    }
  }, [toPct])

  // 方向鍵微調（Shift = ×10）
  useEffect(() => {
    const key = (e) => {
      if (!sel) return
      const t = e.target
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      const step = (e.shiftKey ? 10 : 1) * GRID
      const d = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0],
        ArrowUp: [0, -step], ArrowDown: [0, step],
      }[e.key]
      if (!d) return
      e.preventDefault()
      const base =
        sel.kind === 'hub' ? hubPos()
        : sel.kind === 'bg' ? bgConf().points[sel.i]
        : slotPos(sel.i)
      const x = r1(base.x + d[0])
      const y = r1(base.y + d[1])
      if (sel.kind === 'hub') setTuning((t) => ({ ...t, hub: { x, y } }))
      else if (sel.kind === 'bg') setBgPoint(sel.i, { x, y })
      else setTuning((t) => ({ ...t, slots: { ...t.slots, [sel.i]: { x, y } } }))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [sel])


  // 把搬過的圓圈放回弧線上。⚠ 只清 slots，不動大小與佔比。
  const resetSlots = () => {
    setTuning((t) => ({ ...t, slots: {}, hub: { x: 50, y: 70 } }))
    setSel(null)
  }

  // ⚠ 直接量【已經算好的】面板寬，不要用 app-body 寬 × 佔比去推 ——
  //   app-body 有 padding 與 gap，推出來會比實際寬約 20px，那個數字是拿來判斷
  //   「維養表的名稱欄會不會被截斷」的，差 20px 就會判斷錯。
  const panelW = typeof document !== 'undefined'
    ? Math.round(document.querySelector('.info-panel')?.getBoundingClientRect().width || 0)
    : 0
  const movedCount = Object.keys(T.slots).length
  const bg = bgConf()

  return (
    <>
      {/* 拖曳把手用 portal 掛進 .hub-container【裡面】。
          ⚠ 不要在外面另外做一層去對齊它：圓圈的 left/top 是那個容器的百分比，
            而容器只佔 main 的 96% × 90%、又被左側面板推開 —— 在別的祖先底下
            複製一份幾何遲早會對不上（實際踩過：差了 583px）。
            掛進去之後座標系天生就是同一個。 */}
      {/* 背景色點的把手。⚠ 這一組【不】掛進 hub-container —— 色點是整個 .app-frame
          的百分比，掛進去的話基準就變成那個小容器了。 */}
      <div className="te-bglayer">
        {bg.points.map((p, i) => (
          <div
            key={i}
            className={`te-bgdot${sel?.kind === 'bg' && sel.i === i ? ' te-bgdot--on' : ''}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.color }}
            onPointerDown={startDrag('bg', i)}
          >
            <span className="te-handle__tag">色點 {i + 1} · {r1(p.x)},{r1(p.y)}</span>
          </div>
        ))}
      </div>

      {hubRef?.current && createPortal(
      <div className="te-layer">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const p = slotPos(i)
          const on = sel?.kind === 'slot' && sel.i === i
          const moved = T.slots[i] != null
          return (
            <div
              key={i}
              className={`te-handle${on ? ' te-handle--on' : ''}${moved ? ' te-handle--moved' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${slotSize()}px`, height: `${slotSize()}px` }}
              onPointerDown={startDrag('slot', i)}
            >
              <span className="te-handle__tag">
                {String(i + 1).padStart(2, '0')} · {r1(p.x)},{r1(p.y)}
              </span>
            </div>
          )
        })}
        <div
          className={`te-handle te-handle--hub${sel?.kind === 'hub' ? ' te-handle--on' : ''}`}
          style={{
            left: `${hubPos().x}%`, top: `${hubPos().y}%`,
            width: `${hubSize()}px`, height: `${hubSize()}px`,
          }}
          onPointerDown={startDrag('hub', 0)}
        >
          <span className="te-handle__tag">中樞 · {r1(hubPos().x)},{r1(hubPos().y)}</span>
        </div>
      </div>,
      hubRef.current)}

      <div className={`te-panel${collapsed ? ' te-panel--min' : ''}`}>
        {!collapsed && (
          <div className="te-body">
            <label className="te-slider">
              <span>左側面板佔比 {r1(T.panelPct)}%　<em>實際 {panelW}px</em></span>
              <input
                type="range" min="15" max="55" step="0.5" value={T.panelPct}
                onChange={(e) => set({ panelPct: parseFloat(e.target.value) })}
              />
            </label>

            <label className="te-slider">
              <span>感應圈大小 {r1(T.slotSize)}px</span>
              <input
                type="range" min="40" max="200" step="1" value={T.slotSize}
                onChange={(e) => set({ slotSize: parseFloat(e.target.value) })}
              />
            </label>

            <label className="te-slider">
              <span>中樞圈大小 {r1(T.hubSize)}px</span>
              <input
                type="range" min="100" max="600" step="2" value={T.hubSize}
                onChange={(e) => set({ hubSize: parseFloat(e.target.value) })}
              />
            </label>

            <div className="te-sep">
              <label className="te-check">
                <input type="checkbox" checked={bg.on} onChange={(e) => setBg({ on: e.target.checked })} />
                背景漸層
              </label>
              <span className="te-dim">編輯時晃動已凍結</span>
            </div>

            {bg.on && (
              <>
                <div className="te-colors">
                  {bg.points.map((p, i) => (
                    <label key={i} className={`te-color${sel?.kind === 'bg' && sel.i === i ? ' te-color--on' : ''}`}>
                      <input
                        type="color" value={p.color}
                        onChange={(e) => setBgPoint(i, { color: e.target.value })}
                        onFocus={() => setSel({ kind: 'bg', i })}
                      />
                      <span>色點 {i + 1}</span>
                    </label>
                  ))}
                </div>

                <label className="te-slider">
                  <span>擴散 {r1(bg.spread)}</span>
                  <input type="range" min="15" max="130" step="1" value={bg.spread}
                    onChange={(e) => setBg({ spread: parseFloat(e.target.value) })} />
                </label>
                <label className="te-slider">
                  <span>濃淡 {Math.round(bg.strength * 100)}%</span>
                  <input type="range" min="0" max="1" step="0.02" value={bg.strength}
                    onChange={(e) => setBg({ strength: parseFloat(e.target.value) })} />
                </label>
                <label className="te-slider">
                  {/* 單位是 vmin＝容器短邊的 %，不是像素也不是色團的 % ——
                      見 MeshBackground 裡那段說明。 */}
                  <span>晃動幅度 {r1(bg.drift)} vmin</span>
                  <input type="range" min="0" max="30" step="0.5" value={bg.drift}
                    onChange={(e) => setBg({ drift: parseFloat(e.target.value) })} />
                </label>
                <label className="te-slider">
                  <span>晃動速度 ×{Math.round(bg.speed * 100) / 100}</span>
                  <input type="range" min="0.1" max="4" step="0.05" value={bg.speed}
                    onChange={(e) => setBg({ speed: parseFloat(e.target.value) })} />
                </label>
              </>
            )}

            <p className="te-dim te-hint">
              直接拖畫面上的圓圈與色點可以改位置（方向鍵微調、Shift ×10、Alt 關閉吸附）。
              ⚠ 面板太窄時維養表的名稱欄會開始被截斷 —— 上面的 px 換算就是給這個看的。
              {movedCount > 0 && `　目前有 ${movedCount} 個感應圈被搬離弧線。`}
            </p>

            <div className="te-foot">
              <button onClick={() => { window.__tableExport = exportTuning(); setExported(exportTuning()) }}>匯出</button>
              <button onClick={resetSlots} disabled={movedCount === 0 && hubPos().x === 50 && hubPos().y === 70}>
                圓圈歸位
              </button>
              <button onClick={() => { if (confirm('佔比、大小、位置全部還原成程式碼裡的值？')) { resetTuning(); setSel(null) } }}>
                全部重設
              </button>
            </div>
          </div>
        )}

        <div className="te-head">
          <strong>版面編輯</strong>
          <span className="te-spacer" />
          {/* ⚠ 收起是必要的：面板固定在左下角，展開時正好蓋住 NFC 01 那一區。 */}
          <button className="te-icon" onClick={() => setCollapsed((v) => !v)} title={collapsed ? '展開' : '收起'}>
            {collapsed ? '▲' : '▼'}
          </button>
          <button className="te-icon" onClick={onClose} title="關閉編輯模式（e）">✕</button>
        </div>
      </div>

      {exported != null && <ExportBox text={exported} onClose={() => setExported(null)} />}
    </>
  )
}

// 三條拿到文字的路，任何一條不通都還有別的：
//   1. textarea 本身可以選取（開啟時已經全選，直接 ⌘C / Ctrl+C）
//   2. 「複製」按鈕走 navigator.clipboard，失敗會退回 execCommand
//   3. 「存到專案」POST 給 dev server 寫成 table-export.txt（完全不碰剪貼簿）
// ⚠ 不要改回 alert：alert 裡的文字選不起來，而且會搶走焦點讓 clipboard 寫入被拒。
function ExportBox({ text, onClose }) {
  const ref = useRef(null)
  const [note, setNote] = useState('')
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  const copy = async () => {
    const el = ref.current
    el.focus(); el.select()
    try {
      await navigator.clipboard.writeText(text)
      setNote('已複製到剪貼簿')
    } catch {
      const ok = document.execCommand?.('copy')
      setNote(ok ? '已複製到剪貼簿' : '複製失敗 —— 文字已全選，請按 ⌘C / Ctrl+C')
    }
  }

  const save = async () => {
    try {
      const r = await fetch('/__table-export', { method: 'POST', body: text })
      const j = await r.json()
      setNote(`已存成 F-table/web/${j.file}`)
    } catch (err) {
      setNote(`存檔失敗：${err.message}（這個端點只有 npm run dev 有）`)
    }
  }

  return (
    <div className="te-export">
      <div className="te-head">
        <strong>匯出</strong>
        <span className="te-spacer" />
        <button onClick={copy}>複製</button>
        <button onClick={save}>存到專案</button>
        <button className="te-icon" onClick={onClose} title="關閉">✕</button>
      </div>
      <textarea ref={ref} readOnly value={text} spellCheck={false} />
      <div className="te-dim te-export-note">
        {note || '文字已全選，可以直接 ⌘C / Ctrl+C；或按「存到專案」寫成 table-export.txt。'}
      </div>
    </div>
  )
}
