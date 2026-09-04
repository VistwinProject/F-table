// ============================================================================
// 桌面版面覆寫 —— 只給編輯模式（鍵盤 e）用的暫時性資料層
// ----------------------------------------------------------------------------
// 這裡是「左右佔比、圓圈大小、圓圈位置」的單一讀取點。App 的版面、CSS 變數、
// 連線 SVG 與 WebGL 發光層都從這裡拿值，不再各自寫死數字 —— 因為那四個地方
// 必須用【同一組】數字，任何一處對不上，光就會跟圓圈錯開。
//
// 沒有覆寫時回傳的就是下面 DEFAULTS 的值，畫面與加這個檔案之前逐字相同。
//
// ⚠ localStorage 只是調整過程的暫存，不是設定檔。調完按「匯出」，把內容貼回：
//     佔比 / 圓圈大小 → 這個檔案的 DEFAULTS
//     圓圈位置       → 同上（slots / hub）
// ⚠ 有覆寫時畫面右上角會一直顯示「已套用編輯值」—— 展場誤觸不會無聲無息地留著。
// ============================================================================

const KEY = 'f-table-tuning'

export const SLOT_COUNT = 9

// ── 幾何原值 ────────────────────────────────────────────────────────────────
// slot 沿著一個扁橢圓的【上半弧】排開；中樞坐在弧的基線上，所以
// NFC 01 ↔ 中樞 ↔ NFC 09 是一條水平線，圓頂朝正上方開。
// 單數位（1-indexed 的 02/04/06/08）往內縮 INSET_RATIO，形成交錯的雙環扇形。
export const ORBIT = {
  cx: 50,      // 橢圓中心 x（容器 %）
  cy: 70,      // 橢圓中心 y（＝兩側 slot 的基線）
  rx: 43,      // 水平半徑
  ry: 48,      // 垂直半徑
  arcStart: 180,
  arcSweep: 180,
  inset: 0.7,
}

/** 第 i 個 slot（共 n 個）在弧上的預設位置（容器 %）。 */
export function orbitPos(i, n = SLOT_COUNT) {
  const f = n > 1 ? i / (n - 1) : 0.5
  const deg = ORBIT.arcStart + f * ORBIT.arcSweep
  const rad = (deg * Math.PI) / 180
  const k = i % 2 === 1 ? ORBIT.inset : 1
  return {
    x: ORBIT.cx + ORBIT.rx * k * Math.cos(rad),
    y: ORBIT.cy + ORBIT.ry * k * Math.sin(rad),
  }
}

export const DEFAULTS = {
  // 左側資訊面板佔 .app-body 的百分比。原本是 clamp(420px, 32vw, 540px)，
  // 改成純百分比才是「佔比」—— 這一端是固定 1080p 投影，不需要 clamp 的彈性。
  // ⚠ 太窄的話維養表的名稱欄會開始被截斷（見 style.css 的 .maint-row 註解），
  //   編輯面板會即時顯示實際的 px 寬度。
  // ⚠ 29.06 不是隨手取的整數：1920×1080 下 .app-body 的內容寬是 1858px，
  //   29.06% = 540px，正好等於改成佔比之前 clamp(420px, 32vw, 540px) 的結果。
  //   也就是「不調任何東西時，畫面與加這個功能之前逐字相同」。
  panelPct: 29.06,
  slotSize: 86,   // 感應圈直徑（px）
  hubSize: 280,   // 中樞圈直徑（px）
  hub: { x: ORBIT.cx, y: ORBIT.cy },  // 中樞位置（容器 %）
  slots: {},      // { [slotIndex]: { x, y } }，只存有搬過的；其餘用 orbitPos()
}

