/* ── Welcome screen ──────────────────────────────────────────────────────────
   Overlay that sits on top of the main app when mode === 'welcome'.
   The `exiting` prop is driven by the parent (App.jsx) so the fade-out can
   be triggered either by a local click OR by a `session-start` WS broadcast
   from the operator tablet — both paths look identical to the user. */
export default function WelcomeScreen({ exiting, onStart }) {
  const trigger = () => {
    if (exiting) return
    // Just emit — App.jsx handles the fade timing and mode transition.
    onStart()
  }

  return (
    <div
      className={`welcome-screen${exiting ? ' welcome-screen--exit' : ''}`}
      onClick={trigger}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') trigger() }}
      role="button"
      tabIndex={0}
    >
      <div className="welcome-screen__content">
        <div className="welcome-screen__greeting">歡 迎 來 到</div>
        <h1 className="welcome-screen__title">
          <span className="welcome-screen__brace">「</span>
          AI 大腦控制塔
          <span className="welcome-screen__brace">」</span>
        </h1>
        <p className="welcome-screen__instruction">
          請拿取前方設備裝置，放置相對的感應範圍，<br />
          開始將居家設備連結到 AI 大腦！
        </p>
        {/* 「點擊任意位置開始」字樣已移除（投影面不可觸控）。
            點擊功能保留作為開發測試 fallback。 */}
      </div>
    </div>
  )
}
