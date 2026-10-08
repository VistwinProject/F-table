# F 區 Windows x64 三畫面離線包（2026-10-08 r2 正式 NFC）

配置：Windows 10/11 x64 主機，三路獨立 HDMI 延伸輸出：Wall、Table、Graph。iPad 不佔 HDMI，透過同區網 Wi-Fi 連線。

## 第一次設定

1. 將整個離線包解壓縮到固定位置（如 C:\FZone），不要拆開資料夾。包內包含 Windows Node、已於 Windows 編譯的 NFC 模組及全部素材，現場不需 npm install 或上網下載套件。
2. Windows 必須能同時驅動三個延伸螢幕。HDMI 分配器若只複製同一畫面不能取代三路獨立輸出。在顯示設定選「延伸」，確認座標、解析度與縮放。
3. 電腦需已有 Microsoft Edge 或 Chrome；讀卡機須能被 Windows PC/SC 辨識。瀏覽器、顯卡及讀卡機廠商驅動不包含在此包內。
4. 雙擊 Install-F.cmd。列出的索引從 0 起，不一定等於 Windows 顯示設定上的編號。依序選 Table、Wall、Graph，三者不可重複。
5. 選 live（正式 NFC，預設）或 sim（無硬體演練）。設定存 windows/settings.json，安裝時不覆蓋既有燈條控制器設定。
6. 桌面會建立 F Zone 與 Stop F Zone 兩個捷徑。雙擊 F Zone／Start-F.cmd，會開啟三個指定位置的無邊框畫面；重複啟動會重用專用視窗。

## iPad

iPad Safari 開 `http://主機IPv4:6275/ipad`。主機啟動時列出候選網址，也可用 ipconfig 查詢。iPad 的 localhost 不是展演主機。

主機與 iPad 需在同區網，避免訪客網路隔離；允許包內 runtime/node.exe 在私人網路接受 TCP 6275。建議路由器固定分配主機 IP。iPad 使用區網網址，不能以 GitHub Pages 網址控制本機展演。

## NFC、Graph 與聲音

- Graph 來源：F-knowledge-graph-27 main，commit 7751e0decc28f63d22f0480923f0a72a9f4a336b；完整靜態頁已隨包提供，無需外網。
- 本機 Graph 入口 `/graph?ws=ws%3A%2F%2F127.0.0.1%3A6273`，接收同一服務的 NFC 與 revision，使用 role=graph 回報。
- X 必要輸出是 Table、Wall、Graph；iPad 為額外控制端。只有服務在線不代表三屏已渲染完成。
- 聲音仍由 Table 播放。Graph 無聲；在 Windows 音效設定選定現場音響輸出，不假定 HDMI 音訊會自動送往正確音響。
- 本版 server/uid-map.json 已登記九張正式卡；2026-10-08 在 Mac 單台 ACS ACR122U 上逐張讀取，重新啟動正式 NFC 服務後全部複驗通過，UID 無重複。完整對照與事件記錄見 formal-nfc-20261008.json。現場固定讀卡機位置後另建立 server/reader-map.json。
- 診斷入口：http://主機IP:6275/diagnostics.html。先逐台驗證，再測九台同時感應。

## Wall 中央裝置燈條

控制器尚未選定，目前只完成控制邏輯與介面，預設不向硬體送訊號。

- 至少一個槽位感應到已登記家電 → desired=true（亮）。
- 全部移除、讀卡機斷線且已無其他家電、重置 → desired=false（滅）。未知卡不觸發。
- 目前採持續亮，不自行開啟呼吸／閃爍。
- `/health` 的 led 欄位區分 desired、applied、status 與 error。not-configured 代表尚未接控制器；command-accepted 只代表控制器 HTTP 接受，不能當作肉眼確認燈亮。
- Install 會建立 server/led-settings.json（enabled=false）。預留可設定 HTTP JSON 輸出：url、onPayload、offPayload；這不是已選定硬體協定。選定控制器後若採其他協定，需另做 adapter，不可直接假設相容。
- 訊號按狀態變化送出；失敗重試最新狀態，避免延遲的亮燈命令蓋掉滅燈。正常 Stop 會嘗試送滅燈；斷電或程序崩潰時需控制器本身提供失聯熄燈保護，選型時確認。

## 每日啟動與停止

1. 接好三個 HDMI／讀卡機、開啟顯示器，確認延伸模式。
2. 雙擊 F Zone。確認 Table／Wall／Graph 的指定螢幕與 Graph NFC 連線。
3. iPad 連入主機 IP，測試前言、感應、移除及重置；Table 語音如被瀏覽器政策阻擋，點一次啟用。
4. 結束使用 Stop F Zone／Stop-F.cmd，會停止本包服務及三個專用視窗，不關閉一般瀏覽器，也不刪校正與映射。停止使用本機檔案請求，不提供公開網路關機 API。

專用瀏覽器設定與日誌存 `%LOCALAPPDATA%\FZone-<安裝路徑識別碼>`。移動安裝資料夾會使用新的識別碼，需重新設定校正；勿刪原設定資料。

## 從舊包更新至正式 NFC 版

1. 在舊安裝路徑先執行 Stop-F.cmd，另存整份舊安裝資料夾以便回退。
2. 將新版解壓至暫存資料夾，再把包內檔案更新至原安裝路徑，避免改變瀏覽器校正資料的路徑識別碼。
3. 保留原有 windows/settings.json、server/reader-map.json、server/led-settings.json 與瀏覽器設定；套用包內檔案後，從備份還原這三個現場設定檔（原本存在才還原）。包內 led-settings.json 是停用硬體的預設值。
4. **這次必須採用新版 server/uid-map.json，不要將舊 UID 映射覆蓋回來。** 舊映射留在備份即可；新版包含本次九張正式卡。
5. 執行 Start-F.cmd，在診斷頁逐張確認九種家電與移除事件，再驗證九台讀卡機、三屏、音訊與重置。全新安裝才先執行 Install-F.cmd 設定螢幕。

本次 Mac 單讀卡機驗證不代表 Windows 現場或九台同時感應驗收；安裝包尚未自動套用到現場主機。

## 驗證界線

自動測試涵蓋 NFC／多畫面重置、燈條聚合與延遲命令、Graph HTTP 入口。Windows 原生模組由 Windows CI 建置並測試載入。10 月 6 日版本的 PowerShell 語法曾以 Windows 解析器檢查；本次 10 月 8 日新增三屏設定與檢查，尚待 Windows 上重新執行 scripts/check-windows.ps1。

三條 HDMI 視窗配置、Windows 防火牆、實際音響與九台讀卡機仍需現場驗收；燈條因控制器未定，尚無硬體驗收。Graph 的業主問答示範與歷史數值沿用來源，並非即時 AI 查詢。

本版恢復 Windows x64 主機三路 HDMI 輸出，Graph 由主機直接顯示，不需要第二台 iPad。F_REQUIRED_DISPLAYS 固定為 table,wall,graph，只有三屏回報目前 revision 才算 ready。本次為本機離線包更新，未推送 repo 或部署現場 X。
