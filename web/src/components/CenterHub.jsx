/* 中央 AI 中樞。
   極簡版：一圈 hairline + 一個字。舊版的同心環、72 根放射刻度、反向旋轉虛線弧、
   徑向漸層光核與 feGaussianBlur 全部移除 —— 那些刻度不承載任何資訊，
   實際輸入只有 activeCount > 0 與 wsStatus 兩個位元。

   顏色一律走 CSS token（currentColor），不再像舊版那樣在 JS 裡寫死四個 hex，
   否則改 token 時這個元件不會跟著變。 */

const R  = 116 // 外環半徑（viewBox 單位）
const CX = 120
const CY = 120

export default function CenterHub({ wsStatus, activeCount }) {
  const isActive       = activeCount > 0
  const isDisconnected = wsStatus === 'disconnected'

  const cls = [
    'center-hub',
    isActive       && 'center-hub--active',
    isDisconnected && 'center-hub--disconnected',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <svg className="center-hub__svg" viewBox="0 0 240 240">
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>

      <div className="hub-label">System Core</div>
    </div>
  )
}
