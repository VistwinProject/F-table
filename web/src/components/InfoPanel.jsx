/* ── Mock appliance datasets ───────────────────────────────────────────────────
   Keyed by the `id` from uid-map.json. Each appliance has its own title, today
   stat, trend, monthly cumulative, and maintenance schedule. The page will
   route by `focusedState.activeCard.data.id`. When no card is active, the
   panel shows an idle/wait state. */

const APPLIANCES = {
  /* 全熱交換機 (HRV) */
  hrv: {
    name:   '全熱交換機',
    metric: '用電量',
    unit:   'kWh',
    today: { label: '今日用電量', value: 28.5, deltaPct: -12, deltaColor: 'good' },
    trend: {
      '日': [3, 4, 5, 5, 7, 10, 15, 22, 28, 32, 36, 38, 46, 35, 18, 20, 22, 25, 28, 30, 28, 30, 28, 12],
      '週': [185, 210, 198, 232, 207, 168, 142],
      '月': [22, 26, 24, 30, 28, 34, 32, 26, 22, 28, 30, 26, 24, 28, 32, 36, 30, 28, 26, 24, 30, 32, 28, 26, 24, 30, 28, 32, 30, 26],
      '年': [780, 820, 795, 860, 920, 1080, 1180, 1150, 980, 890, 830, 856],
    },
    trendYMax: { '日': 50, '週': 250, '月': 50, '年': 1200 },
    month: { label: '本月累積用電量', value: 856.7, target: 1200 },
    maint: [
      { id: 'filter', icon: 'filter', name: '濾網清潔',     last: '2024/05/20', next: '2024/06/20', status: 'warn', label: '即將到期' },
      { id: 'core',   icon: 'core',   name: '熱交換芯清潔', last: '2024/04/20', next: '2024/07/20', status: 'ok',   label: '正常' },
      { id: 'fan',    icon: 'fan',    name: '風扇檢查',     last: '2024/05/10', next: '2024/08/10', status: 'ok',   label: '正常' },
      { id: 'belt',   icon: 'belt',   name: '皮帶檢查',     last: '2024/03/15', next: '2024/09/15', status: 'ok',   label: '正常' },
    ],
  },

  /* 大門 */
  door: {
    name:   '大門',
    metric: '感應記錄',
    unit:   '次',
    today: { label: '今日感應次數', value: 24, deltaPct: 18, deltaColor: 'neutral' },
    trend: {
      '日': [0, 0, 0, 1, 2, 3, 4, 6, 4, 3, 2, 3, 4, 3, 2, 3, 4, 6, 5, 4, 3, 2, 1, 0],
      '週': [38, 45, 52, 48, 44, 68, 55],
      '月': [18, 24, 22, 30, 26, 32, 28, 22, 20, 26, 30, 24, 20, 24, 32, 36, 28, 24, 22, 20, 28, 30, 24, 22, 20, 26, 24, 30, 28, 22],
      '年': [320, 345, 380, 410, 425, 460, 480, 470, 410, 380, 360, 392],
    },
    trendYMax: { '日': 8, '週': 80, '月': 40, '年': 500 },
    month: { label: '本月累積感應', value: 392, target: 600 },
    maint: [
      { id: 'battery', icon: 'filter', name: '電池檢查',   last: '2024/04/10', next: '2024/07/10', status: 'ok',   label: '正常' },
      { id: 'sensor',  icon: 'core',   name: '感應器校正', last: '2024/03/22', next: '2024/06/22', status: 'warn', label: '即將到期' },
      { id: 'hinge',   icon: 'fan',    name: '鉸鏈潤滑',   last: '2024/02/15', next: '2024/08/15', status: 'ok',   label: '正常' },
      { id: 'lock',    icon: 'belt',   name: '鎖具檢查',   last: '2024/05/01', next: '2024/11/01', status: 'ok',   label: '正常' },
    ],
  },
}

