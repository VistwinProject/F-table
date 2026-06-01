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
      {/* Decorative pulsing dots — visual rhythm + signal "the system is live" */}
      <span className="welcome-screen__dot welcome-screen__dot--top" />
      <span className="welcome-screen__dot welcome-screen__dot--bl" />
      <span className="welcome-screen__dot welcome-screen__dot--br" />

      {/* Subtle circuit-trace decorations at the edges */}
      <svg className="welcome-screen__circuit welcome-screen__circuit--left" viewBox="0 0 240 320" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,40 L80,40 L100,60 L100,140 L140,180 L60,180 L40,200 L40,300" />
        <path d="M0,120 L40,120 L60,100 L160,100" opacity="0.6" />
        <path d="M0,260 L120,260 L140,240 L220,240" opacity="0.7" />
      </svg>
      <svg className="welcome-screen__circuit welcome-screen__circuit--right" viewBox="0 0 240 320" preserveAspectRatio="none" aria-hidden="true">
        <path d="M240,40 L160,40 L140,60 L140,140 L100,180 L180,180 L200,200 L200,300" />
        <path d="M240,120 L200,120 L180,100 L80,100" opacity="0.6" />
        <path d="M240,260 L120,260 L100,240 L20,240" opacity="0.7" />
      </svg>

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
