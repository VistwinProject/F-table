import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SLOT_COUNT, bgConf, exportTuning, fontConf, getTuning, hubPos, hubSize,
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
//   卡片佔比   用電量 / 趨勢圖 / 維養排程三張卡各分到多少高度
//   面板字級   四個角色（家電名稱、主數字、卡片標題、內文）＋一個總縮放
//
// ⚠ 值即時寫進 config/tableTuning.js（localStorage），CSS 變數、連線 SVG 與
//   WebGL 發光層同時跟著變 —— 三邊讀的是同一份，不會各調各的。
// ⚠ localStorage 只是過程的暫存。調完按「匯出」，把內容貼回 DEFAULTS。
// ⚠ 展場的桌面是投影、沒有接鍵盤，所以用按鍵開啟是安全的。
// ============================================================================

const GRID = 0.5 // 吸附格（容器 %）；按住 Alt 可以無視

// 編輯面板自己的位置。⚠ 刻意【不】放進 tableTuning：那份是要匯出貼回程式碼的
//   版面資料，工具擺哪裡不屬於版面。分開一個 key，匯出的內容才不會多出雜訊。
const POS_KEY = 'f-table-editor-pos'
const HOME = { left: 14, bottom: 14 }
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))
const loadPos = () => {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    return v && Number.isFinite(v.left) && Number.isFinite(v.bottom) ? v : { ...HOME }
  } catch {
    return { ...HOME }
  }
}
const r1 = (n) => Math.round(n * 10) / 10

// 三張卡的排列順序（＝面板由上而下），權重鍵 → 顯示名稱 → DOM 選擇器
const CARDS = [
  ['usage', '用電量', '.device-card--usage'],
  ['trend', '趨勢圖', '.device-card--chart'],
  ['maint', '維養排程', '.device-card--maint'],
]

