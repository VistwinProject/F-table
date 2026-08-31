# NFC Web Control

展場互動系統：ACR122U → Node.js WebSocket → React 前端

---

## 架構

```
ACR122U (USB NFC Reader)
  └─ Windows PC/SC Driver
       └─ server/index.js  (Node.js + nfc-pcsc)
            └─ WebSocket ws://localhost:8787
                 └─ web/  (Vite + React)
                      └─ 投影 / 螢幕顯示
```

---

## 系統需求

| 項目 | 需求 |
|------|------|
| OS | Windows 10 / 11 |
| Node.js | 18 LTS 或以上 |
| ACR122U Driver | PC/SC（已安裝） |
| Chrome | 最新版 |

---

## 安裝

### 1. 安裝 server 相依套件

```bat
cd nfc-web-control\server
npm install
```

> **注意**：`nfc-pcsc` 含原生 C++ 模組。若 npm install 報錯，請看下方 TROUBLESHOOTING。

### 2. 安裝 web 相依套件

```bat
cd nfc-web-control\web
npm install
```

---

## 啟動

### 方法 A — 雙擊 start.bat（推薦）

直接雙擊專案根目錄的 `start.bat`。  
腳本會自動安裝相依、啟動 server、啟動 Vite、開啟 Chrome。

### 方法 B — 手動（兩個終端）

**終端 1（NFC Server）：**
```bat
cd nfc-web-control\server
npm start
```

**終端 2（Web）：**
```bat
cd nfc-web-control\web
npm run dev
```

然後開啟瀏覽器至 `http://localhost:5173`

---

## 測試

### 步驟 1：確認 WebSocket 能連線

1. 啟動 server（`npm start`）
2. 開啟 web 頁面
3. 左側面板應顯示「NFC 服務：已連線」

### 步驟 2：確認讀卡機被偵測

1. 插入 ACR122U
2. server 終端應顯示：`[NFC] Reader connected: ACS ACR122U PICC Interface`
3. 前端左側應顯示讀卡機名稱

### 步驟 3：刷卡測試

1. 將 NFC 卡片靠近 ACR122U
2. server 應顯示：`[NFC] Card: 04DA53A76F2681  →  大門`
3. 前端：
   - 對應 Slot（01）亮起
   - 左側顯示「大門」與說明文字
   - 連線圖顯示對應線段高亮

### 步驟 4：測試未知卡片

1. 用未在 uid-map.json 的卡片
2. 左側應顯示「未知卡片」與 UID
3. 複製該 UID 加入 uid-map.json

---

## 現場佈線：讀卡機對應桌面位置（reader-map.json）

桌面畫面上的 9 個圈圈 **NFC 01–09** 是綁 `slot_index` 的固定位置。若沒有 `reader-map.json`，
slot 會**依讀卡機被偵測到的順序**發號碼 —— 也就是 USB 插入順序決定桌上哪一台對到畫面哪一個圈。

> 注意：這只影響「桌面畫面上哪個圈亮」。**哪個家電亮不受影響** —— 三端一律以卡片的
> `data.id` 路由，卡片放在哪一台讀卡機上都會亮對的家電。

### 現場步驟

1. 9 台讀卡機全部插上，啟動 server。
2. 每台上線時，終端機會印出目前的對應表：

   ```
   [MAP]  ── 目前讀卡機對應 ──────────────────────────────
   [MAP]    NFC 01  ACS ACR122U PICC Interface 00   (自動)
   [MAP]    NFC 02  ACS ACR122U PICC Interface 01   (自動)
   ...
   ```

3. 一台一台刷卡確認「桌上這台」對到「畫面上哪個圈」，記下真正的實體順序。
4. 複製範本並依實體位置填號碼（**數字用畫面上的 NFC 編號 1–9**，不是 0-based）：

   ```bat
   copy server\reader-map.example.json server\reader-map.json
   ```

   ```json
   {
     "ACS ACR122U PICC Interface 00": 3,
     "ACS ACR122U PICC Interface 01": 1,
     "ACS ACR122U PICC Interface 02": 7
   }
   ```

5. 重啟 server。之後不管 USB 插入順序如何，位置都固定。

### 行為說明

| 情況 | 結果 |
|------|------|
| `reader-map.json` 不存在 | 全部自動配號（開發 / 還沒佈線時的預設） |
| 讀卡機有登記 | 用指定位置，終端顯示 `(釘選)` |
| 讀卡機沒登記 | 自動配到**還沒被登記佔用**的位置，並印出 ⚠ 警告 |
| 同一台拔掉重插 | 回到原本的位置，不會漂移 |
| 名稱寫錯導致位置衝突 | 印出警告，退回自動配，不會踢掉現場已在跑的那台 |

