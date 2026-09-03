'use strict';

const WebSocket = require('ws');
const fs        = require('fs');
const path      = require('path');

// ── Load UID map ──────────────────────────────────────────────────────────────
const UID_MAP_PATH = path.join(__dirname, 'uid-map.json');
let uidMap = {};
try {
  uidMap = JSON.parse(fs.readFileSync(UID_MAP_PATH, 'utf8'));
  console.log(`[MAP]  Loaded ${Object.keys(uidMap).length} UID entries`);
} catch {
  console.warn('[MAP]  uid-map.json not found or invalid — using empty map');
}

// ── State ─────────────────────────────────────────────────────────────────────
const SLOT_COUNT = 9;

// ── Load reader map（讀卡機名稱 → 桌面實體位置）─────────────────────────────────
// 桌面端畫面上的 9 個圈圈 NFC 01–09 是綁 slot_index 的固定位置（web/src/App.jsx SLOTS）。
// 沒有這張表的話 slot 是「依偵測順序」發號碼 —— USB 插入順序會決定桌上哪一台對到
// 畫面哪一個圈。要跟桌面實體位置對應，就在這裡把讀卡機名稱釘死。
//
// reader-map.json 格式（數字直接用畫面上的 NFC 編號 1–9，不是 0-based）：
//   { "ACS ACR122U PICC Interface 00": 1, "ACS ACR122U PICC Interface 01": 2 }
//
// 檔案不存在 → 全部自動配（＝現在的行為），現場還沒佈線時不會卡住。
const READER_MAP_PATH = path.join(__dirname, 'reader-map.json');
const pinnedSlot = new Map();   // readerName → slot index（0-based）

try {
  const raw = JSON.parse(fs.readFileSync(READER_MAP_PATH, 'utf8'));
  const usedSlots = new Map();  // slot index → readerName（抓重複用）

  for (const [name, num] of Object.entries(raw)) {
    if (!Number.isInteger(num) || num < 1 || num > SLOT_COUNT) {
      console.warn(`[MAP]  reader-map：「${name}」的值 ${JSON.stringify(num)} 不是 1–${SLOT_COUNT} 的整數 — 略過`);
      continue;
    }
    const idx = num - 1;
    if (usedSlots.has(idx)) {
      console.warn(`[MAP]  reader-map：NFC ${String(num).padStart(2, '0')} 被指定兩次（「${usedSlots.get(idx)}」與「${name}」）— 後者略過`);
      continue;
    }
    usedSlots.set(idx, name);
    pinnedSlot.set(name, idx);
  }
  console.log(`[MAP]  Loaded ${pinnedSlot.size} pinned reader positions`);
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('[MAP]  reader-map.json 不存在 — 讀卡機位置改為自動配號');
    console.log('[MAP]  （要對應桌面實體位置：照下方 reader 名稱建 reader-map.json，見 README）');
  } else {
    console.warn(`[MAP]  reader-map.json 解析失敗（${err.message}）— 改為自動配號`);
  }
}

// slot_index = 物理 reader 位置。三端以 data.id 路由家電（方案 A），但 tag-remove
// 只帶 slot_index，前端要靠它才知道熄滅哪一個 → 每則 reader/tag 訊息都必須帶。
// 狀態改成 per-slot：多台讀卡機時 debounce 與「補當前狀態」才不會互相蓋掉。
const slots = Array.from({ length: SLOT_COUNT }, () => ({
  connected:   false,
  readerName:  '',
  currentCard: null,   // 該 slot 最後一則 tag-present 事件，或 null
  lastUid:     null,   // debounce：同一張卡沒離開就不重複觸發
}));

// readerName → slot index。重插同一台讀卡機時沿用原本的位置。
const slotOfReader = new Map();

