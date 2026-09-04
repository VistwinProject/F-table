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

  // ── 背景漸層 ──────────────────────────────────────────────────────────────
  // 三個色點，每個點往外散成一團柔光，疊起來就是 Adobe 那種任意形狀漸層。
  // 展場運行時每個點會在自己的中心附近緩慢繞圈（像 Apple 的桌布），
  // 編輯模式會把晃動【凍結】—— 點是動的根本擺不準。
  bg: {
    on: true,
    // 每個點的擴散半徑，以容器【短邊】的 % 計 —— 用短邊才不會因為畫面比例
    // 變寬就把色團拉成橢圓。
    spread: 62,
    strength: 0.45, // 整體不透明度。顏色本身只管色相，濃淡一律由這個調
    // 晃動幅度，單位 vmin（＝容器短邊的 %）。要讓背景讀得出「在流動」，
    // 2～3 太小 —— 那個幅度在 1080 高上只有 ±30px，看起來是靜止的。
    // 9 = ±97px（1080p），一來一回約 190px，是「在流動」而不是「在飄」。
    drift: 9,
    speed: 1.4,     // 晃動速度倍率。1 = 每個點約 26～38 秒繞一圈
    // 預設走冷色，與這一端的淡藍走線同一家人；刻意壓得很暗 ——
    // 目的是「讓底不要死板」，不是「把背景變成主角」。
    // ⚠ 點位刻意避開左側面板（它大約佔畫面 x 的 1.5%～30%）。面板是毛玻璃，
    //   背景會【透過去】——最濃的色團正好壓在面板上時，資料列的次階文字對比
    //   會明顯掉一階，而這一端的觀眾偏年長、投影又會再洗掉一些。
    //   想讓面板也帶顏色的話把色點拖過去就行，只是要順手把濃淡調低。
    points: [
      { x: 66, y: 18, color: '#1B4FA8' },
      { x: 90, y: 66, color: '#1F6B72' },
      { x: 18, y: 92, color: '#3A2E7A' },
    ],
  },
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
      // ⚠ points 是陣列，展開合併救不了「舊存檔少一個點」這種情況 ——
      //   逐格對著 DEFAULTS 補，缺的用預設值填。
      bg: {
        ...DEFAULTS.bg,
        ...(s.bg || {}),
        points: DEFAULTS.bg.points.map((d, i) => ({ ...d, ...(s.bg?.points?.[i] || {}) })),
      },
    }
  } catch {
    return null
  }
}

// ⚠ 一定要深拷貝：bg.points 是陣列，淺拷貝會讓「重設」之後編輯器改到 DEFAULTS 本身。
const freshDefaults = () => ({
  ...DEFAULTS,
  hub: { ...DEFAULTS.hub },
  slots: {},
  bg: { ...DEFAULTS.bg, points: DEFAULTS.bg.points.map((p) => ({ ...p })) },
})

let TUNING = load() || freshDefaults()
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
  TUNING = freshDefaults()
  for (const fn of listeners) fn(TUNING)
  return TUNING
}

export function isTuned() {
  if (!STORED) return false
  return JSON.stringify(TUNING) !== JSON.stringify(freshDefaults())
}

// ── 讀取點 ──────────────────────────────────────────────────────────────────
/** 第 i 個 slot 的位置（容器 %）：搬過的用覆寫值，沒搬過的照弧算。 */
export const slotPos = (i, n = SLOT_COUNT) => TUNING.slots[i] ?? orbitPos(i, n)
export const hubPos = () => TUNING.hub
export const slotSize = () => TUNING.slotSize
export const hubSize = () => TUNING.hubSize
export const panelPct = () => TUNING.panelPct
/** 背景漸層：{ on, spread, strength, drift, speed, points[] }。 */
export const bgConf = () => TUNING.bg

// 連線兩端要讓開的距離（px）＝【圓圈的可見半徑】，所以線正好從感應圈的邊緣
// 拉到中樞圈的邊緣，兩端都貼齊、沒有多餘的間隙。
// ⚠ 一定要跟著圓圈大小走 —— 寫死的話圓圈調大之後線會從圓圈裡面長出來。
export const slotClear = () => slotSize() / 2
// ⚠ 中樞不是 hubSize/2：CenterHub 的 SVG 是 viewBox 240 裡半徑 116 的圓，
//   元素本身才是 hubSize，所以【畫出來】的圓半徑是 hubSize/2 × 116/120。
//   用 hubSize/2 的話線會停在圓環外面約 4%，看起來就是沒接上。
export const HUB_CIRCLE_RATIO = 116 / 120
export const hubClear = () => (hubSize() / 2) * HUB_CIRCLE_RATIO

// ── 匯出（貼回程式碼）───────────────────────────────────────────────────────
const r1 = (n) => Math.round(n * 10) / 10
// ⚠ 佔比要留兩位小數：1858px 寬的容器上，29.06% 與 29.1% 差 2px，
//   而預設值就是特意對到 540px 的（見 DEFAULTS 的說明）。
const r2 = (n) => Math.round(n * 100) / 100

export function exportTuning() {
  const T = TUNING
  const L = []
  L.push('// ── 由桌面的編輯模式（鍵盤 e）匯出 ──')
  L.push('// 貼回 web/src/config/tableTuning.js 的 DEFAULTS')
  L.push('')
  L.push('export const DEFAULTS = {')
  L.push(`  panelPct: ${r2(T.panelPct)},`)
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
  const b = T.bg
  L.push('  bg: {')
  L.push(`    on: ${b.on},`)
  L.push(`    spread: ${r1(b.spread)},`)
  L.push(`    strength: ${Math.round(b.strength * 100) / 100},`)
  L.push(`    drift: ${r1(b.drift)},`)
  L.push(`    speed: ${Math.round(b.speed * 100) / 100},`)
  L.push('    points: [')
  for (const p of b.points) L.push(`      { x: ${r1(p.x)}, y: ${r1(p.y)}, color: '${p.color}' },`)
  L.push('    ],')
  L.push('  },')
  L.push('}')
  if (moved.length) {
    L.push('')
    L.push(`// ⚠ 有 ${moved.length} 個感應圈被搬離弧線。沒搬過的仍然由 orbitPos() 算，`)
    L.push('//   所以之後調 ORBIT 的橢圓參數時，這幾個【不會】跟著跑。')
  }
  return L.join('\n')
}