/* Generic fallback for known appliances we don't have specific mock data for */
function makeFallback(label) {
  return {
    name: label,
    metric: '狀態資訊',
    unit: '單位',
    today: { label: '即時讀值', value: '--', deltaPct: 0, deltaColor: 'neutral' },
    trend: {
      '日': Array(24).fill(0).map(() => 10 + Math.random() * 30),
      '週': Array(7).fill(0).map(() => 100 + Math.random() * 100),
      '月': Array(30).fill(0).map(() => 15 + Math.random() * 25),
      '年': Array(12).fill(0).map(() => 500 + Math.random() * 600),
    },
    trendYMax: { '日': 50, '週': 250, '月': 50, '年': 1200 },
    month: { label: '本月累積', value: 0, target: 1000 },
    maint: [
      { id: 'a', icon: 'filter', name: '定期保養', last: '----/--/--', next: '----/--/--', status: 'ok', label: '正常' },
    ],
  }
}

const TREND_X_LABELS = {
  '日': ['00', '04', '08', '12', '16', '20', '24'],
  '週': ['一', '二', '三', '四', '五', '六', '日'],
  '月': ['1', '5', '10', '15', '20', '25', '30'],
  '年': ['1', '3', '5', '7', '9', '11', '12'],
}

/* ── Maintenance icons ──────────────────────────────────────────────────────── */
function MaintIcon({ kind }) {
  const c = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }
  if (kind === 'filter') return <svg {...c}><path d="M4 5h16M5 9h14M6 13h12M8 17h8M10 21h4" /></svg>
  if (kind === 'core')   return <svg {...c}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 9h16M4 14h16M9 4v16M14 4v16" /></svg>
  if (kind === 'fan')    return <svg {...c}><circle cx="12" cy="12" r="2.4" /><path d="M12 4a4 4 0 0 1 4 4M20 12a4 4 0 0 1-4 4M12 20a4 4 0 0 1-4-4M4 12a4 4 0 0 1 4-4" /></svg>
  if (kind === 'belt')   return <svg {...c}><ellipse cx="12" cy="12" rx="9" ry="5.5" /><ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(28 12 12)" /></svg>
  return null
}