export default function TableEditor({ onClose, hubRef }) {
  const T = getTuning()
  const [collapsed, setCollapsed] = useState(false)
  // 按住 h 暫時看穿編輯面板。
  // ⚠ 加了佔比與字級之後這個面板高約 1030px，正好整片蓋住左側資訊面板 ——
  //   而那兩組滑桿調的就是它。收合再展開太慢（滑桿位置會跑掉），所以改成
  //   「按住看一眼、放開繼續調」。用 opacity 不用卸載：卸載會讓正在拖的滑桿失去
  //   pointer capture，放開 h 之後就要重新抓一次。
  const [peek, setPeek] = useState(false)
  // 面板位置。⚠ 用 left/bottom 不用 left/top —— 面板是 column-reverse、由下往上長，
  //   釘住下緣的話內容變高時整排按鈕不會上下跳（見 .te-panel 的註解）。
  const [pos, setPos] = useState(loadPos)
  const panelRef = useRef(null)
  const panelDrag = useRef(null)
  const posRef = useRef(pos)
  posRef.current = pos
  const [sel, setSel] = useState(null) // { kind: 'slot'|'hub', i }
  const [exported, setExported] = useState(null)
  const drag = useRef(null)

  const set = (patch) => setTuning((t) => ({ ...t, ...patch }))
  const setCard = (k, v) => setTuning((t) => ({ ...t, cards: { ...t.cards, [k]: v } }))
  const setFont = (patch) => setTuning((t) => ({ ...t, font: { ...t.font, ...patch } }))
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

  // ── 拖曳整個編輯面板 ───────────────────────────────────────────────────────
  // ⚠ 為什麼需要：這個面板高約 1030px，佔比與字級那兩組滑桿調的就是被它蓋住的
  //   左側資訊面板。按住 h 可以看一眼，但「邊拖邊看」只能靠把面板搬開。
  // ⚠ 抓取點是標題列，而且標題列上的按鈕要放行 —— 不放行的話收合／關閉按鈕
  //   會變成拖曳把手，點不下去。
  const startPanelDrag = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    panelDrag.current = { x: e.clientX, y: e.clientY, base: posRef.current }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 同下面的 buttons 兜底 */ }
  }

  useEffect(() => {
    const move = (e) => {
      const d = panelDrag.current
      if (!d) return
      if (e.buttons === 0) { panelDrag.current = null; return }
      const el = panelRef.current
      const w = el?.offsetWidth ?? 420
      const h = el?.offsetHeight ?? 200
      // ⚠ 一定要夾在視窗內：拖出畫面外之後位置會存進 localStorage，
      //   下次開編輯模式就是一個看不見也抓不回來的面板。
      setPos({
        left: clamp(d.base.left + (e.clientX - d.x), 0, window.innerWidth - w),
        bottom: clamp(d.base.bottom - (e.clientY - d.y), 0, window.innerHeight - h),
      })
    }
    const up = () => {
      if (!panelDrag.current) return
      panelDrag.current = null
      // 放開才寫檔 —— 拖曳中每一格都寫 localStorage 是白花的同步 I/O
      try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)) } catch { /* 無痕模式 */ }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  // 按住 h 看穿面板
  useEffect(() => {
    const isField = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    // ⚠ range input 有焦點時也要放行 —— 拖完滑桿焦點會留在上面，
    //   那時候按 h 才是最需要看穿的時機。只有真的在打字的欄位才擋。
    const typing = (t) => isField(t) && !(t.tagName === 'INPUT' && t.type === 'range')
    const down = (e) => { if (e.key === 'h' && !typing(e.target)) setPeek(true) }
    const up = (e) => { if (e.key === 'h') setPeek(false) }
    // ⚠ 視窗失焦時要強制放開：切出去再切回來的話 keyup 收不到，面板會一直隱形。
    const blur = () => setPeek(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

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


  // ── 面板實測 ───────────────────────────────────────────────────────────────
  // ⚠ 佔比是【要求值】不是結果：卡片有自己的內容下限，權重給太小時那張卡會停在
  //   下限、剩下的由別人分。所以編輯面板要同時顯示要求 % 與實際 px，否則調的人
  //   會以為滑桿壞了。溢出也一起量 —— .device-dash 是 overflow: hidden，
  //   不主動量的話「被裁掉」在畫面上看起來跟「剛好塞滿」一模一樣。
  // ⚠ 沒有依賴陣列＝每次 render 之後都重量。值沒變就不 setState，所以不會無限迴圈；
  //   用依賴陣列反而會漏掉「字級改了 → 版面重排」這種間接變化。
  const [fit, setFit] = useState(null)
  useEffect(() => {
    const d = document.querySelector('.device-dash')
    const els = CARDS.map(([, , sel]) => d?.querySelector(sel))
    const next = !d || els.some((el) => !el) ? null : {
      h: els.map((el) => Math.round(el.getBoundingClientRect().height)),
      over: Math.max(0, d.scrollHeight - d.clientHeight),
    }
    setFit((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  })

  const wSum = CARDS.reduce((a, [k]) => a + T.cards[k], 0)
  const hSum = fit ? fit.h.reduce((a, b) => a + b, 0) : 0

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
  const font = fontConf()

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

      <div
        ref={panelRef}
        className={`te-panel${collapsed ? ' te-panel--min' : ''}${peek ? ' te-panel--peek' : ''}`}
        /* ⚠ --te-bottom 要餵給 .te-body 的 max-height：面板往上搬之後可用高度
           就變少了，不跟著算的話內容會頂出畫面上緣。 */
        style={{ left: `${pos.left}px`, bottom: `${pos.bottom}px`, '--te-bottom': `${pos.bottom}px` }}
      >
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
              <strong>資訊卡佔比</strong>
              {fit
                ? (fit.over > 0
                    ? <span className="te-warn">⚠ 溢出 {fit.over}px（被裁掉了）</span>
                    : <span className="te-dim">共 {hSum}px</span>)
                : <span className="te-dim">放一台家電上感應區才量得到</span>}
            </div>

            {CARDS.map(([k, name], i) => {
              const want = Math.round((T.cards[k] / wSum) * 100)
              const got = fit ? Math.round((fit.h[i] / hSum) * 100) : null
              // 差 2% 以上＝這張卡卡在自己的內容下限，權重再往下拉也沒用
              const stuck = got != null && got - want >= 2
              return (
                <label key={k} className="te-slider">
                  <span>
                    {name} {want}%
                    {fit && <em>　實際 {fit.h[i]}px / {got}%</em>}
                    {stuck && <b className="te-warn">　已到內容下限</b>}
                  </span>
                  <input
                    type="range" min="0.3" max="4" step="0.05" value={T.cards[k]}
                    onChange={(e) => setCard(k, parseFloat(e.target.value))}
                  />
                </label>
              )
            })}

            <div className="te-sep">
              <strong>面板字級</strong>
              <span className="te-dim">字調大會推高卡片下限</span>
            </div>

            <label className="te-slider">
              <span>總縮放 ×{Math.round(font.scale * 100) / 100}　<em>投影距離用</em></span>
              <input type="range" min="0.6" max="2" step="0.02" value={font.scale}
                onChange={(e) => setFont({ scale: parseFloat(e.target.value) })} />
            </label>
            {[
              ['title', '家電名稱', 12, 48],
              ['stat', '今日主數字', 20, 96],
              ['label', '卡片標題', 10, 32],
              ['body', '內文 / 維養表', 9, 28],
            ].map(([k, name, lo, hi]) => (
              <label key={k} className="te-slider">
                <span>
                  {name} {r1(font[k])}px
                  {font.scale !== 1 && <em>　實際 {r1(font[k] * font.scale)}px</em>}
                </span>
                <input type="range" min={lo} max={hi} step="0.5" value={font[k]}
                  onChange={(e) => setFont({ [k]: parseFloat(e.target.value) })} />
              </label>
            ))}

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
              調佔比與字級時這個面板正好蓋住左側資訊面板：<b>拖標題列</b>可以把它搬開
              （⌂ 歸位），或<b>按住 h</b> 暫時看穿。
              ⚠ 佔比的「實際 px」跟著【當下顯示的那台家電】走：維養排程 2 列與 4 列的
              內容下限差很多，輪播切換時數字會變是正常的。
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

        <div className="te-head te-head--drag" onPointerDown={startPanelDrag}>
          <strong>版面編輯</strong>
          <span className="te-spacer" />
          <button
            className="te-icon"
            onClick={() => { setPos({ ...HOME }); try { localStorage.removeItem(POS_KEY) } catch { /* 無痕模式 */ } }}
            title="面板歸位（左下角）"
          >
            ⌂
          </button>
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
