import { useEffect, useRef } from 'react'
import { bgConf } from '../config/tableTuning.js'

// ============================================================================
// 背景漸層 —— 三個色點各自往外散成一團柔光，疊起來就是 Adobe 那種任意形狀漸層。
//
// ⚠ 為什麼是三個 <div> + radial-gradient，而不是一張 canvas 或一段 shader：
//   這個東西必須【一直在動】而且要墊在整個介面底下。用 canvas 的話每一幀都要
//   重畫一張 1920×1080 的漸層；用 CSS 的話色團只要光柵化一次，之後每一幀只是
//   合成器把同一張圖位移幾個像素 —— 沒有重繪、沒有版面計算。
//   這一端已經有一個 WebGL context 在跑發光層了，不值得為了背景再開一個。
//
// ⚠ 晃動只動 transform，不動 left/top。動 left/top 會觸發 layout + paint，
//   那正是「背景在動」變成「整個介面在掉幀」的原因。
//
// ⚠ 編輯模式要把晃動【凍結】（frozen）：點是動的話根本擺不準位置。
// ============================================================================

// 每個點各自的繞圈週期（秒）與相位。刻意取互質一點的數字 ——
// 週期太接近的話三個點會週期性地同時回到原位，看起來就有「一拍」。
// 徑向衰減的取樣點。
// ⚠ 【不要】改回「顏色 0% → 透明 100%」的兩段式寫法。那是【線性】斜坡：
//   半徑內斜率固定、半徑外是 0，交界處是一個折角。亮度本身是連續的，但人眼對
//   「斜率的不連續」極度敏感（Mach band）—— 結果就是在色團邊緣看到一條根本
//   沒有畫出來的邊。實測：折角處亮度斜率從 0 跳到 3.36（每 100px），那條線
//   正好落在資訊面板右側，看起來就是「面板邊緣有一塊深色塊」。
//   用 smootherstep（3t²−2t³）取樣之後邊緣斜率趨近 0，折角就沒了。
// ⚠ 取樣點刻意【不等距】—— 越靠近邊緣越密。CSS 的漸層停駐點之間是線性內插，
//   等距取樣在最後一段仍然會留下可見的折角。
const STOPS = [0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.82, 0.9, 0.94, 0.97, 0.99, 1]
const ease = (t) => 1 - (3 * t * t - 2 * t * t * t)
const hex2 = (a) => Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0')
// #RRGGBB → 一串 #RRGGBBAA 停駐點（<input type="color"> 一定給 6 碼，可以直接接）
const falloff = (color) =>
  STOPS.map((t) => `${color}${hex2(ease(t))} ${+(t * 100).toFixed(1)}%`).join(', ')

const ORBITS = [
  { px: 29, py: 37, phase: 0 },
  { px: 34, py: 26, phase: 2.1 },
  { px: 38, py: 31, phase: 4.3 },
]

export default function MeshBackground({ frozen = false }) {
  const rootRef = useRef(null)
  const blobRefs = useRef([])
  const conf = bgConf()
  const { on, spread, strength, drift, speed, points } = conf

  // 晃動迴圈。⚠ 依賴只放「會改變運動本身」的值 —— 顏色改變不需要重啟迴圈。
  useEffect(() => {
    if (!on) return
    const els = blobRefs.current.filter(Boolean)
    if (!els.length) return

    // 凍結時把位移歸零並停掉迴圈，不是只停在當下那一格 ——
    // 停在半路的話編輯器上顯示的座標會跟眼睛看到的差一個位移。
    if (frozen) {
      for (const el of els) el.style.transform = 'translate(-50%, -50%)'
      return
    }

    let raf = 0
    const t0 = performance.now()
    const tick = (now) => {
      const t = ((now - t0) / 1000) * speed
      for (let i = 0; i < els.length; i++) {
        const o = ORBITS[i % ORBITS.length]
        // 兩個不同週期的正弦 = 一個緩慢的李薩如軌跡，比正圓自然
        const dx = Math.cos((t * 2 * Math.PI) / o.px + o.phase) * drift
        const dy = Math.sin((t * 2 * Math.PI) / o.py + o.phase * 1.7) * drift
        // ⚠ 位移的單位是 vmin，不是 %。translate 的百分比是相對【元素自己】的
        //   尺寸，用 % 的話「晃動幅度」會跟著擴散半徑一起變 —— 調大色團就會
        //   連帶晃得更遠，那不是這支滑桿該有的意思。vmin 與色團尺寸同一個基準
        //   （容器短邊），1vmin = 短邊的 1%，滑桿上的數字才說得通。
        els[i].style.transform = `translate(calc(-50% + ${dx.toFixed(3)}vmin), calc(-50% + ${dy.toFixed(3)}vmin))`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, frozen, drift, speed])

  if (!on) return null

  return (
    <div className="bg-mesh" ref={rootRef} style={{ opacity: strength }}>
      {points.map((p, i) => (
        <div
          key={i}
          ref={(el) => { blobRefs.current[i] = el }}
          className="bg-mesh__blob"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            // ⚠ 尺寸用 vmin 而不是 % —— % 會分別對上容器的寬與高，畫面一寬
            //   色團就被拉成橢圓。短邊基準才是「圓形往外散」。
            width: `${spread * 2}vmin`,
            height: `${spread * 2}vmin`,
            background: `radial-gradient(circle closest-side, ${falloff(p.color)})`,
          }}
        />
      ))}
    </div>
  )
}