function assignSlot(name) {
  if (slotOfReader.has(name)) return slotOfReader.get(name);

  // 1) reader-map 有釘死 → 用指定的位置。
  const pinned = pinnedSlot.get(name);
  if (pinned !== undefined) {
    const holder = [...slotOfReader].find(([n, i]) => i === pinned && slots[i].connected);
    if (holder) {
      // 指定的位置被別台佔著（多半是 reader-map 名稱寫錯）→ 退回自動配，不要蓋掉現場已在跑的那台。
      console.warn(`[MAP]  「${name}」指定 NFC ${String(pinned + 1).padStart(2, '0')}，但該位置被「${holder[0]}」佔用 — 改自動配`);
    } else {
      slotOfReader.set(name, pinned);
      return pinned;
    }
  }

  // 2) 自動配：跳過所有「已被 reader-map 預留」的位置，
  //    免得臨時插上的機器佔走某台還沒開機的讀卡機該有的圈。
  const taken = new Set([...slotOfReader.values(), ...pinnedSlot.values()]);
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (!taken.has(i)) { slotOfReader.set(name, i); return i; }
  }

  // 3) 預留位置把 9 格佔滿了、又來一台沒登記的 → 讓它用剩下沒人連線的格子。
  const free = [...slotOfReader.values()];
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (!free.includes(i) && !slots[i].connected) { slotOfReader.set(name, i); return i; }
  }
  return -1;   // 9 格全滿
}

// 現場佈線用：每次讀卡機上下線就印出目前的對應表，方便照抄進 reader-map.json。
function logReaderTable() {
  console.log('[MAP]  ── 目前讀卡機對應 ──────────────────────────────');
  for (let i = 0; i < SLOT_COUNT; i++) {
    const s = slots[i];
    const label = `NFC ${String(i + 1).padStart(2, '0')}`;
    if (!s.connected) { console.log(`[MAP]    ${label}  —`); continue; }
    const how = pinnedSlot.get(s.readerName) === i ? '釘選' : '自動';
    console.log(`[MAP]    ${label}  ${s.readerName}   (${how})`);
  }
  console.log('[MAP]  ──────────────────────────────────────────────');
}

// session 權威狀態：'welcome' | 'live'。由任一端送 session-start / session-end 驅動。
let sessionMode = 'welcome';

// ── 鍵盤模擬 NFC（開發用，預設關閉）───────────────────────────────────────────
//
//   npm start -- --sim        或   SIM=1 npm start
//
// 為什麼做在 server 而不是做在某一端的瀏覽器裡：模擬出來的必須是【真的】
// tag-present / tag-remove 廣播，三端才會一起亮 —— 那正是要看的東西。
// 各端自己模擬只會讓那一端亮，看不出同步。
//
// ⚠ 現場【不要】帶這個旗標。沒帶就完全不存在，sim-key 訊息會被忽略。
const SIM = process.argv.includes('--sim') || process.env.SIM === '1';
let warnedNoSim = false;   // 沒帶 --sim 卻收到 sim-key 時只提醒一次

// 九台的 id 是三端 freeze 過的，順序＝鍵盤 1–9。
const SIM_IDS = ['hrv', 'ac', 'dehum', 'purifier', 'sensor', 'light', 'socket', 'curtain', 'bathfan'];
const SIM_LABELS = {
  hrv: '新風機', ac: '冷氣', dehum: '除濕機', purifier: '空氣清淨機',
  sensor: '12合一感測器', light: '燈', socket: '智慧插座',
  curtain: '窗簾', bathfan: '浴室暖風機',
};
// uid-map 裡有登記的就沿用真資料（label / description / osc 都一致），
// 沒登記的（目前有四台）就照同樣的形狀補一份，前端才不會走到 unknown 分支。
const simCard = (id) => {
  const hit = Object.entries(uidMap).find(([, v]) => v.id === id);
  if (hit) return { uid: hit[0], data: hit[1] };
  return { uid: `SIM-${id.toUpperCase()}`, data: { id, label: SIM_LABELS[id] ?? id, description: '（鍵盤模擬）' } };
};

function simPlace(i) {
  const st = slots[i];
  const { uid, data } = simCard(SIM_IDS[i]);
  st.lastUid = uid;
  const event = { type: 'tag-present', slot_index: i, uid, known: true, data };
  st.currentCard = event;
  broadcast(event);
  console.log(`[SIM]  放上 [NFC ${String(i + 1).padStart(2, '0')}] ${data.label}`);
}

function simRemove(i) {
  const st = slots[i];
  st.lastUid = null;
  st.currentCard = null;
  broadcast({ type: 'tag-remove', slot_index: i });
  console.log(`[SIM]  拿走 [NFC ${String(i + 1).padStart(2, '0')}] ${SIM_LABELS[SIM_IDS[i]]}`);
}

