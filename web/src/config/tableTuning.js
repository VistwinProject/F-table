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

  // ── 資訊面板：三張卡的高度佔比 ────────────────────────────────────────────
  // 這一端是【投影】，捲不動 —— 「往下還有東西」等於那些東西不存在。所以三張卡
  // 不再是「兩張固定 + 趨勢圖吃掉剩下的」，而是三張一起把面板的高度分完：
  // 每張卡 flex-basis: 0 + flex-grow: 權重，總和永遠剛好等於面板高度。
  //
  // ⚠ 權重是【相對值】不是百分比：1/1.6/1.4 與 10/16/14 完全一樣。編輯面板上
  //   顯示的 % 是即時換算出來的。
  // ⚠ 佔比不保證拿得到 —— 每張卡都有自己的內容下限（min-content），權重給太小
  //   時那張卡會停在下限、剩下的由其他卡分。這是【故意】的：投影上寧可佔比不準，
  //   也不要無聲裁掉維養排程的最後一列。編輯面板會同時顯示「要求 %」與「實際 px」。
  cards: { usage: 1, trend: 1.55, maint: 1.35 },

  // ── 資訊面板：字級 ────────────────────────────────────────────────────────
  // 四個角色 × 一個總縮放。其餘字級（單位、增減、座標軸、日期…）都是從這四個
  // 推導出來的，見 style.css 裡的 calc()。
  // ⚠ 字級與上面的佔比【互相牽動】：字調大 → 每張卡的 min-content 變高 →
  //   佔比更容易失效。兩組滑桿放在一起調就是這個原因。
  // ⚠ scale 是投影距離用的總開關（現場站遠了看不清就整組放大），
  //   個別四項是版面比例用的。不要用個別項去模擬總縮放。
  font: {
    scale: 1,     // 總縮放倍率
    title: 25,    // 家電名稱（.device-dash__title）
    stat: 48,     // 今日主數字（.usage-stat__value）
    label: 16,    // 卡片標題（.device-card__label）
    body: 15,     // 資料列 / 維養表 / 說明文字
  },

  // ── 背景漸層 ──────────────────────────────────────────────────────────────
  // 三個色點，每個點往外散成一團柔光，疊起來就是 Adobe 那種任意形狀漸層。
  // 展場運行時每個點會在自己的中心附近緩慢繞圈（像 Apple 的桌布），
  // 編輯模式會把晃動【凍結】—— 點是動的根本擺不準。
  bg: {
    on: true,
    // 每個點的擴散半徑，以容器【短邊】的 % 計 —— 用短邊才不會因為畫面比例
    // 變寬就把色團拉成橢圓。
    // ⚠ 100 不是隨手放大的：62 的時候三個色團的聯集蓋不滿畫面，左側有 11.5% 的
    //   面積【完全在色團之外】＝純底色 rgb(22,24,29)、一點漸層都沒有，而那塊
    //   死區正好貼在資訊面板右緣（面板右側那條帶有 25.4% 是死區）。
    //   一塊全平的區域接著一塊有斜率的區域，看起來就是「面板邊緣有深色塊」。
    //   實測死區比例：62→11.5%、70→6.3%、80→2.9%、90→0.6%、100→0%。
    //   調小的話請順便確認左側不要又出現死區。
    spread: 100,
    strength: 0.45, // 整體不透明度。顏色本身只管色相，濃淡一律由這個調
    // 晃動幅度，單位 vmin（＝容器短邊的 %）。要讓背景讀得出「在流動」，
    // 2～3 太小 —— 那個幅度在 1080 高上只有 ±30px，看起來是靜止的。
    // 9 = ±97px（1080p），一來一回約 190px，是「在流動」而不是「在飄」。
    drift: 9,
    speed: 1.4,     // 晃動速度倍率。1 = 每個點約 26～38 秒繞一圈
    // 預設走冷色，與這一端的淡藍走線同一家人；刻意壓得很暗 ——
    // 目的是「讓底不要死板」，不是「把背景變成主角」。
    //
    // ⚠ 第一個點在 34%（不是原本的 66%）—— 這是為了【資訊面板右緣那條深色帶】。
    //   三個點都偏右的時候，畫面最暗的區域是整個左半邊；而資訊面板蓋掉了
    //   x 1.5%～30%，剩下 30%～37% 那一條窄縫就是那塊暗區【唯一露出來的部分】，
    //   夾在亮面板與逐漸變亮的感應區之間，看起來就是一條貼著面板的深色帶。
    //   實測平均亮度（0–255）：
    //     點1 在 66%：窄縫 34.7 / 感應區 49.0 → 落差 −14.3
    //     點1 在 34%：窄縫 43.3 / 感應區 44.1 → 落差 −0.8
    // ⚠ 代價是面板背後從 32.2 亮到 40.6，毛玻璃會透一點過去。實測 WCAG 對比：
    //   主文字 11.6 → 10.3、次階文字 5.5 → 5.0，都還遠高於 AA(4.5)，可以接受。
    //   但【不要】再往面板中央拖：拖過去對比就會開始掉出安全範圍。
    points: [
      { x: 34, y: 20, color: '#1B4FA8' },
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
      cards: { ...DEFAULTS.cards, ...(s.cards || {}) },
      font: { ...DEFAULTS.font, ...(s.font || {}) },
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
  cards: { ...DEFAULTS.cards },
  font: { ...DEFAULTS.font },
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
/** 三張資訊卡的高度權重：{ usage, trend, maint }。 */
export const cardWeights = () => TUNING.cards
/** 字級原始值：{ scale, title, stat, label, body }。 */
export const fontConf = () => TUNING.font

/**
 * 資訊面板的字級 CSS 變數。四個角色乘上總縮放之後直接寫成 px ——
 * ⚠ 不用 CSS 巢狀 calc 去乘 scale：巢狀 calc 在這裡沒有任何好處，而且
 *   匯出時要的是「原始值 + 縮放」兩個數字，不是算完的結果。
 */
export function fontVars() {
  const f = TUNING.font
  const k = (n) => `${Math.round(n * f.scale * 10) / 10}px`
  return {
    '--fs-title': k(f.title),
    '--fs-stat': k(f.stat),
    '--fs-label': k(f.label),
    '--fs-body': k(f.body),
  }
}

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
  const c = T.cards
  L.push(`  cards: { usage: ${r2(c.usage)}, trend: ${r2(c.trend)}, maint: ${r2(c.maint)} },`)
  const f = T.font
  L.push('  font: {')
  L.push(`    scale: ${r2(f.scale)},`)
  L.push(`    title: ${r1(f.title)},`)
  L.push(`    stat: ${r1(f.stat)},`)
  L.push(`    label: ${r1(f.label)},`)
  L.push(`    body: ${r1(f.body)},`)
  L.push('  },')
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
