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
let readerConnected = false;
let readerName      = '';
let currentCard     = null;   // last tag-present event object, or null
let lastUid         = null;   // debounce: skip if same UID fires again

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

wss.on('connection', (ws) => {
  console.log('[WS]   Client connected');
  // Send current state to the newly connected client
  if (readerConnected) {
    ws.send(JSON.stringify({ type: 'reader-connected', reader: readerName }));
  } else {
    ws.send(JSON.stringify({ type: 'reader-disconnected' }));
  }
  if (currentCard) ws.send(JSON.stringify(currentCard));
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
    readerName      = reader.reader.name;
    readerConnected = true;
    console.log(`[NFC]  Reader connected: ${readerName}`);
    broadcast({ type: 'reader-connected', reader: readerName });

    // ── Card placed ───────────────────────────────────────────────────────────
    reader.on('card', (card) => {
      const uid = normalizeUid(card.uid);

      if (!uid) {
        console.warn('[NFC]  Card detected but UID is empty — skipping');
        return;
      }
      if (uid === lastUid) return;   // debounce: same card still on reader
      lastUid = uid;

      const data  = uidMap[uid] ?? null;
      const known = data !== null;
      console.log(`[NFC]  Card: ${uid}  →  ${known ? data.label : '(unknown)'}`);

      const event = { type: 'tag-present', uid, known, data };
      currentCard = event;
      broadcast(event);

      // ── OSC placeholder ───────────────────────────────────────────────────
      // Uncomment and install 'osc' package when ready for TouchDesigner:
      // if (known && data.osc) {
      //   oscClient.send({ address: data.osc, args: [{ type: 'i', value: 1 }] });
      // }
    });

    // ── Card removed ──────────────────────────────────────────────────────────
    reader.on('card.off', () => {
      console.log('[NFC]  Card removed');
      lastUid     = null;
      currentCard = null;
      broadcast({ type: 'tag-remove' });
    });

    reader.on('error', (err) => {
      console.error(`[NFC]  Reader error: ${err.message}`);
    });

    // ── Reader unplugged ──────────────────────────────────────────────────────
    reader.on('end', () => {
      console.log(`[NFC]  Reader disconnected: ${readerName}`);
      readerConnected = false;
      readerName      = '';
      lastUid         = null;
      currentCard     = null;
      broadcast({ type: 'reader-disconnected' });
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