// key: '1'–'9' 切換該台、'0' 全部拿走、'a' 全部放上。
function simKey(key) {
  if (!SIM) return;
  // 還在歡迎頁就先開場 —— 否則按了 1 什麼都不會發生（卡片有進來，但三端還沒切到主畫面），
  // 預覽時很容易誤以為壞掉。
  if (sessionMode !== 'live' && key !== '0') {
    sessionMode = 'live';
    console.log('[SIM]  自動開場（session-start）');
    broadcast({ type: 'session-start' });
  }
  if (key === '0') {
    slots.forEach((st, i) => { if (st.currentCard) simRemove(i); });
    return;
  }
  if (key === 'a' || key === 'A') {
    slots.forEach((st, i) => { if (!st.currentCard) simPlace(i); });
    return;
  }
  const n = parseInt(key, 10);
  if (!(n >= 1 && n <= SLOT_COUNT)) return;
  const i = n - 1;
  if (slots[i].currentCard) simRemove(i); else simPlace(i);
}

// ── WebSocket server ──────────────────────────────────────────────────────────
const WS_PORT = 8787;
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`[WS]   WebSocket server on ws://localhost:${WS_PORT}`);

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

if (SIM) {
  // 九個虛擬讀卡機直接標成在線 —— 三端的 slot 才會顯示「可放置」而不是離線。
  // ⚠ 真的讀卡機插上來時 assignSlot() 會看到 slots[i].connected 是 true 而跳過，
  //    所以 --sim 與真硬體【不要】同時用。
  slots.forEach((st, i) => { st.connected = true; st.readerName = `SIM-${i}`; });
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║  鍵盤模擬 NFC 已啟用（--sim）                        ║');
  console.log('  ║                                                      ║');
  console.log('  ║   1–9  放上／拿走該台家電                            ║');
  console.log('  ║   a    全部放上（看「全屋連動完成」）                 ║');
  console.log('  ║   0    全部拿走                                      ║');
  console.log('  ║                                                      ║');
  console.log('  ║  這個視窗可以直接按；三個畫面的視窗也可以直接按，     ║');
  console.log('  ║  不管在哪按，三端都會同時反應。                       ║');
  console.log('  ║  ⚠ 現場不要帶 --sim。                                ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
  SIM_IDS.forEach((id, i) => console.log(`  ${i + 1} = ${SIM_LABELS[id]}`));
  console.log('');

  // 終端機直接按鍵（不用切到瀏覽器）。沒有 TTY（被管線接走）時就跳過。
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (k) => {
      if (k === '\u0003') { console.log(''); process.exit(0); }   // Ctrl+C
      simKey(k);
    });
  }
}

wss.on('connection', (ws) => {
  console.log('[WS]   Client connected');

  // 補當前狀態給新連上的客戶端：已上線的 reader、其上的卡片，以及目前 session 模式。
  // （未連線的 slot 不用送 — 三端本來就以「全部離線」為初始狀態。）
  slots.forEach((s, i) => {
    if (!s.connected) return;
    ws.send(JSON.stringify({ type: 'reader-connected', slot_index: i, reader: s.readerName }));
    if (s.currentCard) ws.send(JSON.stringify(s.currentCard));
  });
  ws.send(JSON.stringify({ type: sessionMode === 'live' ? 'session-start' : 'session-end' }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    // ── Session 控制 ──────────────────────────────────────────────────────────
    // 平板歡迎頁 / 重置鈕（日後工作人員控制端同理）送出，server 更新權威狀態後
    // 轉發給「所有」客戶端 —— 含送出者，因為前端是等收到廣播才切畫面，
    // 不是送出當下就本地切（見 F-Ipad useNfcSync.js 的 startSession / endSession）。
    if (msg.type === 'session-start' || msg.type === 'session-end') {
      sessionMode = msg.type === 'session-start' ? 'live' : 'welcome';
      console.log(`[WS]   Session → ${sessionMode}`);
      broadcast({ type: msg.type });
    }

    // 任一端的鍵盤 1–9 會送這則過來（見各端的 shared/simKeys.js）。
    // ⚠ 沒有 --sim 就直接忽略 —— 現場不會因為誰誤按而亮起來。
    //    但要講一聲，不然「按了沒反應」很難查。
    if (msg.type === 'sim-key' && typeof msg.key === 'string') {
      if (SIM) { simKey(msg.key); }
      else if (!warnedNoSim) {
        warnedNoSim = true;
        console.warn('[WS]   收到鍵盤模擬（sim-key）但這個 server 沒帶 --sim，已忽略。');
        console.warn('[WS]   要用鍵盤模擬 NFC 請改用：  npm run sim');
      }
    }
  });

  ws.on('error', (err) => console.error(`[WS]   Client error: ${err.message}`));
});

