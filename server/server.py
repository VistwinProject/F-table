"""
NFC WebSocket server — multi-reader build
支援最多 9 台 ACR122U 同時連線，各自對應 slot_index 0-8
"""
import asyncio
import json
import os

from smartcard.System import readers as get_readers

# ── uid-map ───────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
UID_MAP_PATH = os.path.join(SCRIPT_DIR, 'uid-map.json')
uid_map: dict = {}
try:
    with open(UID_MAP_PATH, 'r', encoding='utf-8') as f:
        uid_map = json.load(f)
    print(f'[MAP]  Loaded {len(uid_map)} UID entries')
except Exception as e:
    print(f'[MAP]  uid-map.json: {e}')

# ── Config ────────────────────────────────────────────────────────────────────
WS_PORT      = 8787
POLL_SEC     = 0.3
GET_UID_APDU = [0xFF, 0xCA, 0x00, 0x00, 0x00]
MAX_SLOTS    = 9

# ── Per-slot state (index 0-8) ────────────────────────────────────────────────
def _empty_slot():
    return {'connected': False, 'reader_name': '', 'last_uid': None, 'current_card': None}

slot_state: list[dict] = [_empty_slot() for _ in range(MAX_SLOTS)]

# reader_name → assigned slot_index
reader_to_slot: dict[str, int] = {}

# ── WebSocket clients ─────────────────────────────────────────────────────────
clients: set = set()

async def broadcast(payload: dict):
    msg = json.dumps(payload, ensure_ascii=False)
    dead = set()
    for ws in list(clients):
        try:
            await ws.send(msg)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)

async def ws_handler(websocket):
    clients.add(websocket)
    print('[WS]   Client connected')
    try:
        # Send full current state to new client
        for i, state in enumerate(slot_state):
            if state['connected']:
                await websocket.send(json.dumps({
                    'type': 'reader-connected',
                    'slot_index': i,
                    'reader': state['reader_name'],
                }))
            if state['current_card']:
                await websocket.send(json.dumps(state['current_card']))
        await websocket.wait_closed()
    finally:
        clients.discard(websocket)
        print('[WS]   Client disconnected')

# ── Slot assignment ───────────────────────────────────────────────────────────
def assign_slot(reader_name: str) -> int:
    """Return next free slot index, or -1 if all full."""
    used = set(reader_to_slot.values())
    for i in range(MAX_SLOTS):
        if i not in used:
            return i
    return -1

# ── NFC polling loop ──────────────────────────────────────────────────────────
async def nfc_loop():
    print(f'[NFC]  Polling every {int(POLL_SEC * 1000)} ms — connect ACR122U readers.')

    while True:
        try:
            available     = get_readers()
            current_names = {str(r) for r in available}
            known_names   = set(reader_to_slot.keys())

            # ── New readers ───────────────────────────────────────────────────
            for reader in available:
                rname = str(reader)
                if rname not in reader_to_slot:
                    idx = assign_slot(rname)
                    if idx < 0:
                        print(f'[NFC]  No free slot for: {rname}')
                        continue
                    reader_to_slot[rname] = idx
                    slot_state[idx].update({'connected': True, 'reader_name': rname})
                    print(f'[NFC]  Slot {idx}: {rname}')
                    await broadcast({'type': 'reader-connected', 'slot_index': idx, 'reader': rname})

            # ── Removed readers ───────────────────────────────────────────────
            for rname in known_names - current_names:
                idx = reader_to_slot.pop(rname)
                slot_state[idx] = _empty_slot()
                print(f'[NFC]  Slot {idx} disconnected ({rname})')
                await broadcast({'type': 'reader-disconnected', 'slot_index': idx})

            # ── Poll each connected reader for a card ─────────────────────────
            for reader in available:
                rname = str(reader)
                if rname not in reader_to_slot:
                    continue
                idx   = reader_to_slot[rname]
                state = slot_state[idx]

                try:
                    conn = reader.createConnection()
                    conn.connect()
                    data, sw1, sw2 = conn.transmit(GET_UID_APDU)
                    conn.disconnect()

                    if sw1 == 0x90 and sw2 == 0x00:
                        uid = ''.join(f'{b:02X}' for b in data)
                        if uid != state['last_uid']:          # debounce
                            state['last_uid'] = uid
                            card_data = uid_map.get(uid)
                            known     = card_data is not None
                            label     = card_data['label'] if known else '(unknown)'
                            print(f'[NFC]  Slot[{idx}] {uid} → {label}')

                            event = {
                                'type':       'tag-present',
                                'slot_index': idx,
                                'uid':        uid,
                                'known':      known,
                                'data':       card_data,
                            }
                            state['current_card'] = event
                            await broadcast(event)

                            # ── OSC placeholder ───────────────────────────────
                            # if known and card_data.get('osc'):
                            #     osc_client.send(card_data['osc'], idx)

                    else:
                        if state['last_uid'] is not None:
                            state['last_uid']     = None
                            state['current_card'] = None
                            print(f'[NFC]  Slot[{idx}] card removed')
                            await broadcast({'type': 'tag-remove', 'slot_index': idx})

                except Exception:
                    if state['last_uid'] is not None:
                        state['last_uid']     = None
                        state['current_card'] = None
                        print(f'[NFC]  Slot[{idx}] card removed')
                        await broadcast({'type': 'tag-remove', 'slot_index': idx})

        except Exception as e:
            print(f'[NFC]  Error: {e}')

        await asyncio.sleep(POLL_SEC)

# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    import websockets
    print(f'[WS]   WebSocket server on ws://localhost:{WS_PORT}')
    async with websockets.serve(ws_handler, 'localhost', WS_PORT):
        print(f'[WS]   Ready.')
        await nfc_loop()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\n[WS]   Stopped.')