// ── 狀態 ────────────────────────────────────────────────────────────────────
// ⚠ 模組層的可變狀態，不是 React state —— 非 React 的消費者（buildGlow 的
//   閉包、ConnectionLines）也要讀到「現在這一刻」的值。React 那邊靠 App 的
//   state 觸發重繪，重繪時讀到的就是這裡最新的值。
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return {
      ...DEFAULTS,
      ...s,
      hub: { ...DEFAULTS.hub, ...(s.hub || {}) },
      slots: { ...(s.slots || {}) },
    }
  } catch {
    return null
  }
}

let TUNING = load() || { ...DEFAULTS, hub: { ...DEFAULTS.hub }, slots: {} }
let STORED = (() => { try { return !!localStorage.getItem(KEY) } catch { return false } })()

const listeners = new Set()
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getTuning = () => TUNING

export function setTuning(next) {
  TUNING = typeof next === 'function' ? next(TUNING) : next
  try {
    localStorage.setItem(KEY, JSON.stringify(TUNING))
    STORED = true
  } catch {
    /* 無痕模式會失敗，編輯仍可用，只是重整後回到 DEFAULTS */
  }
  for (const fn of listeners) fn(TUNING)
}

export function resetTuning() {
  try { localStorage.removeItem(KEY) } catch { /* 同上 */ }
  STORED = false
  TUNING = { ...DEFAULTS, hub: { ...DEFAULTS.hub }, slots: {} }
  for (const fn of listeners) fn(TUNING)
  return TUNING
}

export function isTuned() {
  if (!STORED) return false
  return JSON.stringify(TUNING) !== JSON.stringify({ ...DEFAULTS, hub: { ...DEFAULTS.hub }, slots: {} })
}

// ── 讀取點 ──────────────────────────────────────────────────────────────────
/** 第 i 個 slot 的位置（容器 %）：搬過的用覆寫值，沒搬過的照弧算。 */
export const slotPos = (i, n = SLOT_COUNT) => TUNING.slots[i] ?? orbitPos(i, n)
export const hubPos = () => TUNING.hub
export const slotSize = () => TUNING.slotSize
export const hubSize = () => TUNING.hubSize
export const panelPct = () => TUNING.panelPct

// 連線兩端要讓開的距離（px）。⚠ 一定要跟著圓圈大小走 ——
// 寫死的話圓圈調大之後，線就會從圓圈裡面長出來。
export const slotClear = () => slotSize() / 2 + 7
export const hubClear = () => hubSize() / 2 + 15

// ── 匯出（貼回程式碼）───────────────────────────────────────────────────────
const r1 = (n) => Math.round(n * 10) / 10

export function exportTuning() {
  const T = TUNING
  const L = []
  L.push('// ── 由桌面的編輯模式（鍵盤 e）匯出 ──')
  L.push('// 貼回 web/src/config/tableTuning.js 的 DEFAULTS')
  L.push('')
  L.push('export const DEFAULTS = {')
  L.push(`  panelPct: ${r1(T.panelPct)},`)
  L.push(`  slotSize: ${r1(T.slotSize)},`)
  L.push(`  hubSize: ${r1(T.hubSize)},`)
  L.push(`  hub: { x: ${r1(T.hub.x)}, y: ${r1(T.hub.y)} },`)
  const moved = Object.keys(T.slots)
  if (!moved.length) {
    L.push('  slots: {},')
  } else {
    L.push('  slots: {')
    for (const k of moved.sort((a, b) => a - b)) {
      const p = T.slots[k]
      L.push(`    ${k}: { x: ${r1(p.x)}, y: ${r1(p.y)} },   // NFC ${String(+k + 1).padStart(2, '0')}`)
    }
    L.push('  },')
  }
  L.push('}')
  if (moved.length) {
    L.push('')
    L.push(`// ⚠ 有 ${moved.length} 個感應圈被搬離弧線。沒搬過的仍然由 orbitPos() 算，`)
    L.push('//   所以之後調 ORBIT 的橢圓參數時，這幾個【不會】跟著跑。')
  }
  return L.join('\n')
}
