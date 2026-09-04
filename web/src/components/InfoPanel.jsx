import { useState, useEffect, useRef } from 'react'

/* ── Mock appliance datasets ───────────────────────────────────────────────────
   Keyed by the `id` from uid-map.json. Each appliance has its own title, today
   stat, trend, monthly cumulative, and maintenance schedule. The page will
   route by `focusedState.activeCard.data.id`. When no card is active, the
   panel shows an idle/wait state. */

const APPLIANCES = {
  /* 新風機 / 全熱交換機 (HRV) */
  hrv: {
    name:   '新風機',
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

  /* 冷氣 (AC) */
  ac: {
    name:   '冷氣',
    metric: '用電量',
    unit:   'kWh',
    today: { label: '今日用電量', value: 41.2, deltaPct: 8, deltaColor: 'neutral' },
    trend: {
      '日': [5, 4, 4, 5, 6, 9, 14, 20, 30, 38, 46, 52, 56, 58, 55, 50, 47, 44, 42, 47, 52, 46, 30, 14],
      '週': [980, 1050, 1010, 1180, 1120, 890, 760],
      '月': [30, 35, 32, 42, 38, 46, 44, 36, 30, 40, 42, 38, 34, 40, 48, 52, 44, 38, 34, 30, 44, 48, 42, 36, 32, 46, 42, 50, 44, 36],
      '年': [820, 860, 900, 1020, 1180, 1340, 1440, 1400, 1180, 980, 890, 1124],
    },
    trendYMax: { '日': 60, '週': 1300, '月': 60, '年': 1500 },
    month: { label: '本月累積用電量', value: 1124.0, target: 1500 },
    maint: [
      { id: 'filter', icon: 'filter', name: '濾網清潔', last: '2026/05/01', next: '2026/06/01', status: 'warn', label: '即將到期' },
      { id: 'gas',    icon: 'core',   name: '冷媒檢查', last: '2026/03/15', next: '2026/09/15', status: 'ok',   label: '正常' },
      { id: 'coil',   icon: 'fan',    name: '盤管清潔', last: '2026/04/10', next: '2026/10/10', status: 'ok',   label: '正常' },
    ],
  },

  /* 除濕機 (Dehumidifier) */
  dehum: {
    name:   '除濕機',
    metric: '用電量',
    unit:   'kWh',
    today: { label: '今日用電量', value: 12.4, deltaPct: -6, deltaColor: 'good' },
    trend: {
      '日': [0.7, 0.75, 0.8, 0.8, 0.75, 0.6, 0.45, 0.35, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.5, 0.45, 0.5, 0.6, 0.75, 0.9, 1.05, 1.1, 1, 0.85],
      '週': [12, 13.5, 12.8, 14.6, 13.2, 11, 10.2],
      '月': [11, 12.5, 12, 13.8, 13, 14.5, 13.6, 12, 10.8, 12.8, 13.4, 12.2, 11.4, 12.8, 14, 14.8, 13.2, 12.4, 11.2, 10.6, 13, 14.2, 12.6, 11.8, 10.8, 13.6, 12.8, 14.4, 13.2, 11.6],
      '年': [268, 252, 296, 358, 412, 448, 462, 456, 402, 348, 310, 343],
    },
    trendYMax: { '日': 1.5, '週': 20, '月': 20, '年': 500 },
    month: { label: '本月累積用電量', value: 342.8, target: 500 },
    maint: [
      { id: 'filter', icon: 'filter', name: '濾網清潔',   last: '2026/05/16', next: '2026/06/16', status: 'warn', label: '即將到期' },
      { id: 'tank',   icon: 'core',   name: '水箱清潔',   last: '2026/04/28', next: '2026/07/28', status: 'ok',   label: '正常' },
      { id: 'comp',   icon: 'fan',    name: '壓縮機檢查', last: '2026/03/12', next: '2026/09/12', status: 'ok',   label: '正常' },
      { id: 'drain',  icon: 'belt',   name: '排水管檢查', last: '2026/04/05', next: '2026/10/05', status: 'ok',   label: '正常' },
    ],
  },

  /* 空氣清淨機 (Air Purifier) */
  purifier: {
    name:   '空氣清淨機',
    metric: '用電量',
    unit:   'kWh',
    today: { label: '今日用電量', value: 8.2, deltaPct: -4, deltaColor: 'good' },
    trend: {
      '日': [0.28, 0.28, 0.26, 0.26, 0.28, 0.32, 0.4, 0.48, 0.42, 0.34, 0.3, 0.3, 0.32, 0.3, 0.34, 0.4, 0.46, 0.52, 0.56, 0.54, 0.48, 0.42, 0.36, 0.3],
      '週': [8.4, 8.8, 8.6, 9.2, 8.2, 7.4, 7],
      '月': [7.6, 8.2, 8, 8.8, 8.4, 9, 8.6, 8, 7.4, 8.4, 8.8, 8.2, 7.8, 8.4, 9, 9.4, 8.6, 8.2, 7.6, 7.4, 8.6, 9, 8.4, 8, 7.6, 8.8, 8.4, 9.2, 8.6, 8],
      '年': [212, 205, 238, 262, 274, 286, 292, 288, 268, 244, 226, 237],
    },
    trendYMax: { '日': 0.8, '週': 12, '月': 12, '年': 350 },
    month: { label: '本月累積用電量', value: 236.5, target: 350 },
    maint: [
      { id: 'hepa',  icon: 'filter', name: 'HEPA 濾網更換', last: '2026/05/08', next: '2026/06/08', status: 'warn', label: '即將到期' },
      { id: 'pre',   icon: 'core',   name: '前置濾網清潔',  last: '2026/05/22', next: '2026/07/22', status: 'ok',   label: '正常' },
      { id: 'calib', icon: 'fan',    name: '感測器校正',    last: '2026/03/18', next: '2026/09/18', status: 'ok',   label: '正常' },
      { id: 'duct',  icon: 'belt',   name: '風道清潔',      last: '2026/04/14', next: '2026/10/14', status: 'ok',   label: '正常' },
    ],
  },

  /* 12合一感測器 (Sensor) */
  sensor: {
    name:   '12合一感測器',
    metric: '偵測次數',
    unit:   '次',
    today: { label: '今日偵測', value: 156, deltaPct: 5, deltaColor: 'neutral' },
    trend: {
      '日': [3, 2, 2, 2, 3, 5, 8, 11, 9, 7, 6, 6, 7, 6, 7, 8, 10, 13, 14, 12, 10, 8, 5, 3],
      '週': [148, 162, 155, 178, 166, 138, 130],
      '月': [140, 152, 146, 168, 158, 176, 166, 148, 134, 156, 164, 150, 142, 156, 170, 180, 162, 152, 138, 132, 158, 172, 154, 146, 134, 166, 156, 176, 162, 144],
      '年': [3980, 3860, 4120, 4280, 4420, 4560, 4620, 4580, 4380, 4180, 4020, 4280],
    },
    trendYMax: { '日': 16, '週': 220, '月': 220, '年': 6000 },
    month: { label: '本月累積偵測', value: 4280, target: 6000 },
    maint: [
      { id: 'battery', icon: 'filter', name: '電池檢查', last: '2026/05/02', next: '2026/06/02', status: 'warn', label: '即將到期' },
      { id: 'calib',   icon: 'core',   name: '感測校正', last: '2026/03/28', next: '2026/09/28', status: 'ok',   label: '正常' },
      { id: 'comm',    icon: 'fan',    name: '通訊測試', last: '2026/04/18', next: '2026/10/18', status: 'ok',   label: '正常' },
    ],
  },

  /* 燈 (Light) */
  light: {
    name:   '燈',
    metric: '用電量',
    unit:   'kWh',
    today: { label: '今日用電量', value: 6.8, deltaPct: -3, deltaColor: 'good' },
    trend: {
      '日': [0.3, 0.2, 0.2, 0.2, 0.4, 1, 1.5, 2.5, 2, 1.5, 1.2, 1, 1.2, 1, 1.6, 2.4, 4.5, 7.5, 9.5, 10.5, 8.5, 6, 3, 1],
      '週': [7, 7.5, 7, 7.2, 6.6, 5.8, 5.2],
      '月': [6.5, 7, 6.8, 7.4, 7, 7.8, 7.4, 6.6, 6, 7, 7.4, 6.8, 6.2, 7, 7.6, 8, 7.2, 6.8, 6.2, 6, 7.2, 7.6, 7, 6.6, 6.2, 7.4, 7, 7.8, 7.2, 6.6],
      '年': [220, 235, 210, 205, 195, 180, 170, 175, 190, 210, 230, 198],
    },
    trendYMax: { '日': 12, '週': 10, '月': 10, '年': 300 },
    month: { label: '本月累積用電量', value: 198.5, target: 300 },
    maint: [
      { id: 'led', icon: 'filter', name: 'LED 壽命', last: '2026/01/10', next: '2027/01/10', status: 'ok', label: '正常' },
      { id: 'dim', icon: 'core',   name: '調光校正', last: '2026/04/22', next: '2026/10/22', status: 'ok', label: '正常' },
    ],
  },

  /* 智慧插座 (Socket) */
  socket: {
    name:   '智慧插座',
    metric: '用電量',
    unit:   'kWh',
    today: { label: '今日用電量', value: 4.2, deltaPct: -5, deltaColor: 'good' },
    trend: {
      '日': [1, 0.8, 0.8, 0.9, 1, 1.5, 2.5, 3.5, 3, 2.5, 2, 1.8, 2, 1.8, 2.2, 2.8, 3.5, 4.5, 5.5, 6, 5, 4, 2.5, 1.5],
      '週': [4.5, 5, 4.8, 5.2, 4.6, 3.8, 3.4],
      '月': [4, 4.5, 4.2, 5, 4.6, 5.2, 5, 4.2, 3.8, 4.6, 5, 4.4, 4, 4.6, 5.2, 5.6, 4.8, 4.4, 4, 3.8, 4.8, 5.2, 4.6, 4.2, 3.8, 5, 4.6, 5.4, 4.8, 4.2],
      '年': [105, 110, 100, 98, 92, 85, 80, 82, 90, 100, 112, 92],
    },
    trendYMax: { '日': 8, '週': 8, '月': 8, '年': 150 },
    month: { label: '本月累積用電量', value: 92.4, target: 150 },
    maint: [
      { id: 'temp', icon: 'filter', name: '過熱偵測', last: '2026/05/18', next: '2026/06/18', status: 'ok', label: '正常' },
      { id: 'load', icon: 'core',   name: '負載校正', last: '2026/03/30', next: '2026/09/30', status: 'ok', label: '正常' },
    ],
  },

  /* 窗簾 (Curtain) */
  curtain: {
    name:   '窗簾',
    metric: '啟閉次數',
    unit:   '次',
    today: { label: '今日啟閉', value: 12, deltaPct: 0, deltaColor: 'neutral' },
    trend: {
      '日': [0, 0, 0, 0, 0, 1, 2, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 0],
      '週': [14, 18, 16, 20, 15, 10, 9],
      '月': [12, 14, 13, 16, 15, 18, 17, 13, 11, 15, 16, 13, 12, 15, 18, 20, 16, 14, 12, 11, 16, 18, 14, 13, 11, 17, 15, 19, 16, 13],
      '年': [280, 300, 290, 320, 340, 380, 400, 390, 340, 310, 295, 318],
    },
    trendYMax: { '日': 6, '週': 25, '月': 25, '年': 500 },
    month: { label: '本月累積啟閉', value: 318, target: 500 },
    maint: [
      { id: 'motor', icon: 'fan',  name: '馬達檢查', last: '2026/02/20', next: '2026/08/20', status: 'ok', label: '正常' },
      { id: 'rail',  icon: 'belt', name: '軌道潤滑', last: '2026/04/01', next: '2026/07/01', status: 'ok', label: '正常' },
    ],
  },

  /* 浴室暖風機 (Bathroom Fan) */
  bathfan: {
    name:   '浴室暖風機',
    metric: '運轉時數',
    unit:   'hr',
    today: { label: '今日運轉', value: 2.6, deltaPct: 10, deltaColor: 'neutral' },
    trend: {
      '日': [0, 0, 0, 0, 0, 0.1, 0.35, 0.5, 0.3, 0.1, 0, 0, 0.05, 0, 0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.6, 0.45, 0.25, 0.1],
      '週': [2.6, 2.8, 2.7, 3.1, 2.9, 3.4, 3.2],
      '月': [2.4, 2.7, 2.6, 3, 2.8, 3.2, 3, 2.6, 2.2, 2.8, 3, 2.6, 2.4, 2.8, 3.2, 3.4, 2.9, 2.7, 2.3, 2.2, 2.9, 3.2, 2.7, 2.5, 2.2, 3, 2.8, 3.3, 2.9, 2.5],
      '年': [92, 88, 78, 66, 58, 52, 48, 50, 56, 68, 82, 68],
    },
    trendYMax: { '日': 1.2, '週': 4, '月': 4, '年': 120 },
    month: { label: '本月累積運轉', value: 68.4, target: 100 },
    maint: [
      { id: 'filter', icon: 'filter', name: '濾網清潔',     last: '2026/05/14', next: '2026/06/14', status: 'warn', label: '即將到期' },
      { id: 'fan',    icon: 'fan',    name: '風扇檢查',     last: '2026/04/02', next: '2026/07/02', status: 'ok',   label: '正常' },
      { id: 'heater', icon: 'core',   name: '加熱元件檢查', last: '2026/02/26', next: '2026/08/26', status: 'ok',   label: '正常' },
      { id: 'duct',   icon: 'belt',   name: '排風管檢查',   last: '2026/03/20', next: '2026/09/20', status: 'ok',   label: '正常' },
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
  const c = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }
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
      <div className="device-dash device-dash--idle">
        <h2 className="device-dash__title">
          {isOnline ? '感應 待機 中' : '系統 離線'}
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
  )
}

/* ── Unknown card ─────────────────────────────────────────────────────────── */
function UnknownView({ uid }) {
  return (
      <div className="device-dash device-dash--idle">
        <h2 className="device-dash__title">
          未 知 物 件
        </h2>
        <div className="idle-card">
          <div className="idle-card__title">無對應家電資料</div>
          <div className="idle-card__hint">UID: <code>{uid}</code></div>
        </div>
      </div>
  )
}

/* ── Dashboard ──────────────────────────────────────────────────────────────── */
function DashboardView({ data }) {
  // ⚠ 固定顯示日檢視。原本這裡有一排「日 / 週 / 月 / 年」，但它是純 <span>、
  //   沒有任何點擊行為，而桌面是【投影】—— 觀眾切不了，擺著只會誤導，而且那一排
  //   要吃掉 38px 的高度（面板不能捲動，高度很珍貴）。
  //   data.trend / trendYMax / TREND_X_LABELS 其他三個區間的資料先留著沒刪，
  //   之後要做成會動的切換再接回來。
  const range = '日'
  const trend  = data.trend[range]
  const yMax   = data.trendYMax[range]
  const xLabels = TREND_X_LABELS[range]
  const yTicks = [yMax, yMax * 0.8, yMax * 0.6, yMax * 0.4, yMax * 0.2, 0]

  const deltaSign = data.today.deltaPct < 0 ? '↓' : data.today.deltaPct > 0 ? '↑' : '·'
  const monthPct  = Math.round((data.month.value / data.month.target) * 100)

  return (
      <div className="device-dash">

        <h2 className="device-dash__title">
          {data.name}{data.metric}
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

        {/* Trend —— ⚠ device-card--grow：這一張負責吸收面板剩下的高度。
            桌面是【投影】，捲不動，所以版面必須自己撐滿又不能溢出；維養排程
            2～4 列不等，差額就由這張圖吃掉（見 style.css 的 .device-card--grow）。 */}
        <section className="device-card device-card--grow">
          <div className="device-card__label">{data.metric}趨勢</div>
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
  )
}

/* ── Cross-fade swapper ─────────────────────────────────────────────────────────
   Smooths appliance/state changes (e.g. the 5s auto-rotation): when `viewKey`
   changes, the current content fades out, then the new content swaps in and
   fades in — instead of a hard cut. Content updates within the SAME viewKey
   (live data on the same appliance) pass through without a fade. */
const FADE_MS = 550  // slide-out duration; must match .panel-fade CSS transition
function FadeSwap({ viewKey, children }) {
  const [render, setRender] = useState(children)
  const [phase, setPhase]   = useState('in')   // 'in' (centred) | 'out' (slide left) | 'enter' (parked right)
  const lastKey = useRef(viewKey)
  const timer   = useRef(null)
  const timer2  = useRef(null)

  useEffect(() => {
    if (viewKey === lastKey.current) {
      setRender(children)          // same view → live-update content, no slide
      return
    }
    setPhase('out')                // view changed → current slides out to the left
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastKey.current = viewKey
      setRender(children)          // swap content
      setPhase('enter')            // park new content off-screen right (no transition)
      clearTimeout(timer2.current)
      // small delay so the 'enter' position paints before flipping to 'in',
      // otherwise the browser batches both and skips the slide
      timer2.current = setTimeout(() => setPhase('in'), 30)  // slide in from right
    }, FADE_MS)
  }, [viewKey, children])

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(timer2.current) }, [])

  return <div className={`panel-fade panel-fade--${phase}`}>{render}</div>
}

/* ── InfoPanel root ────────────────────────────────────────────────────────── */
export default function InfoPanel({ wsStatus, focusedState }) {
  const card = focusedState?.activeCard

  let viewKey, body
  if (!card) {
    viewKey = `idle:${wsStatus === 'connected'}`
    body = <IdleView wsStatus={wsStatus} />
  } else if (!card.known) {
    viewKey = `unknown:${card.uid}`
    body = <UnknownView uid={card.uid} />
  } else {
    const id   = card.data.id
    const data = APPLIANCES[id] || makeFallback(card.data.label || id)
    viewKey = `dash:${id}`
    body = <DashboardView data={data} />
  }

  return (
    <div className="info-panel">
      <FadeSwap viewKey={viewKey}>{body}</FadeSwap>
    </div>
  )
}