// ── Helper ────────────────────────────────────────────────────────────────────
function normalizeUid(raw) {
  // Remove colons, spaces, dashes; convert to uppercase
  return String(raw || '').toUpperCase().replace(/[:\s\-]/g, '');
}

// ── NFC via nfc-pcsc ──────────────────────────────────────────────────────────
try {
  const { NFC } = require('nfc-pcsc');
  const nfc = new NFC();

  nfc.on('reader', (reader) => {
    const name = reader.reader.name;
    const slot = assignSlot(name);

    if (slot === -1) {
      console.error(`[NFC]  No free slot for reader (max ${SLOT_COUNT}): ${name}`);
      return;
    }

    const st = slots[slot];
    st.connected  = true;
    st.readerName = name;
    console.log(`[NFC]  Reader connected [NFC ${String(slot + 1).padStart(2, '0')}]: ${name}`);
    if (!pinnedSlot.has(name)) {
      console.warn(`[MAP]  ⚠ 「${name}」不在 reader-map.json — 位置是自動配的，可能對不到桌面實體位置`);
    }
    broadcast({ type: 'reader-connected', slot_index: slot, reader: name });
    logReaderTable();

    // ── Card placed ───────────────────────────────────────────────────────────
    reader.on('card', (card) => {
      const uid = normalizeUid(card.uid);

      if (!uid) {
        console.warn('[NFC]  Card detected but UID is empty — skipping');
        return;
      }
      if (uid === st.lastUid) return;   // debounce: same card still on reader
      st.lastUid = uid;

      const data  = uidMap[uid] ?? null;
      const known = data !== null;
      console.log(`[NFC]  Card [NFC ${String(slot + 1).padStart(2, '0')}]: ${uid}  →  ${known ? data.label : '(unknown — 未登記在 uid-map.json)'}`);

      const event = { type: 'tag-present', slot_index: slot, uid, known, data };
      st.currentCard = event;
      broadcast(event);

      // ── OSC placeholder ───────────────────────────────────────────────────
      // Uncomment and install 'osc' package when ready for TouchDesigner:
      // if (known && data.osc) {
      //   oscClient.send({ address: data.osc, args: [{ type: 'i', value: 1 }] });
      // }
    });

    // ── Card removed ──────────────────────────────────────────────────────────
    reader.on('card.off', () => {
      console.log(`[NFC]  Card removed [NFC ${String(slot + 1).padStart(2, '0')}]`);
      st.lastUid     = null;
      st.currentCard = null;
      broadcast({ type: 'tag-remove', slot_index: slot });
    });

    reader.on('error', (err) => {
      console.error(`[NFC]  Reader error: ${err.message}`);
    });

    // ── Reader unplugged ──────────────────────────────────────────────────────
    reader.on('end', () => {
      console.log(`[NFC]  Reader disconnected [NFC ${String(slot + 1).padStart(2, '0')}]: ${name}`);
      st.connected   = false;
      st.readerName  = '';
      st.lastUid     = null;
      st.currentCard = null;
      // slotOfReader 保留對應，重插同一台讀卡機時回到原本的 slot。
      broadcast({ type: 'reader-disconnected', slot_index: slot });
      logReaderTable();
    });
  });

  nfc.on('error', (err) => {
    console.error(`[NFC]  NFC error: ${err.message}`);
    if (/NO_SERVICE|no_service|no readers/i.test(err.message)) {
      console.error('[NFC]  PC/SC service may not be running, or no reader is connected.');
      console.error('[NFC]  Server continues — plug in ACR122U and it will be detected.');
    }
  });

  console.log('[NFC]  Waiting for readers...');

} catch (err) {
  console.error('');
  console.error('[NFC]  !! Failed to load nfc-pcsc:', err.message);
  console.error('[NFC]     WebSocket server is still running (NFC features disabled).');
  console.error('[NFC]     Fix: run  cd server && npm install');
  console.error('[NFC]     If install fails, see TROUBLESHOOTING in README.md');
  console.error('');
}
