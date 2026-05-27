export default function InfoPanel({
  wsStatus, focusedSlot, focusedState,
  activeCount, connectedCount, activityLog, totalInteractions,
}) {
  const isOk = wsStatus === 'connected'

  return (
    <div className="info-panel">
      {/* ── Fixed header (never scrolls) ── */}
      <div className="panel-header">
        <div className="panel-header-top">
          <div className="panel-title">NFC Interactive System</div>
          <div className="panel-ready">
            <span className="panel-ready__dot" />
            {isOk ? 'System Ready' : 'Offline'}
          </div>
        </div>
        <div className="panel-intro">
          Discover, connect, and interact.<br />
          Place an NFC-enabled object on any sensing zone to begin.
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="panel-body">

        {/* System Status */}
        <div className="panel-section">
          <div className="section-label">System Status</div>
          <div className={`sys-status-chip${isOk ? ' ok' : ' err'}`}>
            <span className="sys-status-chip__icon">{isOk ? '✓' : '✕'}</span>
            {isOk ? 'All systems operational' : 'NFC service offline'}
          </div>
        </div>

        {/* Network Map — show only when readers are connected */}
        {connectedCount > 0 && (
          <div className="panel-section">
            <div className="section-label">Network Map</div>
            <NetworkNodes activityLog={activityLog} />
          </div>
        )}

        {/* Active card detail — show when a slot is focused */}
        {focusedSlot && focusedState && (
          <div className="panel-section">
            <ActiveContent focusedSlot={focusedSlot} focusedState={focusedState} />
          </div>
        )}

        {/* Activity Log */}
        <div className="panel-section">
          <div className="section-label">Activity Log</div>
          {activityLog.length === 0 ? (
            <div className="activity-empty">No recent activity</div>
          ) : (
            <div className="activity-log">
              {activityLog.map(e => (
                <div key={e.id} className="activity-row">
                  <span className="activity-time">{e.time}</span>
                  <span className="activity-node">{e.node}</span>
                  <span className="activity-action">{e.action}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Metrics */}
        <div className="panel-section">
          <div className="section-label">System Metrics</div>
          <div className="metrics-grid">
            <div className="metric-row">
              <span className="metric-key">Active Nodes</span>
              <span className="metric-val">{String(activeCount).padStart(2,'0')} / 09</span>
            </div>
            <div className="metric-row">
              <span className="metric-key">Readers Connected</span>
              <span className="metric-val">{String(connectedCount).padStart(2,'0')} / 09</span>
            </div>
            <div className="metric-row">
              <span className="metric-key">Total Interactions</span>
              <span className="metric-val">{totalInteractions}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Fixed footer note ── */}
      <div className="panel-footer-note">All times in local timezone</div>
    </div>
  )
}

/* ── Recently active node cards ── */
function NetworkNodes({ activityLog }) {
  const seen  = new Set()
  const nodes = activityLog.filter(e => {
    if (seen.has(e.node)) return false
    seen.add(e.node)
    return true
  }).slice(0, 2)

  if (nodes.length === 0) return null

  return (
    <div className="network-nodes">
      {nodes.map(e => (
        <div key={e.node} className={`network-node${e.action === 'Activated' ? ' active' : ''}`}>
          <div className="network-node__icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 17.7a8 8 0 0 0 0-11.4" />
            </svg>
          </div>
          <div className="network-node__info">
            <span className="network-node__name">{e.node}</span>
            <span className="network-node__status">ONLINE</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Focused slot detail ── */
function ActiveContent({ focusedSlot, focusedState }) {
  const { activeCard, connected, readerName } = focusedState

  return (
    <>
      <div className="slot-header">
        <span className="slot-header-index">
          SLOT {String(focusedSlot.slotIndex + 1).padStart(2, '0')}
        </span>
        <span className="slot-header-label">{focusedSlot.label}</span>
      </div>

      {!connected && (
        <div className="card-label-lg idle">讀卡機未連線</div>
      )}

      {connected && !activeCard && (
        <div className="card-label-lg idle">等待感應...</div>
      )}

      {connected && activeCard && !activeCard.known && (
        <>
          <div className="card-label-lg unknown">未知卡片</div>
          <div className="card-meta">
            <div className="meta-row">
              <div className="meta-key">UID</div>
              <div className="meta-value">{activeCard.uid}</div>
            </div>
          </div>
          <div className="unknown-hint">
            加入 <strong>uid-map.json</strong>：
            <code>{`"${activeCard.uid}": { "id": "x", "label": "名稱", "osc": "/nfc/x" }`}</code>
          </div>
        </>
      )}

      {connected && activeCard?.known && (
        <>
          <div className="card-label-lg">{activeCard.data.label}</div>
          <div className="card-meta">
            <div className="meta-row">
              <div className="meta-key">UID</div>
              <div className="meta-value">{activeCard.uid}</div>
            </div>
            {activeCard.data.osc && (
              <div className="meta-row">
                <div className="meta-key">OSC</div>
                <div className="meta-value">{activeCard.data.osc}</div>
              </div>
            )}
          </div>
          {activeCard.data.description && (
            <div className="card-desc">{activeCard.data.description}</div>
          )}
        </>
      )}

      {readerName && <div className="reader-name">{readerName}</div>}
    </>
  )
}