/* ── Idle / wait state ─────────────────────────────────────────────────────── */
function IdleView({ wsStatus }) {
  const isOnline = wsStatus === 'connected'
  return (
    <div className="info-panel">
      <div className="device-dash device-dash--idle">
        <h2 className="device-dash__title">
          <span className="device-dash__title-brace">[</span>
          {isOnline ? '感應 待機 中' : '系統 離線'}
          <span className="device-dash__title-brace">]</span>
        </h2>

        <div className="idle-card">
          <div className="idle-card__pulse"><span /><span /><span /></div>
          <div className="idle-card__title">請將物件放上感應區</div>
          <div className="idle-card__hint">
            感應後將顯示該家電的即時用電、累積消耗與預測性維護排程
          </div>
        </div>

        <div className="idle-foot">
          <div className="idle-foot__row">
            <span className="idle-foot__key">系統狀態</span>
            <span className={`idle-foot__val${isOnline ? ' is-ok' : ' is-err'}`}>
              {isOnline ? '正常運作' : 'NFC 服務離線'}
            </span>
          </div>
          <div className="idle-foot__row">
            <span className="idle-foot__key">資料來源</span>
            <span className="idle-foot__val">Welltek IoT Cloud</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Unknown card ─────────────────────────────────────────────────────────── */
function UnknownView({ uid }) {
  return (
    <div className="info-panel">
      <div className="device-dash device-dash--idle">
        <h2 className="device-dash__title">
          <span className="device-dash__title-brace">[</span>
          未 知 物 件
          <span className="device-dash__title-brace">]</span>
        </h2>
        <div className="idle-card">
          <div className="idle-card__title">無對應家電資料</div>
          <div className="idle-card__hint">UID: <code>{uid}</code></div>
        </div>
      </div>
    </div>
  )
}

/* ── Dashboard ──────────────────────────────────────────────────────────────── */
function DashboardView({ data }) {
  const range = '日'
  const trend  = data.trend[range]
  const yMax   = data.trendYMax[range]
  const xLabels = TREND_X_LABELS[range]
  const yTicks = [yMax, yMax * 0.8, yMax * 0.6, yMax * 0.4, yMax * 0.2, 0]

  const deltaSign = data.today.deltaPct < 0 ? '↓' : data.today.deltaPct > 0 ? '↑' : '·'
  const monthPct  = Math.round((data.month.value / data.month.target) * 100)

  return (
    <div className="info-panel">
      <div className="device-dash" key={data.name /* re-mount on appliance change → fresh transitions */}>

        <h2 className="device-dash__title">
          <span className="device-dash__title-brace">[</span>
          {data.name}{data.metric}
          <span className="device-dash__title-brace">]</span>
        </h2>

        {/* Today */}
        <section className="device-card">
          <div className="device-card__label">{data.today.label}</div>
          <div className="usage-stat">
            <span className="usage-stat__value">{data.today.value}</span>
            <span className="usage-stat__unit">{data.unit}</span>
            <span className={`usage-stat__delta is-${data.today.deltaColor}`}>
              <span className="usage-stat__delta-pct">
                {deltaSign} {Math.abs(data.today.deltaPct)}%
              </span>
              <span className="usage-stat__delta-label">較昨日</span>
            </span>
          </div>
        </section>

        {/* Trend */}
        <section className="device-card">
          <div className="device-card__head">
            <div className="device-card__label">{data.metric}趨勢</div>
            <div className="range-tabs">
              {['日', '週', '月', '年'].map(r => (
                <span key={r} className={`range-tab${r === range ? ' active' : ''}`}>{r}</span>
              ))}
            </div>
          </div>
          <div className="trend-chart">
            <div className="trend-chart__unit">{data.unit}</div>
            <div className="trend-chart__yaxis">
              {yTicks.map(t => <span key={t}>{Math.round(t)}</span>)}
            </div>
            <div className="trend-chart__plot">
              {trend.map((v, i) => (
                <div
                  key={i}
                  className="trend-chart__bar"
                  style={{ height: `${(v / yMax) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <div className="trend-chart__xaxis">
            {xLabels.map(l => <span key={l}>{l}</span>)}
          </div>
        </section>

        {/* Monthly cumulative */}
        <section className="device-card">
          <div className="device-card__label">{data.month.label}</div>
          <div className="cumulative">
            <div className="cumulative__head">
              <div className="usage-stat">
                <span className="usage-stat__value">{data.month.value}</span>
                <span className="usage-stat__unit">{data.unit}</span>
              </div>
              <div className="cumulative__target">
                目標 {data.month.target.toLocaleString()} {data.unit}
              </div>
            </div>
            <div className="cumulative__bar">
              <div className="cumulative__fill" style={{ width: `${monthPct}%` }} />
            </div>
            <div className="cumulative__meta">
              <span>目標 達 成 限</span>
              <span className="cumulative__pct">{monthPct}%</span>
            </div>
          </div>
        </section>

        {/* Maintenance */}
        <section className="device-card">
          <div className="device-card__label">維養排程</div>
          <div className="maint-table">
            <div className="maint-row maint-row--head">
              <span />
              <span>項目</span>
              <span>上次維養</span>
              <span>下次維養</span>
              <span>狀態</span>
            </div>
            {data.maint.map(item => (
              <div key={item.id} className="maint-row">
                <span className="maint-row__icon"><MaintIcon kind={item.icon} /></span>
                <span className="maint-row__name">{item.name}</span>
                <span className="maint-row__date">{item.last}</span>
                <span className="maint-row__date">{item.next}</span>
                <span className={`maint-row__status maint-row__status--${item.status}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

/* ── InfoPanel root ────────────────────────────────────────────────────────── */
export default function InfoPanel({ wsStatus, focusedState }) {
  const card = focusedState?.activeCard

  // No card on focused slot → idle/wait state
  if (!card) return <IdleView wsStatus={wsStatus} />

  // Card present but UID not registered → unknown state
  if (!card.known) return <UnknownView uid={card.uid} />

  // Known card → look up appliance dataset (fallback if id has no specific data)
  const id   = card.data.id
  const data = APPLIANCES[id] || makeFallback(card.data.label || id)

  return <DashboardView data={data} />
}