已登記但還沒上線的位置會被**預留**，臨時插上的機器不會佔走。

---

## 新增 NFC 卡片

編輯 `server/uid-map.json`，格式如下：

```json
{
  "04DA53A76F2681": {
    "id": "door",
    "label": "大門",
    "description": "偵測入口狀態、開啟紀錄與環境安全資訊。",
    "slot": 1,
    "osc": "/nfc/door"
  }
}
```

| 欄位 | 說明 |
|------|------|
| `id` | 英文識別符，自訂 |
| `label` | 前端顯示名稱 |
| `description` | 左側說明文字 |
| `slot` | 1–9，對應前端圓圈位置 |
| `osc` | 預留給 TouchDesigner 的 OSC 路徑 |

新增後**不需要重啟 server**（需重啟才會重新讀取 json）。  
實際上需重啟 server 讓其重新 require uid-map.json。

---

## 修改前端 Slot 名稱

編輯 `web/src/App.jsx` 的 `SLOTS` 陣列：

```js
export const SLOTS = [
  { slot: 1, label: '大門',  id: 'door'      },
  { slot: 2, label: '冷氣',  id: 'air'       },
  // ...
]
```

`slot` 編號必須和 `uid-map.json` 的 `slot` 欄位對應。

---

## TROUBLESHOOTING

### ❌ `npm install` 失敗（nfc-pcsc 原生模組）

`nfc-pcsc` 需要編譯 C++ 原生模組，Windows 上需要：

**方法 1：安裝 windows-build-tools（推薦，一行搞定）**
```bat
npm install --global --production windows-build-tools
```
> 以系統管理員身分執行 PowerShell

**方法 2：手動安裝**
1. 安裝 [Python 3.x](https://www.python.org/downloads/)（安裝時勾選「Add to PATH」）
2. 安裝 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（選 C++ build tools workload）
3. 再執行 `npm install`

**方法 3：使用 Python 替代 server**

若 nfc-pcsc 無法安裝，可改用 Python server（不需要原生模組）：

```bash
pip install smartcard websockets
```

Python 版 server 程式碼請參考 `server/server_python_alternative.py`（尚未建立，可另行建立）。

---

### ❌ 讀卡機未被偵測

- 確認 ACR122U 已插入 USB
- 確認 Windows Smart Card 服務有在執行：
  ```bat
  sc query SCardSvr
  ```
  若未執行：
  ```bat
  sc start SCardSvr
  ```
- 確認 PC/SC 驅動已安裝（用 NFC Tools for Desktop 測試可讀到即代表驅動 OK）

---

### ❌ WebSocket 無法連線

- 確認 `server/index.js` 有在執行
- 確認防火牆未擋 port 8787
- Chrome 需在本機開啟（`localhost`），不是其他裝置的 IP

---

### ❌ 卡片刷了沒反應

- server 終端有顯示 Card 訊息嗎？若有代表 NFC 讀到，但 WebSocket 沒送出
- 確認前端 ws://localhost:8787 有連線
- 若 UID 格式不對：server 終端顯示的 UID 是否是大寫、無冒號？

---

### ❌ 同一張卡重複觸發

已有 `lastUid` 防抖：只要卡片沒離開再靠近，不會重複觸發。

---

## 未來擴充

### OSC / TouchDesigner

`server/index.js` 已預留 OSC 擴充位置：

```js
// 安裝 osc 套件：npm install osc
// 取消 server/index.js 內的 OSC 區塊注解
```

### 多卡片同時感應

ACR122U 一次只讀一張卡。若需多卡感應，需要配合多台讀卡機或支援 multi-card 的讀卡機。

---

## 檔案說明

```
nfc-web-control/
├─ server/
│  ├─ index.js          WebSocket server + NFC 讀取邏輯
│  ├─ uid-map.json      UID 對應設定（主要修改這裡）
│  └─ package.json
│
├─ web/
│  ├─ src/
│  │  ├─ App.jsx        主元件、WebSocket 邏輯、SLOTS 設定
│  │  ├─ style.css      所有樣式
│  │  └─ components/
│  │     ├─ NfcSlot.jsx        槽位圓圈
│  │     ├─ CenterHub.jsx      中央圓
│  │     ├─ InfoPanel.jsx      左側資訊欄
│  │     └─ ConnectionStatus.jsx  斷線提示
│  └─ ...
│
├─ start.bat            Windows 一鍵啟動
└─ README.md
```
